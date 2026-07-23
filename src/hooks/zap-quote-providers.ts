import { Address } from 'viem'
import type { ZapPayload, ZapResponse } from '../types/api'
import {
  generateSourceId,
  type Source,
} from '../utils/ids'
import {
  mixpanelTrack,
  trackIndexDTFQuote,
  trackIndexDTFQuoteError,
  trackIndexDTFQuoteRequested,
} from '../utils/tracking'
import type { ProviderConfig, ProviderId } from '../utils/providers'
import type { RfqAvailability } from '../utils/rfq/types'
import {
  filterQuotesBySimulation,
  type SimulateQuote,
} from './zap-quote-simulation'

export type ProviderQuote = ZapResponse & {
  source: ProviderId
  endpoint: string
}

export type TrackingContext = {
  sessionId?: string
  quoteId: string
  retryId: string
}

export type EndpointContext = Omit<ZapPayload, 'url'> & {
  apiUrl: string
  zapperApiUrl: string
}

/**
 * Extra context RFQ adapters need beyond the endpoint params: a chain read
 * for the allowance check and client-side USD pricing (RFQ APIs don't price
 * in USD). When absent, RFQ providers are skipped.
 */
export type RfqFetchContext = {
  readAllowance: (
    token: Address,
    owner: Address,
    spender: Address
  ) => Promise<bigint>
  amountInValue: number | null
  tokenOutPrice: number | null
  tokenOutDecimals: number | null
}

export type FetchQuoteContext = {
  providers: ProviderConfig[]
  quoteSource: Source | 'best'
  endpointParams: EndpointContext
  tracking: TrackingContext
  analytics: {
    account?: string
    tokenIn?: Address
    tokenOut?: Address
    dtfTicker: string
    chainId: number
    type: 'buy' | 'sell'
  }
  /**
   * When provided (and comparing multiple candidates in `best` mode), each
   * candidate tx is simulated and quotes that revert are excluded from the
   * selection.
   */
  simulate?: SimulateQuote
  rfq?: RfqFetchContext
}

export type FetchQuoteResult = {
  selected: ProviderQuote
  attempted: ProviderId[]
  successful: ProviderId[]
  failed: { source: ProviderId; error: unknown }[]
  simulationFiltered: { source: ProviderId; error: unknown }[]
}

const appendTrackingParams = (
  baseUrl: string,
  source: ProviderId,
  { sessionId, quoteId, retryId }: TrackingContext
): string => {
  const url = new URL(baseUrl)
  if (sessionId) url.searchParams.append('sessionId', sessionId)
  if (quoteId) url.searchParams.append('quoteId', quoteId)
  if (retryId) url.searchParams.append('retryId', retryId)
  url.searchParams.append('sourceId', generateSourceId(source))
  return url.toString()
}

const buildProviderUrl = (
  provider: ProviderConfig,
  params: EndpointContext
): string | null => {
  // The zap provider talks to the zapper service URL; aggregators talk to the
  // reserve API URL.
  const { apiUrl, zapperApiUrl, ...rest } = params
  const url = provider.kind === 'native' ? zapperApiUrl : apiUrl
  return provider.buildEndpoint({ ...rest, url })
}

// Quotes without a provider-reported expiry are considered valid for 1 minute
const DEFAULT_QUOTE_TTL = 60_000

// Providers report expiry inconsistently (epoch ms, epoch seconds, ISO string,
// null, or not at all) — normalize everything to epoch ms or null.
const normalizeValidUntil = (value: unknown): number | null => {
  if (value == null) return null
  const n =
    typeof value === 'string'
      ? Number(value) || Date.parse(value)
      : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n < 1e12 ? n * 1000 : n
}

const rfqAvailability = (ctx: FetchQuoteContext): RfqAvailability => ({
  chainId: ctx.endpointParams.chainId,
  tokenIn: ctx.endpointParams.tokenIn,
  tokenOut: ctx.endpointParams.tokenOut,
})

