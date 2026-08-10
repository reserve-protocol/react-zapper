/**
 * Quote refreshes must not blink the CTA: background refetches keep the
 * previous quote displayed and the button ready — no "Fetching quote..."
 * state, no disable, regardless of how slow the refetch is. Only the first
 * load of a cache key shows a fetching state.
 *
 * Tests pass an explicit 9s refreshRate (production default is 30s) so a
 * couple of refresh ticks fit in each observation window.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'

import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  makeQuote,
  scenario,
  setQuoteBuilder,
  setup,
  waitForReadyCta,
} from './helpers/harness'

describe('CTA flicker on quote refresh', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('keeps the CTA visually stable across fast refresh ticks', async () => {
    // realistic: every refetch returns different calldata
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
    await setup({ refreshRate: 9_000 })
    await waitForReadyCta()

    // observe two full refresh ticks (9s interval) at high frequency
    const t0 = Date.now()
    const transitions: string[] = []
    let last = ''
    const sample = () => {
      let state = ''
      try {
        const b = getCta()
        state = `"${b.textContent}" disabled=${b.disabled} spin=${!!b.querySelector('.animate-spin')}`
      } catch {
        state = 'CTA-not-found'
      }
      if (state !== last) {
        transitions.push(`${(Date.now() - t0).toString().padStart(6)}ms ${state}`)
        last = state
      }
    }
    sample()
    const poller = setInterval(sample, 10)
    await new Promise((r) => setTimeout(r, 20_000))
    clearInterval(poller)

    console.log('CTA TRANSITIONS:\n' + transitions.join('\n'))

    // the initial sample is the ready state; nothing else should ever show
    expect(transitions).toHaveLength(1)
  }, 40_000)

  it('never flashes the simulation-failed label on transient estimate errors', async () => {
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
    scenario.quoteDelayMs = 800
    await setup({ refreshRate: 9_000 })
    await waitForReadyCta()

    const transitions: string[] = []
    let last = ''
    const t0 = Date.now()
    const sample = () => {
      let state = ''
      try {
        const b = getCta()
        state = `${b.textContent}|${b.disabled}`
      } catch {
        state = 'CTA-not-found'
      }
      if (state !== last) {
        transitions.push(`${Date.now() - t0}ms ${state}`)
        last = state
      }
    }
    sample()
    const poller = setInterval(sample, 10)

    // transient RPC noise (rate limit) hitting the estimates right when the
    // refreshed quote lands (pre-sim + the new tx's first CTA simulation) —
    // common in prod with public RPCs under the extra estimate load
    setTimeout(() => (scenario.estimateFailTransient = 4), 9_600)
    await new Promise((r) => setTimeout(r, 15_000))
    clearInterval(poller)

    console.log('CTA TRANSITIONS:\n' + transitions.join('\n'))

    const simFlash = transitions.filter((t) => /Simulation failed/i.test(t))
    expect(simFlash).toHaveLength(0)
  }, 40_000)

  it('keeps the CTA ready through a slow background refetch', async () => {
    // realistic: every refetch returns different calldata, and takes 800ms
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
    scenario.quoteDelayMs = 800
    await setup({ refreshRate: 9_000 })
    await waitForReadyCta()

    const transitions: { at: number; state: string }[] = []
    let last = ''
    const t0 = Date.now()
    const sample = () => {
      let state = ''
      try {
        const b = getCta()
        state = `${b.textContent}|${b.disabled}`
      } catch {
        state = 'CTA-not-found'
      }
      if (state !== last) {
        transitions.push({ at: Date.now() - t0, state })
        last = state
      }
    }
    sample()
    const poller = setInterval(sample, 10)
    // one refresh tick (~9s in) with a 800ms fetch
    await new Promise((r) => setTimeout(r, 12_000))
    clearInterval(poller)

    console.log(
      'CTA TRANSITIONS:\n' +
        transitions.map((t) => `${t.at}ms ${t.state}`).join('\n')
    )

    // the previous quote stays displayed and clickable: no fetching state,
    // no disable, no other transition for the whole refetch
    expect(
      transitions.filter((t) => /Fetching quote/.test(t.state))
    ).toHaveLength(0)
    expect(transitions).toHaveLength(1)
    expect(transitions[0].state).toMatch(/Market Buy/)
    expect(transitions[0].state).toMatch(/\|false$/)
  }, 40_000)

  it('submits the displayed quote when clicked mid-refetch', async () => {
    let fetchCount = 0
    let lastBuiltData = ''
    setQuoteBuilder(() => {
      lastBuiltData = `0x12345678${(fetchCount++).toString(16).padStart(4, '0')}`
      return makeQuote({
        tx: {
          data: lastBuiltData,
          to: '0x2000000000000000000000000000000000000002',
          value: '1000000000000000000',
        },
      })
    })
    await setup({ refreshRate: 9_000 })
    await waitForReadyCta()

    // the quote on screen is the last one built; make the next round slow and
    // click while its refetch is still in flight
    const displayedData = lastBuiltData
    scenario.quoteDelayMs = 5_000
    await new Promise((r) => setTimeout(r, 9_500))

    const cta = getCta()
    expect(cta.textContent).toMatch(/Market Buy/)
    expect(cta.disabled).toBe(false)
    fireEvent.click(cta)

    await waitFor(
      () => expect(scenario.sentTransactions).toHaveLength(1),
      { timeout: 15_000 }
    )
    expect(scenario.sentTransactions[0].data).toBe(displayedData)
  }, 40_000)
})
