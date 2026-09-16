/**
 * `zap2`: the Rust zapper as a second native source, routed through the
 * reserve-api `api/zapper2/{chain}/swap` endpoint. It competes like any
 * outside venue: no tie-break preference, same query string as `zap`.
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

const ZAP_DATA = '0xaaaa0001'
const ZAP2_DATA = '0xcccc0003'
const ZAP_MIN_OUT = '995000000000000000000'
const ZAP2_MIN_OUT = '999000000000000000000'

const zapQuote = () =>
  makeQuote({ tx: { data: ZAP_DATA, to: ZAP_ROUTER, value: '1000000000000000000' } })
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
      zap: true,
      zap2: true,
      velora: false,
      enso: false,
      cowswap: false,
      pcsx: false,
    }
    setQuoteBuilder((url) =>
      url.includes('api/zapper2/') ? zap2Quote() : zapQuote()
    )
  })

  afterEach(async () => {
    PROVIDER_ENABLED[1] = { ...originalProviders }
    await harnessAfterEach()
  })

  it('quotes through api/zapper2 with the same query as zap', async () => {
    await setup({ quoteSource: 'zap2' })
    await waitForReadyCta()

    const endpoint = wonEndpoint()
    expect(endpoint).toContain('api/zapper2/1/swap?')
    expect(endpoint).not.toContain('api/zapper/')
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

  it('wins the round on a better minAmountOut, next to the zap row', async () => {
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()
    await openDetails()

    await waitFor(() => {
      expect(rowIds()).toEqual(['quote-row-zap2', 'quote-row-zap'])
      expect(
        within(screen.getByTestId('quote-row-zap2')).getByText('Best')
      ).toBeTruthy()
    })
    expect(wonEndpoint()).toContain('api/zapper2/1/swap')
  })

  it('gets no tie-break preference: an equal minAmountOut goes to zap', async () => {
    setQuoteBuilder((url) =>
      url.includes('api/zapper2/') ? zap2Quote(ZAP_MIN_OUT) : zapQuote()
    )
    await setup({ quoteSource: 'best', refreshRate: 60_000 })
    await waitForReadyCta()
    await openDetails()

    await waitFor(() => {
      expect(rowIds()).toEqual(['quote-row-zap', 'quote-row-zap2'])
      expect(
        within(screen.getByTestId('quote-row-zap')).getByText('Best')
      ).toBeTruthy()
    })
    expect(wonEndpoint()).toContain('api/zapper/1/swap')
    expect(wonEndpoint()).not.toContain('api/zapper2/')
  })
})
