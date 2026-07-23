import {
  BuyTokenDestination,
  COW_EIP712_TYPES,
  COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS,
  COW_PROTOCOL_VAULT_RELAYER_ADDRESS,
  ETH_FLOW_ADDRESSES,
  EthFlowAbi,
  MAX_VALID_TO_EPOCH,
  ORDER_PRIMARY_TYPE,
  OrderBookApi,
  OrderKind,
  OrderQuoteSideKindSell,
  OrderStatus,
  SellTokenSource,
  SigningScheme,
  SupportedChainId,
  WRAPPED_NATIVE_CURRENCIES,
  type OrderQuoteRequest,
  type OrderQuoteResponse,
} from '@cowprotocol/cow-sdk'
import {
  encodeFunctionData,
  encodePacked,
  ethAddress,
  formatUnits,
  hashTypedData,
  keccak256,
  stringToBytes,
  type Abi,
  type Address,
  type Hex,
  type TypedDataDomain,
} from 'viem'
import type { ZapResult } from '../../types/api'
import type {
  RfqAdapter,
  RfqAvailability,
  RfqOrder,
  RfqPreparedOrder,
  RfqQuoteContext,
} from './types'

/** Gasless (EIP-712) order validity. */
export const COWSWAP_ORDER_VALIDITY_SECONDS = 120
/**
 * Eth-flow (native sell) order validity. Longer on purpose: an expired
 * eth-flow order leaves the funds in the EthFlow contract until CoW's
 * refunder returns them, so expiring is costly UX-wise.
 */
export const ETHFLOW_ORDER_VALIDITY_SECONDS = 600

// Chains where the zapper offers CoW Swap; all use the canonical deployment.
const COWSWAP_CHAINS: number[] = [
  SupportedChainId.MAINNET,
  SupportedChainId.BASE,
  SupportedChainId.ARBITRUM_ONE,
  SupportedChainId.BNB,
]

const EXPLORER_SLUGS: Record<number, string> = {
  [SupportedChainId.MAINNET]: '',
  [SupportedChainId.BASE]: 'base/',
  [SupportedChainId.ARBITRUM_ONE]: 'arb1/',
  [SupportedChainId.BNB]: 'bnb/',
}

const NATIVE_SYMBOL: Record<number, string> = {
  [SupportedChainId.MAINNET]: 'ETH',
  [SupportedChainId.BASE]: 'ETH',
  [SupportedChainId.ARBITRUM_ONE]: 'ETH',
  [SupportedChainId.BNB]: 'BNB',
}

// App-data doc registered with every order. The order book requires the full
// JSON for on-chain (eth-flow) orders — uploaded in prepareOrder — while the
// hash is what goes into the order struct.
export const COWSWAP_APP_DATA =
  '{"appCode":"reserve-react-zapper","metadata":{},"version":"1.3.0"}'
export const COWSWAP_APP_DATA_HASH = keccak256(stringToBytes(COWSWAP_APP_DATA))

export type CowRfqOrder = RfqOrder & {
  adapter: 'cowswap'
  /** 'gasless' = signed EIP-712 order; 'ethflow' = native sell placed on-chain. */
  flow: 'gasless' | 'ethflow'
  /** For 'ethflow' this is the wrapped native token (the quote/hash use it). */
  sellToken: Address
  buyToken: Address
  receiver: Address
  /** Fee folded in: quote.sellAmount + quote.feeAmount (= the input amount). */
  sellAmount: string
  /** Slippage-discounted buy amount — the signed limit. */
  buyAmount: string
  /** As echoed by the quote: either a bytes32 hash or a full JSON doc. */
  appData: string
  quoteId: number | null
}

const orderBookApis = new Map<number, OrderBookApi>()
const getOrderBookApi = (chainId: number): OrderBookApi => {
  let api = orderBookApis.get(chainId)
  if (!api) {
    api = new OrderBookApi({ chainId: chainId as SupportedChainId })
    orderBookApis.set(chainId, api)
  }
  return api
}

const isNativeToken = (token: Address): boolean =>
  token.toLowerCase() === ethAddress.toLowerCase()

const gpv2Domain = (chainId: number): TypedDataDomain => ({
  name: 'Gnosis Protocol',
  version: 'v2',
  chainId,
  verifyingContract: COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS[
    chainId as SupportedChainId
  ] as Address,
})

