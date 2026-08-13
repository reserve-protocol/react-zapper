import { Address, formatUnits } from 'viem'
import zapper, { ZapResponse, ZapResult } from '@/types/api'
import {
  classifyEstimateGasError,
  SIMULATION_TIMEOUT_MS,
  SimulationTimeoutError,
} from '@/hooks/zap-quote-simulation'

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
  /**
   * The connected wallet when there is one, otherwise the placeholder signer.
   * A real signer is what makes the response executable (`tx`, real `gas`,
   * `approvalNeeded`, `insufficientFunds`) and therefore simulatable.
   */
  signer: Address
}

export type Simulation =
  | { status: 'ok' }
  | { status: 'reverted'; error: string }
  /** Nothing was proven about the quote — the reason says why. */
  | { status: 'unverifiable'; reason: string }

/** `estimateGas` against the quote's own tx; the wallet is never touched. */
export type SimulateTx = (tx: NonNullable<ZapResult['tx']>) => Promise<void>

/**
 * A quote valued from the Reserve price API only, so every figure below is
 * `null` whenever the API has no price for one of the two sides.
 */
export type PricedResult = Omit<
  ZapResult,
  'amountInValue' | 'amountOutValue' | 'priceImpact' | 'truePriceImpact'
> & {
  amountInValue: number | null
  amountOutValue: number | null
  priceImpact: number | null
  truePriceImpact: number | null
}

export type QuoteRow = {
  result: PricedResult
  endpoint: string
  durationMs: number
  simulation: Simulation | null
}

/**
 * Values both sides of the quote from Reserve API prices (the input token price
 * and the DTF's price, both from `current/prices`). The zapper's own
 * `amountInValue` / `amountOutValue` / impacts are never used: the table exists
 * to judge the zapper's routing, so its numbers can't be the yardstick.
 * A missing API price leaves the row's values and impacts empty.
 */
const priceQuote = (result: ZapResult, request: QuoteRequest): PricedResult => {
  const { tokenInPrice, tokenInDecimals, tokenOutPrice } = request
  const amountInValue =
    tokenInPrice != null
      ? tokenInPrice *
        Number(formatUnits(BigInt(result.amountIn || 0), tokenInDecimals))
      : null
  const amountOutValue =
    tokenOutPrice != null
      ? tokenOutPrice *
        Number(formatUnits(BigInt(result.amountOut || 0), DTF_DECIMALS))
      : null

  const bothPriced =
    amountInValue != null && amountInValue > 0 && amountOutValue != null
  if (!bothPriced) {
    return {
      ...result,
      amountInValue,
      amountOutValue,
      priceImpact: null,
      truePriceImpact: null,
    }
  }

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

/**
 * Single-quote flavour of `filterQuotesBySimulation`: the table wants to *show*
 * why a row is unproven, not silently keep it, so the outcome is reported
 * instead of collapsed into keep/drop.
 */
const simulateQuote = async (
  result: ZapResult,
  simulate: SimulateTx
): Promise<Simulation> => {
  if (!result.tx) return { status: 'unverifiable', reason: 'no transaction' }
  // Without the approval in place the swap tx is guaranteed to revert, so the
  // simulation would say nothing about the quote itself.
  if (result.approvalNeeded) {
    return { status: 'unverifiable', reason: 'approval needed' }
  }
  if (result.insufficientFunds) {
    return { status: 'unverifiable', reason: 'insufficient balance' }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new SimulationTimeoutError('simulation timed out')),
        SIMULATION_TIMEOUT_MS
      )
    })
    const run = simulate(result.tx)
    run.catch(() => {})
    await Promise.race([run, timeout])
    return { status: 'ok' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return classifyEstimateGasError(error) === 'revert'
      ? { status: 'reverted', error: message }
      : { status: 'unverifiable', reason: message.split('\n')[0] }
  } finally {
    clearTimeout(timer)
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
    signer: request.signer,
    trade: !request.forceMint,
    deepLiquidity: request.deepLiquidity,
  })

/**
 * Fetches one mint quote and, when a simulator is supplied (i.e. a wallet is
 * connected), checks whether its transaction would actually go through.
 * With the placeholder signer the response carries nothing executable, so the
 * table works read-only with no wallet at all.
 */
export const fetchZapQuote = async (
  request: QuoteRequest,
  simulate?: SimulateTx
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
    const durationMs = Date.now() - startedAt
    return {
      result: priceQuote(data.result, request),
      endpoint,
      durationMs,
      simulation: simulate ? await simulateQuote(data.result, simulate) : null,
    }
  } finally {
    release()
  }
}
