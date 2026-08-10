/**
 * Toxic-quote filter and never-error rounds: quotes losing more than 8%
 * (dust-adjusted) to price impact fail their provider's slot, and rounds
 * where nothing usable comes back resolve with `selected: null` instead of
 * rejecting — the caller keeps retrying on its refresh cadence.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'

import {
  fetchBestZapQuote,
  type FetchQuoteContext,
  type ProviderQuoteEvent,
} from '../src/hooks/zap-quote-providers'
import type { ProviderConfig, ProviderId } from '../src/utils/providers'
import type { ZapResult } from '../src/types/api'

const TOKEN_IN = '0x1111111111111111111111111111111111111111' as Address
const TOKEN_OUT = '0x2222222222222222222222222222222222222222' as Address

const makeResult = (overrides: Partial<ZapResult> = {}): ZapResult => ({
  tokenIn: TOKEN_IN,
  amountIn: '1000000000000000000',
  amountInValue: 3000,
  tokenOut: TOKEN_OUT,
  amountOut: '900000000',
  amountOutValue: 2970,
  minAmountOut: '890000000',
  approvalAddress: '0x3333333333333333333333333333333333333333' as Address,
  approvalNeeded: false,
  insufficientFunds: false,
  dust: [],
  dustValue: null,
  gas: null,
  priceImpact: 1,
  truePriceImpact: 1,
  tx: null,
  ...overrides,
})

const makeProvider = (id: ProviderId): ProviderConfig => ({
  id,
  label: id,
  kind: 'aggregator',
  Icon: () => null,
  buildEndpoint: (params) => `${params.url}${id}/swap`,
})

const makeCtx = (
  providers: ProviderConfig[],
  onUpdate?: (event: ProviderQuoteEvent) => void
): FetchQuoteContext => ({
  providers,
  quoteSource: 'best',
  endpointParams: {
    chainId: 1,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: '1000000000000000000',
    slippage: 200,
    signer: '0x4444444444444444444444444444444444444444' as Address,
    apiUrl: 'http://api.test/',
    zapperApiUrl: 'http://zapper.test/',
  },
  tracking: { quoteId: 'q1', retryId: 'r1' },
  analytics: { dtfTicker: 'TEST', chainId: 1, type: 'buy' },
  onUpdate,
})

// Serves each provider's ZapResult by matching its id in the request URL.
const mockFetch = (resultsById: Partial<Record<ProviderId, ZapResult>>) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const id = (Object.keys(resultsById) as ProviderId[]).find((key) =>
        String(url).includes(`/${key}/`)
      )
      if (!id) throw new Error(`Unexpected fetch: ${url}`)
      return {
        ok: true,
        json: async () => ({ status: 'success', result: resultsById[id] }),
      }
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toxic quote filter', () => {
  it('discards quotes above 8% impact so a clean lower-output quote wins', async () => {
    // velora pays more but loses 12% to impact; enso (no impact reported,
    // treated as 0) must win despite the lower minAmountOut
    mockFetch({
      velora: makeResult({ minAmountOut: '950000000', truePriceImpact: 12 }),
      enso: makeResult({ minAmountOut: '890000000', truePriceImpact: null }),
    })
    const events: ProviderQuoteEvent[] = []
    const result = await fetchBestZapQuote(
      makeCtx([makeProvider('velora'), makeProvider('enso')], (e) =>
        events.push(e)
      )
    )

    expect(result.selected?.source).toBe('enso')
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].source).toBe('velora')
    expect(String(result.failed[0].error)).toMatch(/price impact exceeds 8%/)

    const errorEvents = events.filter((e) => e.type === 'quote-error')
    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0]).toMatchObject({ source: 'velora' })
  })

  it('keeps quotes at exactly 8% impact', async () => {
    mockFetch({ enso: makeResult({ truePriceImpact: 8 }) })
    const result = await fetchBestZapQuote(makeCtx([makeProvider('enso')]))
    expect(result.selected?.source).toBe('enso')
  })

  it('resolves with selected: null when every quote is toxic', async () => {
    mockFetch({
      velora: makeResult({ truePriceImpact: 9 }),
      enso: makeResult({ truePriceImpact: 15 }),
    })
    const events: ProviderQuoteEvent[] = []
    const result = await fetchBestZapQuote(
      makeCtx([makeProvider('velora'), makeProvider('enso')], (e) =>
        events.push(e)
      )
    )

    expect(result.selected).toBeNull()
    expect(result.failed.map((f) => f.source).sort()).toEqual([
      'enso',
      'velora',
    ])
    expect(events.at(-1)).toMatchObject({ type: 'round-complete', best: null })
  })
})

describe('never-error rounds', () => {
  it('resolves with selected: null when the single candidate fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
    const events: ProviderQuoteEvent[] = []
    const result = await fetchBestZapQuote(
      makeCtx([makeProvider('enso')], (e) => events.push(e))
    )

    expect(result.selected).toBeNull()
    expect(result.failed).toHaveLength(1)
    expect(events.at(-1)).toMatchObject({ type: 'round-complete', best: null })
  })

  it('resolves with selected: null when no providers are available', async () => {
    const result = await fetchBestZapQuote(makeCtx([]))
    expect(result.selected).toBeNull()
    expect(result.attempted).toHaveLength(0)
  })
})
