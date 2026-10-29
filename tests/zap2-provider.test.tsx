/**
 * `zap2` (Alpha): the Rust zapper as the native source, routed through the
 * reserve-api `api/zapper/{chain}/swap` endpoint.
 */
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

const ENSO_DATA = '0xbbbb0002'
const ZAP2_DATA = '0xcccc0003'
const ENSO_MIN_OUT = '995000000000000000000'
const ZAP2_MIN_OUT = '999000000000000000000'

const ensoQuote = () =>
  makeQuote({ tx: { data: ENSO_DATA, to: ZAP_ROUTER, value: '1000000000000000000' } })
const zap2Quote = (minAmountOut = ZAP2_MIN_OUT) =>
  makeQuote({
    amountOut: '1010000000000000000000',
    minAmountOut,
    tx: { data: ZAP2_DATA, to: ZAP_ROUTER, value: '1000000000000000000' },
  })

const wonEndpoint = () => screen.getByTestId('probe-endpoint').textContent || ''
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="quote-row-"]')).map(
    (el) => el.getAttribute('data-testid')
  )

const openDetails = async () => {
  await waitFor(() => expect(screen.getByText('Details')).toBeTruthy(), {
    timeout: 15_000,
  })
  fireEvent.click(screen.getByText('Details'))
}

const originalProviders = { ...PROVIDER_ENABLED[1]! }

describe('zap2 provider', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
    PROVIDER_ENABLED[1] = {
      zap2: true,
      velora: false,
      enso: true,
      cowswap: false,
      pcsx: false,
    }
    setQuoteBuilder((url) =>
      url.includes('api/zapper/') ? zap2Quote() : ensoQuote()
    )
  })

  afterEach(async () => {
    PROVIDER_ENABLED[1] = { ...originalProviders }
    await harnessAfterEach()
  })

  it('quotes through api/zapper', async () => {
    await setup({ quoteSource: 'zap2' })
    await waitForReadyCta()

    const endpoint = wonEndpoint()
    expect(endpoint).toContain('api/zapper/1/swap?')
    expect(endpoint).not.toContain('api/zapper2/')
    const params = new URL(endpoint).searchParams
    for (const key of ['chainId', 'signer', 'tokenIn', 'amountIn', 'tokenOut', 'slippage', 'trade']) {
      expect(params.get(key), key).not.toBeNull()
    }
    expect(scenario.quoteFetches).toBe(1)

    // its transaction executes like any native quote
    fireEvent.click(getCta())
    await waitFor(() => expect(scenario.sendAttempted).toBe(true), {
      timeout: 15_000,
    })
    expect(scenario.sentTransactions.at(-1)).toMatchObject({ data: ZAP2_DATA })
  })

  it('shows as Alpha with the Best badge, next to the enso row', async () => {
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()
    await openDetails()

    await waitFor(() => {
      expect(rowIds()).toEqual(['quote-row-zap2', 'quote-row-enso'])
      expect(
        within(screen.getByTestId('quote-row-zap2')).getByText('Best')
      ).toBeTruthy()
    })
    // the route list names it Alpha
    expect(
      within(screen.getByTestId('quote-row-zap2')).getByText('Alpha')
    ).toBeTruthy()
    expect(wonEndpoint()).toContain('api/zapper/1/swap')
  })

  it('wins an equal minAmountOut as the first candidate', async () => {
    setQuoteBuilder((url) =>
      url.includes('api/zapper/') ? zap2Quote(ENSO_MIN_OUT) : ensoQuote()
    )
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()
    await openDetails()

    await waitFor(() => {
      expect(rowIds()).toEqual(['quote-row-zap2', 'quote-row-enso'])
      expect(
        within(screen.getByTestId('quote-row-zap2')).getByText('Best')
      ).toBeTruthy()
    })
    expect(wonEndpoint()).toContain('api/zapper/1/swap')
  })
})