const fetchRfqOne = async (
  provider: ProviderConfig,
  ctx: FetchQuoteContext
): Promise<ProviderQuote> => {
  const adapter = provider.rfq
  if (!adapter || !ctx.rfq) {
    throw new Error(`${provider.label} is not configured for this trade`)
  }
  const reason = adapter.unavailableReason(rfqAvailability(ctx))
  if (reason) throw new Error(reason)

  const { endpointParams } = ctx
  const endpoint = appendTrackingParams(
    adapter.describeEndpoint(endpointParams.chainId, endpointParams.apiUrl),
    provider.id,
    ctx.tracking
  )

  trackIndexDTFQuoteRequested({
    account: ctx.analytics.account,
    tokenIn: ctx.analytics.tokenIn,
    tokenOut: ctx.analytics.tokenOut,
    dtfTicker: ctx.analytics.dtfTicker,
    chainId: ctx.analytics.chainId,
    type: ctx.analytics.type,
    endpoint,
    source: provider.id,
  })

  try {
    const result = await adapter.fetchQuote({
      chainId: endpointParams.chainId,
      account: endpointParams.signer,
      tokenIn: endpointParams.tokenIn,
      tokenOut: endpointParams.tokenOut,
      amountIn: endpointParams.amountIn,
      slippage: endpointParams.slippage,
      apiUrl: endpointParams.apiUrl,
      amountInValue: ctx.rfq.amountInValue,
      tokenOutPrice: ctx.rfq.tokenOutPrice,
      tokenOutDecimals: ctx.rfq.tokenOutDecimals,
      readAllowance: ctx.rfq.readAllowance,
    })

    trackIndexDTFQuote({
      account: ctx.analytics.account,
      tokenIn: ctx.analytics.tokenIn,
      tokenOut: ctx.analytics.tokenOut,
      dtfTicker: ctx.analytics.dtfTicker,
      chainId: ctx.analytics.chainId,
      type: ctx.analytics.type,
      endpoint,
      status: 'success',
      amountInValue: result.amountInValue,
      amountOutValue: result.amountOutValue,
      dustValue: result.dustValue,
      truePriceImpact: result.truePriceImpact,
      source: provider.id,
    })

    return {
      status: 'success',
      result: {
        ...result,
        validUntil:
          normalizeValidUntil(result.validUntil) ??
          Date.now() + DEFAULT_QUOTE_TTL,
      },
      source: provider.id,
      endpoint,
    }
  } catch (error) {
    trackIndexDTFQuoteError({
      account: ctx.analytics.account,
      tokenIn: ctx.analytics.tokenIn,
      tokenOut: ctx.analytics.tokenOut,
      dtfTicker: ctx.analytics.dtfTicker,
      chainId: ctx.analytics.chainId,
      type: ctx.analytics.type,
      endpoint,
      status: 'error',
      error:
        (error as { response?: { status?: number } })?.response?.status ?? 0,
      source: provider.id,
    })
    throw error
  }
}

const fetchOne = async (
  provider: ProviderConfig,
  ctx: FetchQuoteContext
): Promise<ProviderQuote> => {
  if (provider.kind === 'rfq') return fetchRfqOne(provider, ctx)

  const baseUrl = buildProviderUrl(provider, ctx.endpointParams)
  if (!baseUrl) throw new Error(`No ${provider.id} endpoint available`)

  const endpoint = appendTrackingParams(baseUrl, provider.id, ctx.tracking)

  trackIndexDTFQuoteRequested({
    account: ctx.analytics.account,
    tokenIn: ctx.analytics.tokenIn,
    tokenOut: ctx.analytics.tokenOut,
    dtfTicker: ctx.analytics.dtfTicker,
    chainId: ctx.analytics.chainId,
    type: ctx.analytics.type,
    endpoint,
    source: provider.id,
  })

  const response = await fetch(endpoint)
  if (!response.ok) {
    const error = response.status
    trackIndexDTFQuoteError({
      account: ctx.analytics.account,
      tokenIn: ctx.analytics.tokenIn,
      tokenOut: ctx.analytics.tokenOut,
      dtfTicker: ctx.analytics.dtfTicker,
      chainId: ctx.analytics.chainId,
      type: ctx.analytics.type,
      endpoint,
      status: 'error',
      error,
      source: provider.id,
    })
    throw new Error(`${provider.id} Error: ${error}`)
  }

  const data: ZapResponse = await response.json()

  if (data) {
    trackIndexDTFQuote({
      account: ctx.analytics.account,
      tokenIn: ctx.analytics.tokenIn,
      tokenOut: ctx.analytics.tokenOut,
      dtfTicker: ctx.analytics.dtfTicker,
      chainId: ctx.analytics.chainId,
      type: ctx.analytics.type,
      endpoint,
      status: data.status,
      amountInValue: data.result?.amountInValue,
      amountOutValue: data.result?.amountOutValue,
      dustValue: data.result?.dustValue,
      truePriceImpact: data.result?.truePriceImpact,
      source: provider.id,
    })
  }

  if (data && data.status === 'error') {
    throw new Error(data.error)
  }

  return {
    ...data,
    result: data.result
      ? {
          ...data.result,
          validUntil:
            normalizeValidUntil(data.result.validUntil ?? data.validUntil) ??
            Date.now() + DEFAULT_QUOTE_TTL,
        }
      : data.result,
    source: provider.id,
    endpoint,
  }
}

const parseMinOut = (q: ProviderQuote): bigint => {
  try {
    return q.result?.minAmountOut ? BigInt(q.result.minAmountOut) : 0n
  } catch {
    return 0n
  }
}

/**
 * Selects the best quote by `minAmountOut`. Ties go to `zap` to preserve
 * historical behaviour; if no `zap` quote is in the list, the first candidate
 * wins the tie.
 */
