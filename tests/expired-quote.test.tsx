/**
 * Invariant: a quote past its validUntil is never handed to the wallet, and
 * the query cache never re-serves an old quote when params flip back.
 */
import { fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  scenario,
  setup,
  waitForReadyCta,
} from './helpers/harness'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const armedCta = () => {
  const cta = getCta()
  return !cta.disabled && /Buy TEST/i.test(cta.textContent || '')
}

describe('expired quote invariant', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('never sends an expired quote — the click refetches instead', async () => {
    scenario.quoteTtlMs = -1_000
    await setup()
    await waitForReadyCta()
    const fetchesBefore = scenario.quoteFetches

    fireEvent.click(getCta())
    await sleep(1_000)

    expect(
      scenario.calls.filter((c) => c === 'eth_sendTransaction')
    ).toHaveLength(0)
    // the wallet was never engaged, so no tx error can have surfaced
    expect(
      Array.from(document.querySelectorAll('[class*="text-red"]')).some((el) =>
        el.textContent?.trim()
      )
    ).toBe(false)
    // the guard triggered an immediate replacement — the 9s tick is not due
    await waitFor(() =>
      expect(scenario.quoteFetches).toBeGreaterThan(fetchesBefore)
    )
  })

  it('does not re-arm a cached quote when the amount flips back', async () => {
    scenario.quoteTtlMs = 60_000
    await setup()
    await waitForReadyCta()

    const input = document.querySelector('input')!
    const fetchesBefore = scenario.quoteFetches

    // slow responses so the in-flight window is observable
    scenario.quoteDelayMs = 3_000
    fireEvent.change(input, { target: { value: '2' } })
    await sleep(700) // past the 500ms input debounce
    fireEvent.change(input, { target: { value: '1' } })

    // the old '1' quote must not re-arm from cache while the refetch runs
    const until = Date.now() + 1_500
    while (Date.now() < until) {
      expect(armedCta()).toBe(false)
      await sleep(50)
    }

    await waitFor(
      () => expect(scenario.quoteFetches).toBeGreaterThan(fetchesBefore),
      { timeout: 10_000 }
    )
  })
})