const SLIPPAGE_PRECISION = 1_000_000n

/** Applies the Reserve slippage convention (S => 1/S) to an amount. */
export const applySlippage = (amount: bigint, slippage: number): bigint => {
  if (!Number.isFinite(slippage) || slippage <= 0) return amount
  const fraction = BigInt(
    Math.min(
      Number(SLIPPAGE_PRECISION),
      Math.max(0, Math.round(1e6 / slippage))
    )
  )
  return (amount * (SLIPPAGE_PRECISION - fraction)) / SLIPPAGE_PRECISION
}

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/

// The EIP-712 `appData` field is always the bytes32 hash; the order-book API
// accepts either the hash (legacy) or the full JSON doc + its hash.
const appDataParts = (appData: string) => {
  if (BYTES32_RE.test(appData)) {
    return { typedAppData: appData, sendAppData: appData, sendAppDataHash: undefined }
  }
  const hash = keccak256(stringToBytes(appData))
  return { typedAppData: hash, sendAppData: appData, sendAppDataHash: hash }
}

/** Pure mapping from a CoW quote to the zapper's normalized quote shape. */
export const mapCowQuoteToZapResult = (
  response: OrderQuoteResponse,
  ctx: RfqQuoteContext,
  opts: { approvalNeeded: boolean; flow: 'gasless' | 'ethflow' }
): ZapResult => {
  const { quote } = response
  const sellAmount = BigInt(quote.sellAmount) + BigInt(quote.feeAmount)
  const buyAmount = BigInt(quote.buyAmount)
  const minAmountOut = applySlippage(buyAmount, ctx.slippage)

  const amountOutValue =
    ctx.tokenOutPrice != null && ctx.tokenOutDecimals != null
      ? ctx.tokenOutPrice * Number(formatUnits(buyAmount, ctx.tokenOutDecimals))
      : null
  const amountInValue = ctx.amountInValue
  // USD values are client-estimated; when either is missing the impact is
  // unknown and reported as 0 (no high-impact warning for this source then).
  const priceImpact =
    amountInValue != null && amountOutValue != null && amountInValue > 0
      ? ((amountInValue - amountOutValue) / amountInValue) * 100
      : 0

  const rfq: CowRfqOrder = {
    adapter: 'cowswap',
    chainId: ctx.chainId,
    flow: opts.flow,
    sellToken: quote.sellToken as Address,
    buyToken: quote.buyToken as Address,
    receiver: ctx.account,
    sellAmount: sellAmount.toString(),
    buyAmount: minAmountOut.toString(),
    appData: String(quote.appData),
    quoteId: response.id ?? null,
  }

  return {
    tokenIn: ctx.tokenIn,
    amountIn: ctx.amountIn,
    amountInValue,
    tokenOut: ctx.tokenOut,
    amountOut: quote.buyAmount,
    amountOutValue,
    minAmountOut: minAmountOut.toString(),
    approvalAddress: (opts.flow === 'ethflow'
      ? ETH_FLOW_ADDRESSES[ctx.chainId as SupportedChainId]
      : COW_PROTOCOL_VAULT_RELAYER_ADDRESS[
          ctx.chainId as SupportedChainId
        ]) as Address,
    approvalNeeded: opts.approvalNeeded,
    insufficientFunds: false,
    dust: [],
    dustValue: null,
    gas: null,
    priceImpact,
    truePriceImpact: priceImpact,
    tx: null,
    validUntil: Date.parse(response.expiration) || null,
    rfq,
  }
}

const fetchEthFlowQuote = async (ctx: RfqQuoteContext): Promise<ZapResult> => {
  const api = getOrderBookApi(ctx.chainId)
  const wrapped = WRAPPED_NATIVE_CURRENCIES[ctx.chainId as SupportedChainId]
    .address as Address
  const response = await api.getQuote({
    sellToken: wrapped,
    buyToken: ctx.tokenOut,
    sellAmountBeforeFee: ctx.amountIn,
    kind: OrderQuoteSideKindSell.SELL,
    from: ctx.account,
    receiver: ctx.account,
    // eth-flow orders are placed on-chain by the EthFlow contract (EIP-1271)
    signingScheme: SigningScheme.EIP1271,
    onchainOrder: true,
    verificationGasLimit: 0,
    appData: COWSWAP_APP_DATA,
    appDataHash: COWSWAP_APP_DATA_HASH,
  } as OrderQuoteRequest)
  // No approval ever: the native amount travels with the createOrder tx.
  return mapCowQuoteToZapResult(response, ctx, {
    approvalNeeded: false,
    flow: 'ethflow',
  })
}

