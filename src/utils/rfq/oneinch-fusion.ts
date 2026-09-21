import { zeroAddress, type Address, type Hex } from 'viem'
import type { ZapResult } from '../../types/api'
import { ChainId } from '../chains'
import type {
  RfqAdapter,
  RfqAvailability,
  RfqOrder,
  RfqPreparedOrder,
  RfqQuoteContext,
  RfqTypedData,
} from './types'

// 1inch Fusion (intent mode): a resolver fills a limit order, which reaches
// liquidity 1inch's Classic router cannot (pools gated to allowlisted senders).
// Everything goes through the Reserve API (`{apiUrl}1inch/fusion/*`): the 1inch
// key stays server-side and the order is built there, so there is no 1inch SDK
// here. An ERC-20 sale is signed (gasless); a native sale is placed on-chain
// through 1inch's factory, which escrows the amount until the fill or refund.
const FUSION_CHAINS: number[] = [
  ChainId.Mainnet,
  ChainId.Base,
  ChainId.Arbitrum,
  ChainId.BSC,
]

const NATIVE_SYMBOL: Record<number, string> = { [ChainId.BSC]: 'BNB' }

// How far the click-time quote's floor may sit below the minimum that was on
// screen (market noise between two quotes) before the click is refused.
const REQUOTE_TOLERANCE_BPS = 10n

export type OneInchFusionRfqOrder = RfqOrder & {
  adapter: '1inch'
  apiUrl: string
  kind: 'signature' | 'native'
  orderHash: string
  quoteId: string
  /** LimitOrderV4Struct; goes back unchanged with `extension` on submit. */
  order: Record<string, string>
  extension: Hex
  /** Order deadline as unix seconds. */
  deadline: number
  typedData?: RfqTypedData
  /** Native orders only: the relayer signature the API computed. */
  signature?: Hex
  tx?: { to: Address; data: Hex; value: string }
  /** The floor shown to the user and what was quoted, to re-quote on click. */
  minAmountOut: string
  request: FusionQuoteRequest
}

type FusionQuoteRequest = {
  account: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: string
  slippage: number
}

// The order actually signed or placed is the one re-quoted at click time; it
// rides on the prepared order so `submitOrder` relays that one.
type FusionPreparedOrder = RfqPreparedOrder & { fusion: OneInchFusionRfqOrder }

type FusionQuoteResponse = {
  status: 'success' | 'error'
  error?: string
  result?: {
    available: boolean
    reason?: string
    amountOut?: string
    minAmountOut?: string
    approvalAddress?: Address
    approvalNeeded?: boolean
    insufficientFunds?: boolean
    validUntil?: number | null
    order?: Omit<
      OneInchFusionRfqOrder,
      'adapter' | 'chainId' | 'apiUrl' | 'minAmountOut' | 'request'
    >
  }
}

type FusionQuote = NonNullable<FusionQuoteResponse['result']> & {
  amountOut: string
  minAmountOut: string
}

const quoteEndpoint = (apiUrl: string, chainId: number): string =>
  `${apiUrl}1inch/fusion/quote?chainId=${chainId}`

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  const body = (await response.json().catch(() => undefined)) as
    | (T & { status?: string; error?: string })
    | undefined
  if (!response.ok || body?.status === 'error') {
    throw new Error(body?.error ?? `1inch request failed (${response.status})`)
  }
  if (!body) throw new Error('1inch returned an empty response')
  return body
}

// Without a signer the API answers an indicative quote: pricing only, nothing
// to sign or send.
const requestQuote = async (
  apiUrl: string,
  chainId: number,
  request: FusionQuoteRequest,
  withSigner: boolean
): Promise<FusionQuote> => {
  const url =
    `${quoteEndpoint(apiUrl, chainId)}` +
    `&tokenIn=${request.tokenIn}&tokenOut=${request.tokenOut}` +
    `&amountIn=${request.amountIn}&slippage=${request.slippage}` +
    (withSigner ? `&signer=${request.account}` : '')
  const { result } = await fetchJson<FusionQuoteResponse>(url)

  if (!result?.available || !result.amountOut || !result.minAmountOut) {
    throw new Error(result?.reason ?? '1inch has no quote for this trade')
  }
  if (withSigner && !result.order) {
    throw new Error('1inch returned no order for this trade')
  }
  return result as FusionQuote
}

const toRfqOrder = (
  quote: FusionQuote,
  apiUrl: string,
  chainId: number,
  request: FusionQuoteRequest
): OneInchFusionRfqOrder | undefined =>
  quote.order && {
    ...quote.order,
    adapter: '1inch',
    chainId,
    apiUrl,
    minAmountOut: quote.minAmountOut,
    request,
  }

// A Fusion order's auction starts seconds after the order is built, and
// resolvers take it right then. The quote on screen can be a minute old by the
// time an approval confirmed and the user clicked, so the order that is signed
// or placed is built now, never the displayed one.
const requote = async (
  displayed: OneInchFusionRfqOrder
): Promise<OneInchFusionRfqOrder> => {
  const quote = await requestQuote(
    displayed.apiUrl,
    displayed.chainId,
    displayed.request,
    true
  )
  const accepted =
    (BigInt(displayed.minAmountOut) * (10_000n - REQUOTE_TOLERANCE_BPS)) /
    10_000n
  if (BigInt(quote.minAmountOut) < accepted) {
    throw new Error('The 1inch price moved. Review the refreshed quote and try again.')
  }
  return toRfqOrder(quote, displayed.apiUrl, displayed.chainId, displayed.request)!
}

