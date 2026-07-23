import { ethAddress, formatUnits, type Address, type Hex } from 'viem'
import type { ZapResult } from '../../types/api'
import { ChainId } from '../chains'
import { applySlippage } from './cowswap'
import type {
  RfqAdapter,
  RfqAvailability,
  RfqOrder,
  RfqQuoteContext,
} from './types'

// PCSX (PancakeSwap X): intent/RFQ Dutch orders signed via Permit2, proxied
// through the Reserve API (`{apiUrl}pcsx/*`). The quote response carries the
// ready-to-sign permitData and the encoded order — no PancakeSwap SDK needed.
const PCSX_CHAINS: number[] = [ChainId.BSC]

export type PcsxPermitData = {
  domain: {
    name?: string
    version?: string
    chainId?: number
    verifyingContract: Address
  }
  types: Record<string, { name: string; type: string }[]>
  values: Record<string, unknown>
}

export type PcsxRfqOrder = RfqOrder & {
  adapter: 'pcsx'
  apiUrl: string
  encodedOrder: Hex
  permitData: PcsxPermitData
  /** Order deadline as unix seconds. */
  deadline: number
  /** Price-API quote id — the order-handler requires it for V3 orders. */
  quoteId: string | null
}

type PcsxQuoteResponse = {
  status: 'success' | 'error'
  error?: string
  result?: {
    available: boolean
    amountOut?: string
    minAmountOut?: string
    validUntil?: number | null
    order?: {
      amountOut: string
      minAmountOut?: string
      deadline: number | null
      encodedOrder: string
      permitData: PcsxPermitData
      quoteId?: string
      requestId?: string
    }
  }
}

const isNativeToken = (token: Address): boolean =>
  token.toLowerCase() === ethAddress.toLowerCase()

const quoteEndpoint = (apiUrl: string, chainId: number): string =>
  `${apiUrl}pcsx/quote?chainId=${chainId}`

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  const body = (await response.json().catch(() => undefined)) as
    | (T & { status?: string; error?: string })
    | undefined
  if (!response.ok || body?.status === 'error') {
    throw new Error(body?.error ?? `PancakeSwap X request failed (${response.status})`)
  }
  if (!body) throw new Error('PancakeSwap X returned an empty response')
  return body
}

export const pcsxAdapter: RfqAdapter = {
  id: 'pcsx',

  isAvailable: (ctx: RfqAvailability) =>
    PCSX_CHAINS.includes(ctx.chainId) && !isNativeToken(ctx.tokenIn),

  unavailableReason: (ctx: RfqAvailability) => {
    if (!PCSX_CHAINS.includes(ctx.chainId)) {
      return 'PancakeSwap X is only available on BNB Chain'
    }
    if (isNativeToken(ctx.tokenIn)) {
      return 'PancakeSwap X cannot sell the native token — select an ERC-20 input (e.g. WBNB) or another quote source'
    }
    return null
  },

  describeEndpoint: (chainId, apiUrl) =>
    quoteEndpoint(apiUrl ?? 'https://api.reserve.org/', chainId),

  fetchQuote: async (ctx: RfqQuoteContext): Promise<ZapResult> => {
    const url =
      `${quoteEndpoint(ctx.apiUrl, ctx.chainId)}` +
      `&tokenIn=${ctx.tokenIn}&tokenOut=${ctx.tokenOut}` +
      `&amountIn=${ctx.amountIn}&signer=${ctx.account}&slippage=${ctx.slippage}`
    const { result } = await fetchJson<PcsxQuoteResponse>(url)

    if (!result?.available) {
      throw new Error('PancakeSwap X has no quote for this trade')
    }
    const order = result.order
    if (!order?.encodedOrder || !order.permitData?.domain?.verifyingContract) {
      throw new Error('PancakeSwap X returned no signable order for this trade')
    }

    // Spender is Permit2 — taken from the order's own typed-data domain.
    const permit2 = order.permitData.domain.verifyingContract
    const allowance = await ctx.readAllowance(ctx.tokenIn, ctx.account, permit2)

    const buyAmount = BigInt(order.amountOut)
    const minAmountOut = order.minAmountOut
      ? BigInt(order.minAmountOut)
      : applySlippage(buyAmount, ctx.slippage)

    const amountOutValue =
      ctx.tokenOutPrice != null && ctx.tokenOutDecimals != null
        ? ctx.tokenOutPrice *
          Number(formatUnits(buyAmount, ctx.tokenOutDecimals))
        : null
    const amountInValue = ctx.amountInValue
    const priceImpact =
      amountInValue != null && amountOutValue != null && amountInValue > 0
        ? ((amountInValue - amountOutValue) / amountInValue) * 100
        : 0

    const rfq: PcsxRfqOrder = {
      adapter: 'pcsx',
      chainId: ctx.chainId,
      apiUrl: ctx.apiUrl,
      encodedOrder: order.encodedOrder as Hex,
      permitData: order.permitData,
      deadline: order.deadline ?? Math.floor(Date.now() / 1000) + 120,
      quoteId: order.quoteId ?? null,
    }

    return {
      tokenIn: ctx.tokenIn,
      amountIn: ctx.amountIn,
      amountInValue,
      tokenOut: ctx.tokenOut,
      amountOut: order.amountOut,
      amountOutValue,
      minAmountOut: minAmountOut.toString(),
      approvalAddress: permit2,
      approvalNeeded: allowance < BigInt(ctx.amountIn),
      insufficientFunds: false,
      dust: [],
      dustValue: null,
      gas: null,
      priceImpact,
      truePriceImpact: priceImpact,
      tx: null,
      validUntil: rfq.deadline,
      rfq,
    }
  },

  prepareOrder: async (order) => {
    const pcsx = order as PcsxRfqOrder
    return {
      mode: 'signature',
      validTo: pcsx.deadline,
      typedData: {
        // Pancake's own UI re-stamps the chainId onto the permit domain.
        domain: { ...pcsx.permitData.domain, chainId: pcsx.chainId },
        types: pcsx.permitData.types,
        primaryType: 'PermitWitnessTransferFrom',
        message: pcsx.permitData.values,
      },
    }
  },

  submitOrder: async (order, _prepared, signature) => {
    const pcsx = order as PcsxRfqOrder
    const { result } = await fetchJson<{
      status: string
      result?: { hash?: string }
    }>(`${pcsx.apiUrl}pcsx/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: pcsx.chainId,
        encodedOrder: pcsx.encodedOrder,
        signature,
        ...(pcsx.quoteId ? { quoteId: pcsx.quoteId } : {}),
      }),
    })
    if (!result?.hash) {
      throw new Error('PancakeSwap X order submission returned no hash')
    }
    return result.hash
  },

  getOrderStatus: async (order, orderUid) => {
    const pcsx = order as PcsxRfqOrder
    const { result } = await fetchJson<{
      status: string
      result?: { status?: string; transactionHash?: string | null }
    }>(`${pcsx.apiUrl}pcsx/order/${pcsx.chainId}/${orderUid}`)

    switch (result?.status) {
      case 'FILLED':
        // The order-handler doesn't report executed amounts — the success view
        // falls back to the quoted amountOut when this is 0.
        return {
          state: 'fulfilled',
          executedBuyAmount: 0n,
          txHash: result.transactionHash ?? undefined,
        }
      case 'EXPIRED':
        return { state: 'expired' }
      default:
        return { state: 'open' }
    }
  },

  // PCSX has no public order explorer; the success view links the fill tx.
  orderExplorerUrl: () => '',
}
