/**
 * Fast quote refreshes must not blink the CTA: when a refetch resolves in
 * under the deferred-loading delay, the button should not visibly change at
 * all. Catches the sub-perceptual "Fetching quote..." flash on every
 * refresh tick.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
    await setup()
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
    await setup()
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

  it('shows a readable fetching state when the refetch is slow', async () => {
    scenario.quoteDelayMs = 800
    await setup()
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

    const fetchingIdx = transitions.findIndex((t) =>
      /Fetching quote/.test(t.state)
    )
    expect(fetchingIdx).toBeGreaterThan(0)
    // and it stayed up long enough to be readable (minDuration ~400ms)
    const shownFor =
      (transitions[fetchingIdx + 1]?.at ?? Infinity) -
      transitions[fetchingIdx].at
    expect(shownFor).toBeGreaterThanOrEqual(350)
  }, 40_000)
})
