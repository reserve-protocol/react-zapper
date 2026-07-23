import type { Address, Hex, TypedDataDomain } from 'viem'
import type { ZapResult } from '../../types/api'
import type { ProviderId } from '../providers'

export type RfqAvailability = {
  chainId: number
  tokenIn: Address
  tokenOut: Address
}

export type RfqQuoteContext = {
  chainId: number
  account: Address
  tokenIn: Address
  tokenOut: Address
  /** Input amount in atoms. */
  amountIn: string
  /** Reserve slippage convention: a value S means a fraction of 1/S (100 => 1%). */
  slippage: number
  /** USD value of the input, estimated client-side (RFQ APIs don't price in USD). */
  amountInValue: number | null
  tokenOutPrice: number | null
  tokenOutDecimals: number | null
  readAllowance: (
    token: Address,
    owner: Address,
    spender: Address
  ) => Promise<bigint>
}

/**
 * Provider-specific order payload carried inside `ZapResult.rfq`. Adapters
 * extend it with whatever they need to build and submit the order later.
 */
export type RfqOrder = {
  adapter: ProviderId
  chainId: number
}

export type RfqTypedData = {
  domain: TypedDataDomain
  types: Record<string, { name: string; type: string }[]>
  primaryType: string
  message: Record<string, unknown>
}

export type RfqPreparedOrder =
  | {
      /** Gasless order: the user signs typed data, then `submitOrder` posts it. */
      mode: 'signature'
      typedData: RfqTypedData
      /** Order expiry as unix seconds — also the fill-polling deadline. */
      validTo: number
    }
  | {
      /**
       * On-chain-placed order (e.g. CoW eth-flow for native sells): the user
       * sends this transaction; the venue indexes the order from the event, so
       * there is no submit call — the uid is precomputed.
       */
      mode: 'transaction'
      tx: { to: Address; data: Hex; value: bigint }
      orderUid: string
      validTo: number
    }

export type RfqOrderStatus =
  | { state: 'open' }
  | { state: 'fulfilled'; executedBuyAmount: bigint; txHash?: string }
  | { state: 'expired' }
  | { state: 'cancelled' }

/**
 * A quote source that resolves through a signed off-chain order (an intent
 * filled by solvers) instead of an atomic transaction. CowSwap implements it
 * today; PancakeSwap X is expected to be the next adapter.
 */
export interface RfqAdapter {
  id: ProviderId
  isAvailable(ctx: RfqAvailability): boolean
  /** User-facing reason why `isAvailable` is false (explicit source selection). */
  unavailableReason(ctx: RfqAvailability): string | null
  /** Stable pseudo-endpoint used for tracking and the endpoint atom. */
  describeEndpoint(chainId: number): string
  /** Fetches a quote normalized to `ZapResult` (`tx: null`, `rfq` payload set). */
  fetchQuote(ctx: RfqQuoteContext): Promise<ZapResult>
  /**
   * Bakes the order expiry and submission payload at click time. May hit the
   * network (uid collision checks, app-data upload) but never moves funds.
   */
  prepareOrder(order: RfqOrder): Promise<RfqPreparedOrder>
  /** Posts a signed order ('signature' mode only); resolves to the order uid. */
  submitOrder(
    order: RfqOrder,
    prepared: RfqPreparedOrder,
    signature: Hex,
    account: Address
  ): Promise<string>
  getOrderStatus(chainId: number, orderUid: string): Promise<RfqOrderStatus>
  orderExplorerUrl(chainId: number, orderUid: string): string
  /**
   * Message to surface when the order dies unfilled (expired/timeout) — e.g.
   * eth-flow's "your funds will be refunded automatically". Null when the
   * outcome needs no explanation (gasless orders cost nothing).
   */
  expiryNotice?(order: RfqOrder): string | null
}