const relayOrder = async (
  fusion: OneInchFusionRfqOrder,
  signature: Hex
): Promise<string> => {
  const { result } = await fetchJson<{
    status: string
    result?: { orderHash?: string }
  }>(`${fusion.apiUrl}1inch/fusion/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainId: fusion.chainId,
      order: fusion.order,
      extension: fusion.extension,
      quoteId: fusion.quoteId,
      signature,
    }),
  })
  // the API hashes the order itself: a mismatch means it relayed another one
  if (result?.orderHash !== fusion.orderHash) {
    throw new Error('1inch relayed an order other than the quoted one')
  }
  return fusion.orderHash
}

export const oneInchFusionAdapter: RfqAdapter = {
  id: '1inch',

  isAvailable: (ctx: RfqAvailability) => FUSION_CHAINS.includes(ctx.chainId),

  unavailableReason: (ctx: RfqAvailability) =>
    FUSION_CHAINS.includes(ctx.chainId)
      ? null
      : '1inch is not available on this chain',

  describeEndpoint: (chainId, apiUrl) =>
    quoteEndpoint(apiUrl ?? 'https://api.reserve.org/', chainId),

  fetchQuote: async (ctx: RfqQuoteContext): Promise<ZapResult> => {
    const request: FusionQuoteRequest = {
      account: ctx.account,
      tokenIn: ctx.tokenIn,
      tokenOut: ctx.tokenOut,
      amountIn: ctx.amountIn,
      slippage: ctx.slippage,
    }
    const result = await requestQuote(
      ctx.apiUrl,
      ctx.chainId,
      request,
      !ctx.signerIsPlaceholder
    )
    const rfq = toRfqOrder(result, ctx.apiUrl, ctx.chainId, request)

    // The auction never settles below `minAmountOut`. USD values and price
    // impact are filled in centrally (`applyReservePricing`).
    return {
      tokenIn: ctx.tokenIn,
      amountIn: ctx.amountIn,
      amountInValue: null,
      tokenOut: ctx.tokenOut,
      amountOut: result.amountOut,
      amountOutValue: null,
      minAmountOut: result.minAmountOut,
      approvalAddress: rfq ? (result.approvalAddress ?? zeroAddress) : zeroAddress,
      approvalNeeded: rfq ? (result.approvalNeeded ?? false) : false,
      insufficientFunds: rfq ? (result.insufficientFunds ?? false) : false,
      dust: [],
      dustValue: null,
      gas: null,
      priceImpact: 0,
      truePriceImpact: 0,
      tx: null,
      validUntil: result.validUntil ?? null,
      ...(rfq ? { rfq } : {}),
    }
  },

  prepareOrder: async (order): Promise<FusionPreparedOrder> => {
    const fusion = await requote(order as OneInchFusionRfqOrder)
    if (fusion.kind === 'signature') {
      if (!fusion.typedData) throw new Error('1inch order has nothing to sign')
      return {
        mode: 'signature',
        typedData: fusion.typedData,
        validTo: fusion.deadline,
        fusion,
      }
    }

    if (!fusion.tx || !fusion.signature) {
      throw new Error('1inch native order is missing its transaction')
    }
    // 1inch wants the order registered before the funds reach its escrow
    const orderUid = await relayOrder(fusion, fusion.signature)
    return {
      mode: 'transaction',
      tx: {
        to: fusion.tx.to,
        data: fusion.tx.data,
        value: BigInt(fusion.tx.value),
      },
      orderUid,
      validTo: fusion.deadline,
      fusion,
    }
  },

  submitOrder: async (_order, prepared, signature) => {
    if (prepared.mode !== 'signature') {
      throw new Error('1inch native orders are placed on-chain, not submitted')
    }
    return relayOrder((prepared as FusionPreparedOrder).fusion, signature)
  },

  getOrderStatus: async (order, orderUid) => {
    const fusion = order as OneInchFusionRfqOrder
    const { result } = await fetchJson<{
      status: string
      result?: {
        status?: string
        executedBuyAmount?: string | null
        txHash?: string | null
      }
    }>(`${fusion.apiUrl}1inch/fusion/order/${fusion.chainId}/${orderUid}`)

    switch (result?.status) {
      case 'fulfilled':
        return {
          state: 'fulfilled',
          executedBuyAmount: BigInt(result.executedBuyAmount ?? 0),
          txHash: result.txHash ?? undefined,
        }
      case 'expired':
        return { state: 'expired' }
      case 'cancelled':
        return { state: 'cancelled' }
      default:
        return { state: 'open' }
    }
  },

  // 1inch has no public order explorer; the success view links the fill tx.
  orderExplorerUrl: () => '',

  expiryNotice: (order) => {
    const fusion = order as OneInchFusionRfqOrder
    if (fusion.kind !== 'native') return null
    const symbol = NATIVE_SYMBOL[fusion.chainId] ?? 'ETH'
    return `1inch resolvers normally refund your ${symbol} in full within a few minutes. If it does not arrive, the order can be cancelled from the same wallet to reclaim it.`
  },
}
