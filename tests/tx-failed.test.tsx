/**
 * Repro tests for: "when a tx reverts or is rejected, the CTA stays
 * disabled+loading and never recovers", plus the follow-up regression where
 * the recovery effects fed each other into a sub-second refetch/simulate loop.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  dumpState,
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  makeQuote,
  queryStates,
  scenario,
  setQuoteBuilder,
  setup,
  waitForReadyCta,
} from './helpers/harness'

describe('CTA recovery after failed transaction', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('recovers when the user rejects the tx in the wallet', async () => {
    scenario.send = 'reject'
    await setup()
    await waitForReadyCta()

    fireEvent.click(getCta())
    // give the rejection time to propagate
    await new Promise((r) => setTimeout(r, 1_000))
    dumpState('after reject')

    try {
      await waitForReadyCta()
    } catch (e) {
      dumpState('STUCK after reject')
      throw e
    }
  })

  it('recovers when the tx reverts on-chain', async () => {
    scenario.send = 'accept'
    scenario.receiptStatus = '0x0'
    await setup()
    await waitForReadyCta()

    fireEvent.click(getCta())
    // sendTransaction succeeds -> receipt polling -> reverted receipt throws.
    // Give the retries time to exhaust (react-query default: 3 retries, ~7s)
    await new Promise((r) => setTimeout(r, 12_000))
    dumpState('after revert settled')

    try {
      await waitForReadyCta()
    } catch (e) {
      dumpState('STUCK after revert')
      throw e
    }
  })

  it('recovers when the quote expires while signing and the user rejects', async () => {
    scenario.send = 'reject'
    scenario.quoteTtlMs = 2_000
    scenario.sendDelayMs = 5_000
    await setup()
    await waitForReadyCta()

    fireEvent.click(getCta())
    // quote expires at ~2s while the wallet prompt is open; rejection at 5s
    await new Promise((r) => setTimeout(r, 3_000))
    dumpState('expired while signing')
    await new Promise((r) => setTimeout(r, 4_000))
    dumpState('after delayed reject')

    try {
      await waitForReadyCta()
    } catch (e) {
      dumpState('STUCK after expired+reject')
      throw e
    }
  })

  it('recovers when the tx reverts and the stale quote fails simulation until refreshed', async () => {
    scenario.send = 'accept'
    scenario.receiptStatus = '0x0'
    // simulation of the stale quote keeps reverting for 20s after the send —
    // long enough that the estimateGas query exhausts all retries and lands in
    // a terminal error state. After the window the quote simulates fine again,
    // so a healthy flow must recover.
    scenario.estimateFailWindowMs = 20_000
    await setup()
    await waitForReadyCta()

    fireEvent.click(getCta())

    // fine-grained timeline of the CTA state
    const timeline: string[] = []
    const t0 = Date.now()
    const poller = setInterval(() => {
      try {
        const b = getCta()
        const probe = screen.getByTestId('probe').textContent
        timeline.push(
          `${((Date.now() - t0) / 1000).toFixed(1)}s "${b.textContent}" disabled=${b.disabled} spin=${!!b.querySelector('.animate-spin')} ${probe}\n    ${queryStates()}`
        )
      } catch {
        timeline.push(`${((Date.now() - t0) / 1000).toFixed(1)}s CTA-not-found`)
      }
    }, 1_000)

    // revert settles ~7s in; sim-fail window ends at 20s; quote refreshes
    // every 9s — a healthy flow should be interactive again well within 45s
    try {
      await new Promise((r) => setTimeout(r, 25_000))
      await waitFor(
        () => {
          const cta = getCta()
          expect(cta.textContent).toMatch(/Buy TEST/i)
          expect(cta.disabled).toBe(false)
        },
        { timeout: 20_000, interval: 250 }
      )
      // must be stable, not a momentary flap
      await new Promise((r) => setTimeout(r, 3_000))
      const cta = getCta()
      expect(cta.textContent).toMatch(/Buy TEST/i)
      expect(cta.disabled).toBe(false)
    } catch (e) {
      dumpState('STUCK after revert+stale-sim')
      throw e
    } finally {
      clearInterval(poller)
      console.log('TIMELINE:\n' + timeline.join('\n'))
    }
  })

  it('does not spiral into a refetch/simulate loop after a rejected tx with a dead quote', async () => {
    // Reject while the quote is expired AND every post-send simulation
    // reverts: the worst case that previously made the quote refetch and the
    // simulation re-arm feed each other several times per second.
    scenario.send = 'reject'
    scenario.quoteTtlMs = 2_000
    scenario.sendDelayMs = 3_000
    scenario.estimateFailWindowMs = 60_000
    // Real quotes carry different calldata on every refetch, which resets the
    // estimateGas query (new key) and made `simulationFailed` flap — the
    // trigger of the old feedback loop. Model that.
    let fetchCount = 0
    setQuoteBuilder(() =>
      makeQuote({
        tx: {
          data: `0x12345678${(fetchCount++).toString(16).padStart(4, '0')}`,
          to: '0x2000000000000000000000000000000000000002',
          value: '1000000000000000000',
        },
      })
    )
    await setup()
    await waitForReadyCta()

    fireEvent.click(getCta())
    // rejection lands at ~3s
    await new Promise((r) => setTimeout(r, 4_000))

    const quoteFetchesAtReject = scenario.quoteFetches
    const estimatesAtReject = scenario.calls.filter((c) =>
      c.startsWith('eth_estimateGas')
    ).length

    // observe a 10s window after the failure settled
    await new Promise((r) => setTimeout(r, 10_000))

    const quoteFetches = scenario.quoteFetches - quoteFetchesAtReject
    const estimates =
      scenario.calls.filter((c) => c.startsWith('eth_estimateGas')).length -
      estimatesAtReject

    console.log(
      `[loop regression] 10s window after reject: quoteFetches=${quoteFetches} estimateGas=${estimates}`
    )

    // Bounded activity: the one-shot post-failure refetch plus at most two
    // interval ticks (9s) of quotes, and a couple of simulation retry cycles.
    // The old feedback loop produced dozens of both within a second.
    expect(quoteFetches).toBeLessThanOrEqual(4)
    expect(estimates).toBeLessThanOrEqual(20)

    // and the CTA is in a stable, honest state: a quote tick may legitimately
    // pass through "Fetching quote..." but there is no sub-second flapping
    const snapshots = new Set<string>()
    for (let i = 0; i < 6; i++) {
      const cta = getCta()
      snapshots.add(`${cta.textContent}|${cta.disabled}`)
      await new Promise((r) => setTimeout(r, 300))
    }
    expect(snapshots.size).toBeLessThanOrEqual(3)
  })
})