/**
 * Order uid of an eth-flow order, computed client-side (there is no sendOrder;
 * the backend indexes the on-chain event). The hashed struct uses the WRAPPED
 * native as sellToken and uint32.max as validTo, and the uid owner is the
 * EthFlow contract — the user validTo only lives in the createOrder arg.
 */
export const computeEthFlowOrderUid = (
  order: Pick<CowRfqOrder, 'chainId' | 'sellToken' | 'buyToken' | 'receiver' | 'sellAmount'>,
  buyAmount: bigint,
  ethFlowAddress: Address
): Hex => {
  const orderDigest = hashTypedData({
    domain: gpv2Domain(order.chainId),
    types: COW_EIP712_TYPES,
    primaryType: ORDER_PRIMARY_TYPE,
    message: {
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      receiver: order.receiver,
      sellAmount: BigInt(order.sellAmount),
      buyAmount,
      validTo: MAX_VALID_TO_EPOCH,
      appData: COWSWAP_APP_DATA_HASH,
      feeAmount: 0n,
      kind: 'sell',
      partiallyFillable: false,
      sellTokenBalance: 'erc20',
      buyTokenBalance: 'erc20',
    },
  })
  return encodePacked(
    ['bytes32', 'address', 'uint32'],
    [orderDigest, ethFlowAddress, MAX_VALID_TO_EPOCH]
  )
}

const prepareEthFlowOrder = async (
  cow: CowRfqOrder
): Promise<RfqPreparedOrder> => {
  const api = getOrderBookApi(cow.chainId)
  const ethFlowAddress = ETH_FLOW_ADDRESSES[
    cow.chainId as SupportedChainId
  ] as Address
  const validTo =
    Math.floor(Date.now() / 1000) + ETHFLOW_ORDER_VALIDITY_SECONDS

  // The order book needs the full app-data doc to index the on-chain order.
  // Idempotent PUT; failing here aborts before any funds move.
  await api.uploadAppData(COWSWAP_APP_DATA_HASH, COWSWAP_APP_DATA)

  // Identical eth-flow orders collide on the same uid (the on-chain validTo is
  // always uint32.max) — nudge buyAmount down until unused, like the CoW SDK.
  let buyAmount = BigInt(cow.buyAmount)
  let orderUid = computeEthFlowOrderUid(cow, buyAmount, ethFlowAddress)
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await api
      .getOrder(orderUid)
      .then(() => true)
      .catch(() => false)
    if (!exists) break
    buyAmount -= 1n
    orderUid = computeEthFlowOrderUid(cow, buyAmount, ethFlowAddress)
  }

  const data = encodeFunctionData({
    abi: EthFlowAbi as Abi,
    functionName: 'createOrder',
    args: [
      {
        buyToken: cow.buyToken,
        receiver: cow.receiver,
        sellAmount: BigInt(cow.sellAmount),
        buyAmount,
        appData: COWSWAP_APP_DATA_HASH,
        feeAmount: 0n,
        validTo,
        partiallyFillable: false,
        quoteId: BigInt(cow.quoteId ?? 0),
      },
    ],
  })

  return {
    mode: 'transaction',
    tx: { to: ethFlowAddress, data, value: BigInt(cow.sellAmount) },
    orderUid,
    validTo,
  }
}

