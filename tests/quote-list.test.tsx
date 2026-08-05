/**
 * Streaming quote list: per-provider rows arriving as each source settles,
 * user pick (sticky + fallback), expiry handling, and the `Quote Source
 * Picked` submit-time event.
 */
import mixpanel from 'mixpanel-browser/src/loaders/loader-module-core'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROVIDER_ENABLED } from '../src/utils/providers'
import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  makeQuote,
  scenario,
  setQuoteBuilder,
  setup,
  waitForReadyCta,
  ZAP_ROUTER,
} from './helpers/harness'

const ZAP_DATA = '0xaaaa0001'
const ENSO_DATA = '0xbbbb0002'
const ZAP_MIN_OUT = '995000000000000000000'
const ENSO_MIN_OUT = '999000000000000000000'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const zapQuote = () =>
  makeQuote({ tx: { data: ZAP_DATA, to: ZAP_ROUTER, value: '1000000000000000000' } })
const ensoQuote = () =>
  makeQuote({
    // enso offers the better output, so it wins the round
    amountOut: '1010000000000000000000',
    minAmountOut: ENSO_MIN_OUT,
    tx: { data: ENSO_DATA, to: ZAP_ROUTER, value: '1000000000000000000' },
  })

const providerQuotes = () =>
  setQuoteBuilder((url) => (url.includes('enso/swap') ? ensoQuote() : zapQuote()))

const wonEndpoint = () => screen.getByTestId('probe-endpoint').textContent || ''
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="quote-row-"]')).map(
    (el) => el.getAttribute('data-testid')
  )
const trackedEvents = (name: string) =>
  vi.mocked(mixpanel.track).mock.calls.filter((call) => call[0] === name)

const originalProviders = { ...PROVIDER_ENABLED[1]! }

