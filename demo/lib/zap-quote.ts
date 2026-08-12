import { Address, formatUnits } from 'viem'
import zapper, { ZapResponse, ZapResult } from '@/types/api'
import { PLACEHOLDER_SIGNER } from '@/utils/constants'

/**
 * Only the native zap provider (the ZRS services) is quoted here: the
 * aggregator/RFQ sources don't exercise the zapper itself, and quoting every
 * source for every DTF on a refresh interval would hit their rate limits.
 */
export const QUOTE_SOURCE = 'zap' as const

/** Folio (DTF) tokens are always 18 decimals. */
export const DTF_DECIMALS = 18

// Rounds are queued so a refresh cycle can never fan out one request per DTF
// at once (~20+ DTFs today).
const MAX_CONCURRENT_QUOTES = 4

let running = 0
const waiting: (() => void)[] = []

const acquire = () =>
  new Promise<void>((resolve) => {
    if (running < MAX_CONCURRENT_QUOTES) {
      running++
      resolve()
      return
    }
    waiting.push(() => {
      running++
      resolve()
    })
  })

const release = () => {
  running--
  waiting.shift()?.()
}

export type QuoteRequest = {
  zapperApiUrl: string
  chainId: number
  tokenIn: Address
  tokenInDecimals: number
  tokenInPrice: number | null
  amountIn: string
  tokenOut: Address
  tokenOutPrice: number | null
  slippage: number
  forceMint: boolean
  deepLiquidity: boolean
}

export type QuoteRow = {
  result: ZapResult
  endpoint: string
  durationMs: number
}

/**
 * Values both sides of the quote from Reserve prices (input token price and the
 * DTF's own price), the same way the widget does — provider values only stand
 * in when a Reserve price is missing.
 */
const priceQuote = (result: ZapResult, request: QuoteRequest): ZapResult => {
  const { tokenInPrice, tokenInDecimals, tokenOutPrice } = request
  const amountInValue =
    tokenInPrice != null
      ? tokenInPrice *
        Number(formatUnits(BigInt(result.amountIn || 0), tokenInDecimals))
      : result.amountInValue
  const amountOutValue =
    tokenOutPrice != null
      ? tokenOutPrice *
        Number(formatUnits(BigInt(result.amountOut || 0), DTF_DECIMALS))
      : result.amountOutValue

  const bothPriced =
    amountInValue != null && amountInValue > 0 && amountOutValue != null
  if (!bothPriced) return { ...result, amountInValue, amountOutValue }

  return {
    ...result,
    amountInValue,
    amountOutValue,
    priceImpact: ((amountInValue - amountOutValue) / amountInValue) * 100,
    truePriceImpact:
      ((amountInValue - amountOutValue - (result.dustValue ?? 0)) /
        amountInValue) *
      100,
  }
}

export const buildZapEndpoint = (request: QuoteRequest): string =>
  zapper.zap({
    url: request.zapperApiUrl,
    chainId: request.chainId,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    amountIn: request.amountIn,
    slippage: request.slippage,
    signer: PLACEHOLDER_SIGNER,
    trade: !request.forceMint,
    deepLiquidity: request.deepLiquidity,
  })

/**
 * Display-only mint quote: the placeholder signer keeps the response free of
 * anything executable, so no wallet is needed to watch the table.
 */
export const fetchZapQuote = async (
  request: QuoteRequest
): Promise<QuoteRow> => {
  const endpoint = buildZapEndpoint(request)

  await acquire()
  const startedAt = Date.now()
  try {
    const response = await fetch(endpoint)
    // The zapper answers routing failures with an error body and a 4xx/5xx, so
    // the body is read either way — it carries the actionable reason.
    const data: ZapResponse | null = await response.json().catch(() => null)
    if (data?.status === 'error' || !data?.result) {
      throw new Error(
        data?.error || `zap error: ${response.status} ${response.statusText}`
      )
    }
    return {
      result: priceQuote(data.result, request),
      endpoint,
      durationMs: Date.now() - startedAt,
    }
  } finally {
    release()
  }
}