export const cowswapAdapter: RfqAdapter = {
  id: 'cowswap',

  isAvailable: (ctx: RfqAvailability) => COWSWAP_CHAINS.includes(ctx.chainId),

  unavailableReason: (ctx: RfqAvailability) =>
    COWSWAP_CHAINS.includes(ctx.chainId)
      ? null
      : 'CoW Swap is not available on this network',

  describeEndpoint: (chainId) => `https://api.cow.fi/quote?chainId=${chainId}`,

  fetchQuote: async (ctx) => {
    if (isNativeToken(ctx.tokenIn)) return fetchEthFlowQuote(ctx)

    const api = getOrderBookApi(ctx.chainId)
    const vaultRelayer = COW_PROTOCOL_VAULT_RELAYER_ADDRESS[
      ctx.chainId as SupportedChainId
    ] as Address
    const [response, allowance] = await Promise.all([
      api.getQuote({
        sellToken: ctx.tokenIn,
        buyToken: ctx.tokenOut,
        sellAmountBeforeFee: ctx.amountIn,
        kind: OrderQuoteSideKindSell.SELL,
        from: ctx.account,
        receiver: ctx.account,
        signingScheme: SigningScheme.EIP712,
      }),
      ctx.readAllowance(ctx.tokenIn, ctx.account, vaultRelayer),
    ])
    const sellAmount =
      BigInt(response.quote.sellAmount) + BigInt(response.quote.feeAmount)
    return mapCowQuoteToZapResult(response, ctx, {
      approvalNeeded: allowance < sellAmount,
      flow: 'gasless',
    })
  },

  prepareOrder: async (order) => {
    const cow = order as CowRfqOrder
    if (cow.flow === 'ethflow') return prepareEthFlowOrder(cow)

    const validTo =
      Math.floor(Date.now() / 1000) + COWSWAP_ORDER_VALIDITY_SECONDS
    const { typedAppData } = appDataParts(cow.appData)
    return {
      mode: 'signature',
      validTo,
      typedData: {
        domain: gpv2Domain(cow.chainId),
        types: COW_EIP712_TYPES,
        primaryType: ORDER_PRIMARY_TYPE,
        message: {
          sellToken: cow.sellToken,
          buyToken: cow.buyToken,
          receiver: cow.receiver,
          sellAmount: cow.sellAmount,
          buyAmount: cow.buyAmount,
          validTo,
          appData: typedAppData,
          feeAmount: '0',
          kind: 'sell',
          partiallyFillable: false,
          sellTokenBalance: 'erc20',
          buyTokenBalance: 'erc20',
        },
      },
    }
  },

  submitOrder: async (order, prepared, signature, account) => {
    const cow = order as CowRfqOrder
    if (prepared.mode !== 'signature') {
      throw new Error('eth-flow orders are placed on-chain, not submitted')
    }
    const { sendAppData, sendAppDataHash } = appDataParts(cow.appData)
    return getOrderBookApi(cow.chainId).sendOrder({
      sellToken: cow.sellToken,
      buyToken: cow.buyToken,
      receiver: cow.receiver,
      sellAmount: cow.sellAmount,
      buyAmount: cow.buyAmount,
      validTo: prepared.validTo,
      feeAmount: '0',
      kind: OrderKind.SELL,
      partiallyFillable: false,
      sellTokenBalance: SellTokenSource.ERC20,
      buyTokenBalance: BuyTokenDestination.ERC20,
      signingScheme: SigningScheme.EIP712,
      signature,
      from: account,
      quoteId: cow.quoteId,
      appData: sendAppData,
      ...(sendAppDataHash ? { appDataHash: sendAppDataHash } : {}),
    })
  },

  getOrderStatus: async (order, orderUid) => {
    const api = getOrderBookApi(order.chainId)
    const cowOrder = await api.getOrder(orderUid)
    if (cowOrder.status === OrderStatus.FULFILLED) {
      let txHash: string | undefined
      try {
        const trades = await api.getTrades({ orderUid })
        txHash = trades.find((t) => t.txHash)?.txHash ?? undefined
      } catch {
        // best-effort — the explorer link still covers it
      }
      return {
        state: 'fulfilled',
        executedBuyAmount: BigInt(cowOrder.executedBuyAmount || 0),
        txHash,
      }
    }
    if (cowOrder.status === OrderStatus.EXPIRED) return { state: 'expired' }
    if (cowOrder.status === OrderStatus.CANCELLED) return { state: 'cancelled' }
    return { state: 'open' }
  },

  orderExplorerUrl: (chainId, orderUid) =>
    `https://explorer.cow.fi/${EXPLORER_SLUGS[chainId] ?? ''}orders/${orderUid}`,

  expiryNotice: (order) => {
    const cow = order as CowRfqOrder
    if (cow.flow !== 'ethflow') return null
    const native = NATIVE_SYMBOL[cow.chainId] ?? 'funds'
    return `The order expired without filling — CoW Protocol will automatically refund your ${native} within a few minutes.`
  },
}