describe('quote list', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
    // reduce the pool to two providers so the fetch mock stays simple
    PROVIDER_ENABLED[1] = { zap: true, velora: false, enso: true }
    providerQuotes()
    vi.mocked(mixpanel.track).mockClear()
    vi.mocked(mixpanel.register).mockClear()
  })

  afterEach(async () => {
    PROVIDER_ENABLED[1] = { ...originalProviders }
    await harnessAfterEach()
  })

  it('streams rows as providers settle and sorts once the round completes', async () => {
    setQuoteBuilder(async (url) => {
      if (url.includes('enso/swap')) {
        await sleep(1200)
        return ensoQuote()
      }
      return zapQuote()
    })
    await setup({ quoteSource: 'best', refreshRate: 60_000 })

    // zap's quote shows while enso is still loading (skeleton row, in place)
    await waitFor(() => {
      const zapRow = screen.getByTestId('quote-row-zap')
      const ensoRow = screen.getByTestId('quote-row-enso')
      expect(zapRow.querySelector('.animate-pulse')).toBeNull()
      expect(ensoRow.querySelector('.animate-pulse')).not.toBeNull()
    })

    await waitForReadyCta()

    // one sort at round completion: best (enso) on top, Best badge on it,
    // and the winner event agrees
    await waitFor(() => {
      expect(rowIds()).toEqual(['quote-row-enso', 'quote-row-zap'])
      expect(
        within(screen.getByTestId('quote-row-enso')).getByText('Best')
      ).toBeTruthy()
    })
    const winners = trackedEvents('Quote Source Winner')
    expect(winners).toHaveLength(1)
    expect(winners[0][1]).toMatchObject({ source: 'enso' })
  })

  it('picks a source without refetching, keeps it across refreshes, and only tracks at submit', async () => {
    await setup({ quoteSource: 'best', refreshRate: 3_000 })
    await waitForReadyCta()
    expect(wonEndpoint()).toContain('enso/swap')

    const fetchesBeforePick = scenario.quoteFetches
    fireEvent.click(screen.getByTestId('quote-row-zap'))

    // active switches to the picked source with no new round
    await waitFor(() => expect(wonEndpoint()).toContain('api/zapper'))
    expect(scenario.quoteFetches).toBe(fetchesBeforePick)
    expect(trackedEvents('Quote Source Picked')).toHaveLength(0)
    // tracking registrations follow the active source
    const sourceRegs = vi
      .mocked(mixpanel.register)
      .mock.calls.map((call) => call[0] as Record<string, unknown>)
      .filter((entry) => 'source' in entry)
    expect(sourceRegs[sourceRegs.length - 1]).toEqual({ source: 'zap' })

    // pick survives the next refresh round
    await waitFor(
      () => expect(scenario.quoteFetches).toBeGreaterThanOrEqual(fetchesBeforePick + 2),
      { timeout: 15_000 }
    )
    await waitForReadyCta()
    expect(wonEndpoint()).toContain('api/zapper')

    // the event fires on the effective submit, with picked-vs-best props
    fireEvent.click(getCta())
    await waitFor(() => expect(trackedEvents('Quote Source Picked')).toHaveLength(1), {
      timeout: 10_000,
    })
    expect(trackedEvents('Quote Source Picked')[0][1]).toMatchObject({
      source: 'zap',
      bestSource: 'enso',
      picked: true,
      isBest: false,
      minAmountOut: ZAP_MIN_OUT,
      bestMinAmountOut: ENSO_MIN_OUT,
      type: 'buy',
    })
  })

  it('tracks picked:false when submitting the auto-selected best', async () => {
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()

    fireEvent.click(getCta())
    await waitFor(() => expect(trackedEvents('Quote Source Picked')).toHaveLength(1), {
      timeout: 10_000,
    })
    expect(trackedEvents('Quote Source Picked')[0][1]).toMatchObject({
      source: 'enso',
      bestSource: 'enso',
      picked: false,
      isBest: true,
    })
  })

  it('falls back to best when the picked source fails and returns when it recovers', async () => {
    let zapFails = false
    setQuoteBuilder((url) => {
      if (url.includes('enso/swap')) return ensoQuote()
      if (zapFails) return { status: 'error', error: 'zap down' }
      return zapQuote()
    })
    await setup({ quoteSource: 'best', refreshRate: 1_500 })
    await waitForReadyCta()

    fireEvent.click(screen.getByTestId('quote-row-zap'))
    await waitFor(() => expect(wonEndpoint()).toContain('api/zapper'))

    // picked source starts failing -> its row is hidden, active falls back
    zapFails = true
    await waitFor(
      () => {
        expect(screen.queryByTestId('quote-row-zap')).toBeNull()
        expect(wonEndpoint()).toContain('enso/swap')
      },
      { timeout: 15_000 }
    )

    // recovery: the row reappears and the sticky pick becomes active again
    zapFails = false
    await waitFor(
      () => {
        expect(screen.queryByTestId('quote-row-zap')).not.toBeNull()
        expect(wonEndpoint()).toContain('api/zapper')
      },
      { timeout: 15_000 }
    )
  })

  it('resets the pick when the input amount changes', async () => {
    const utils = await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()

    fireEvent.click(screen.getByTestId('quote-row-zap'))
    await waitFor(() => expect(wonEndpoint()).toContain('api/zapper'))

    const input = utils.container.querySelector('input')!
    fireEvent.change(input, { target: { value: '2' } })

    await waitFor(() => expect(wonEndpoint()).toContain('enso/swap'), {
      timeout: 15_000,
    })
  })

  it('disables expired rows and ignores clicks on them', async () => {
    scenario.quoteTtlMs = 2_500
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()
    expect(wonEndpoint()).toContain('enso/swap')

    // hang the expiry-triggered refetch so the expired window is observable
    scenario.quoteDelayMs = 30_000

    await waitFor(
      () => {
        const zapRow = screen.getByTestId('quote-row-zap')
        expect(within(zapRow).getByText('Expired')).toBeTruthy()
        expect(zapRow.getAttribute('aria-disabled')).toBe('true')
      },
      { timeout: 10_000 }
    )

    fireEvent.click(screen.getByTestId('quote-row-zap'))
    await sleep(300)
    expect(wonEndpoint()).toContain('enso/swap')
  })

  it('refetches when quotes expire before the global refresh tick', async () => {
    scenario.quoteTtlMs = 2_500
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()
    const fetchesAfterFirstRound = scenario.quoteFetches

    // quotes expire ~2.5s in; a fresh round replaces them long before the
    // 60s global tick
    await waitFor(
      () =>
        expect(scenario.quoteFetches).toBeGreaterThanOrEqual(
          fetchesAfterFirstRound + 2
        ),
      { timeout: 8_000 }
    )
    await waitForReadyCta()
    await waitFor(() => {
      expect(
        within(screen.getByTestId('quote-row-enso')).queryByText('Expired')
      ).toBeNull()
    })
  })

  it('honors a seeded pick (defaultSource) without firing the picked event', async () => {
    await setup({
      quoteSource: 'best',
      refreshRate: 60_000,
      pickedSource: 'zap',
    })
    await waitForReadyCta()

    // zap is active from the seed even though enso wins the round
    expect(wonEndpoint()).toContain('api/zapper')
    expect(trackedEvents('Quote Source Picked')).toHaveLength(0)
  })
})
