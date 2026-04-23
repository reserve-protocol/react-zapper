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
}

export type FetchQuoteResult = {
  selected: ProviderQuote
  attempted: ProviderId[]
  successful: ProviderId[]
  failed: { source: ProviderId; error: unknown }[]
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

const fetchOne = async (
  provider: ProviderConfig,
  ctx: FetchQuoteContext
): Promise<ProviderQuote> => {
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

  return { ...data, source: provider.id, endpoint }
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
  analytics: FetchQuoteContext['analytics']
): ProviderQuote => {
  if (quotes.length === 1) {
    mixpanelTrack('Quote Source Winner', {
      source: quotes[0].source,
      reason: `only_${quotes[0].source}_available`,
      ...analytics,
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

  const candidates =
    quoteSource === 'best'
      ? providers
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

  return {
    selected: pickBestQuote(successful, ctx.analytics),
    attempted: candidates.map((p) => p.id),
    successful: successful.map((q) => q.source),
    failed,
  }
}