const pickBestQuote = (
  quotes: ProviderQuote[],
  analytics: FetchQuoteContext['analytics'],
  extra?: Record<string, unknown>
): ProviderQuote => {
  if (quotes.length === 1) {
    mixpanelTrack('Quote Source Winner', {
      source: quotes[0].source,
      reason: `only_${quotes[0].source}_available`,
      ...analytics,
      ...extra,
    })
    return quotes[0]
  }

  let best = quotes[0]
  let bestAmount = parseMinOut(best)

  for (let i = 1; i < quotes.length; i++) {
    const candidate = quotes[i]
    const amount = parseMinOut(candidate)
    if (amount > bestAmount) {
      best = candidate
      bestAmount = amount
    } else if (amount === bestAmount && candidate.source === 'zap') {
      best = candidate
      bestAmount = amount
    }
  }

  mixpanelTrack('Quote Source Winner', {
    source: best.source,
    reason: 'better_output',
    winningMinAmountOut: bestAmount.toString(),
    comparedProviders: quotes.map((q) => q.source).join(','),
    ...analytics,
    ...extra,
  })

  return best
}

/**
 * Fetches a quote either from a specific provider or from all enabled
 * providers in parallel, returning the best by `minAmountOut`. Failures from
 * individual providers are swallowed in `best` mode unless every provider
 * failed — in which case the first rejection is re-thrown.
 */
export const fetchBestZapQuote = async (
  ctx: FetchQuoteContext
): Promise<FetchQuoteResult> => {
  const { providers, quoteSource } = ctx

  // In `best` mode, unavailable RFQ providers (native input, unsupported
  // chain, missing rfq context) drop out of the pool silently; an explicit
  // selection instead surfaces the adapter's reason via fetchRfqOne's throw.
  const rfqUsable = (p: ProviderConfig): boolean =>
    p.kind !== 'rfq' ||
    (!!p.rfq && !!ctx.rfq && p.rfq.isAvailable(rfqAvailability(ctx)))

  const candidates =
    quoteSource === 'best'
      ? providers.filter(rfqUsable)
      : providers.filter((p) => p.id === quoteSource)

  if (candidates.length === 0) {
    throw new Error(
      `No providers available for quoteSource="${quoteSource}" on this chain`
    )
  }

  if (candidates.length === 1) {
    const selected = await fetchOne(candidates[0], ctx)
    return {
      selected,
      attempted: [candidates[0].id],
      successful: [candidates[0].id],
      failed: [],
      simulationFiltered: [],
    }
  }

  const settled = await Promise.allSettled(
    candidates.map((p) => fetchOne(p, ctx))
  )

  const successful: ProviderQuote[] = []
  const failed: FetchQuoteResult['failed'] = []

  settled.forEach((res, i) => {
    const source = candidates[i].id
    if (res.status === 'fulfilled') {
      successful.push(res.value)
    } else {
      failed.push({ source, error: res.reason })
    }
  })

  if (!successful.length) {
    const firstRejection = settled.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    )
    throw firstRejection?.reason ?? new Error('No quotes available')
  }

  // Drop candidates whose tx reverts in simulation before picking a winner.
  // With a single successful quote filtering can't change the selection, so
  // it is skipped (no added latency); quotes still needing approval are kept
  // unverified, so the common cold-start ERC-20 path issues zero estimates.
  let pool = successful
  let simulationFiltered: FetchQuoteResult['simulationFiltered'] = []

  if (ctx.simulate && quoteSource === 'best' && successful.length >= 2) {
    const { kept, filtered } = await filterQuotesBySimulation(
      successful,
      ctx.simulate
    )

    filtered.forEach(({ quote, error }) =>
      mixpanelTrack('Quote Simulation Filtered', {
        source: quote.source,
        minAmountOut: quote.result?.minAmountOut,
        error: (error instanceof Error ? error.message : String(error))
          .split('\n')[0]
          .slice(0, 180),
        ...ctx.analytics,
      })
    )
    simulationFiltered = filtered.map(({ quote, error }) => ({
      source: quote.source,
      error,
    }))

    if (kept.length > 0) {
      pool = kept
    } else {
      // Every candidate reverted — fall back to the unfiltered pool rather
      // than introduce a new "no route" state; the submit button's own
      // simulation gate surfaces the failure as before.
      mixpanelTrack('Quote Simulation All Failed', {
        comparedProviders: successful.map((q) => q.source).join(','),
        ...ctx.analytics,
      })
    }
  }

  return {
    selected: pickBestQuote(pool, ctx.analytics, {
      simulationFiltered:
        simulationFiltered.map((f) => f.source).join(',') || undefined,
      simulationFallback:
        simulationFiltered.length > 0 && pool === successful ? true : undefined,
    }),
    attempted: candidates.map((p) => p.id),
    successful: successful.map((q) => q.source),
    failed,
    simulationFiltered,
  }
}
