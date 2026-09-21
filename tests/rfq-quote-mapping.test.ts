/**
 * Unit tests for the CoW RFQ adapter's pure pieces: slippage math, quote
 * normalization (fee folding, validUntil, approval), availability rules, and
 * the eth-flow order uid computation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ethAddress, type Address } from 'viem'
import type { OrderQuoteResponse } from '@cowprotocol/cow-sdk'

import {
  applySlippage,
  computeEthFlowOrderUid,
  cowswapAdapter,
  mapCowQuoteToZapResult,
  oneInchFusionAdapter,
  pcsxAdapter,
  type CowRfqOrder,
  type OneInchFusionRfqOrder,
} from '../src/utils/rfq'
import type { RfqQuoteContext } from '../src/utils/rfq/types'

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address
const DTF = '0x1000000000000000000000000000000000000001' as Address
const ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address
const VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'
const ETH_FLOW = '0xba3cb449bd2b4adddbc894d8697f5170800eadec'

const makeResponse = (
  overrides: Partial<OrderQuoteResponse['quote']> = {}
): OrderQuoteResponse =>
  ({
    quote: {
      sellToken: WETH,
      buyToken: DTF,
      receiver: ACCOUNT,
      sellAmount: '990000000000000000',
      buyAmount: '1000000000000000000000',
      validTo: 0,
      appData: `0x${'00'.repeat(32)}`,
      feeAmount: '10000000000000000',
      kind: 'sell',
      partiallyFillable: false,
      ...overrides,
    },
    from: ACCOUNT,
    expiration: '2026-07-22T12:00:00.000Z',
    id: 42,
    verified: true,
  }) as OrderQuoteResponse

const makeCtx = (overrides: Partial<RfqQuoteContext> = {}): RfqQuoteContext => ({
  chainId: 1,
  account: ACCOUNT,
  tokenIn: WETH,
  tokenOut: DTF,
  amountIn: '1000000000000000000',
  slippage: 100,
  apiUrl: 'https://api.reserve.org/',
  readAllowance: async () => 0n,
  ...overrides,
})

describe('applySlippage', () => {
  it('applies the 1/S convention', () => {
    expect(applySlippage(1000n, 100)).toBe(990n) // 1%
    expect(applySlippage(10_000n, 200)).toBe(9950n) // 0.5%
  })

  it('supports fractional S values', () => {
    // S = 0.5 => 200% slippage, clamped to 100%
    expect(applySlippage(1000n, 0.5)).toBe(0n)
  })

  it('leaves the amount untouched on invalid S', () => {
    expect(applySlippage(1000n, 0)).toBe(1000n)
    expect(applySlippage(1000n, NaN)).toBe(1000n)
  })
})

describe('mapCowQuoteToZapResult', () => {
  it('normalizes the quote with the fee folded into the sell amount', () => {
    const result = mapCowQuoteToZapResult(makeResponse(), makeCtx(), {
      approvalNeeded: false,
      flow: 'gasless',
    })

    expect(result.tx).toBeNull()
    expect(result.gas).toBeNull()
    expect(result.amountOut).toBe('1000000000000000000000')
    expect(result.minAmountOut).toBe('990000000000000000000') // 1% slippage
    expect(result.approvalAddress).toBe(VAULT_RELAYER)
    expect(result.approvalNeeded).toBe(false)
    expect(result.validUntil).toBe(Date.parse('2026-07-22T12:00:00.000Z'))

    const rfq = result.rfq as CowRfqOrder
    expect(rfq.adapter).toBe('cowswap')
    expect(rfq.flow).toBe('gasless')
    // 0.99 net + 0.01 fee = the original input amount
    expect(rfq.sellAmount).toBe('1000000000000000000')
    // the signed limit is the slippage-discounted buy amount
    expect(rfq.buyAmount).toBe('990000000000000000000')
    expect(rfq.quoteId).toBe(42)
  })

  it('passes through the approvalNeeded verdict', () => {
    expect(
      mapCowQuoteToZapResult(makeResponse(), makeCtx(), {
        approvalNeeded: true,
        flow: 'gasless',
      }).approvalNeeded
    ).toBe(true)
  })

  it('targets the EthFlow contract for eth-flow quotes', () => {
    const result = mapCowQuoteToZapResult(
      makeResponse(),
      makeCtx({ tokenIn: ethAddress }),
      { approvalNeeded: false, flow: 'ethflow' }
    )
    expect(result.approvalAddress.toLowerCase()).toBe(ETH_FLOW)
    expect(result.approvalNeeded).toBe(false)
    // ZapResult keeps the native sentinel; the rfq payload keeps the wrapped
    expect(result.tokenIn).toBe(ethAddress)
    expect((result.rfq as CowRfqOrder).flow).toBe('ethflow')
    expect((result.rfq as CowRfqOrder).sellToken).toBe(WETH)
  })

  it('leaves USD values empty — the pipeline fills them with Reserve prices', () => {
    const result = mapCowQuoteToZapResult(makeResponse(), makeCtx(), {
      approvalNeeded: false,
      flow: 'gasless',
    })
    expect(result.amountInValue).toBeNull()
    expect(result.amountOutValue).toBeNull()
    expect(result.priceImpact).toBe(0)
    expect(result.truePriceImpact).toBe(0)
  })
})

describe('cowswap availability', () => {
  it('accepts native sells (routed via eth-flow)', () => {
    const ctx = { chainId: 1, tokenIn: ethAddress, tokenOut: DTF }
    expect(cowswapAdapter.isAvailable(ctx)).toBe(true)
    expect(cowswapAdapter.unavailableReason(ctx)).toBeNull()
  })

  it('accepts ERC-20 sells on supported chains, native buys included', () => {
    expect(
      cowswapAdapter.isAvailable({ chainId: 1, tokenIn: WETH, tokenOut: DTF })
    ).toBe(true)
    expect(
      cowswapAdapter.isAvailable({ chainId: 56, tokenIn: WETH, tokenOut: DTF })
    ).toBe(true)
    expect(
      cowswapAdapter.isAvailable({
        chainId: 8453,
        tokenIn: WETH,
        tokenOut: ethAddress,
      })
    ).toBe(true)
  })

  it('rejects chains outside the CoW deployment set', () => {
    // Optimism has no CoW deployment
    const ctx = { chainId: 10, tokenIn: WETH, tokenOut: DTF }
    expect(cowswapAdapter.isAvailable(ctx)).toBe(false)
    expect(cowswapAdapter.unavailableReason(ctx)).toMatch(/not available/i)
  })
})

describe('eth-flow order uid', () => {
  const order = {
    chainId: 1,
    sellToken: WETH,
    buyToken: DTF,
    receiver: ACCOUNT,
    sellAmount: '1000000000000000000',
  }

  it('packs digest + EthFlow owner + uint32.max validTo (56 bytes)', () => {
    const uid = computeEthFlowOrderUid(order, 990n * 10n ** 18n, ETH_FLOW as Address)
    expect(uid).toMatch(/^0x[0-9a-f]{112}$/i)
    // owner segment = the EthFlow contract
    expect(uid.slice(66, 106).toLowerCase()).toBe(ETH_FLOW.slice(2))
    // validTo segment = uint32.max
    expect(uid.slice(106)).toBe('ffffffff')
  })

  it('changes when buyAmount changes (collision nudge works)', () => {
    const a = computeEthFlowOrderUid(order, 1000n, ETH_FLOW as Address)
    const b = computeEthFlowOrderUid(order, 999n, ETH_FLOW as Address)
    expect(a).not.toBe(b)
  })
})

describe('pcsx availability', () => {
  it('accepts ERC-20 sells on BSC only', () => {
    expect(
      pcsxAdapter.isAvailable({ chainId: 56, tokenIn: WETH, tokenOut: DTF })
    ).toBe(true)
    const mainnetCtx = { chainId: 1, tokenIn: WETH, tokenOut: DTF }
    expect(pcsxAdapter.isAvailable(mainnetCtx)).toBe(false)
    expect(pcsxAdapter.unavailableReason(mainnetCtx)).toMatch(/BNB Chain/i)
  })

  it('rejects native sells (Permit2 requires an ERC-20 input)', () => {
    const ctx = { chainId: 56, tokenIn: ethAddress, tokenOut: DTF }
    expect(pcsxAdapter.isAvailable(ctx)).toBe(false)
    expect(pcsxAdapter.unavailableReason(ctx)).toMatch(/WBNB/)
  })
})

describe('expiryNotice', () => {
  const base = {
    adapter: 'cowswap',
    chainId: 56,
    sellToken: WETH,
    buyToken: DTF,
    receiver: ACCOUNT,
    sellAmount: '1',
    buyAmount: '1',
    appData: '0x',
    quoteId: null,
  }

  it('explains the automatic refund for eth-flow orders', () => {
    const notice = cowswapAdapter.expiryNotice!({
      ...base,
      flow: 'ethflow',
    } as CowRfqOrder)
    expect(notice).toMatch(/refund/i)
    expect(notice).toMatch(/BNB/)
  })

  it('stays silent for gasless orders', () => {
    expect(
      cowswapAdapter.expiryNotice!({ ...base, flow: 'gasless' } as CowRfqOrder)
    ).toBeNull()
  })
})

describe('1inch Fusion adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  const LOP = '0x111111125421ca6dc452d289314280a0f8842a65'
  const FACTORY = '0xe12e0f117d23a5ccc57f8935cd8c4e80cd91ff01'
  const serverQuote = {
    available: true,
    amountOut: '1000000000000000000000',
    minAmountOut: '990000000000000000000',
    approvalAddress: LOP,
    approvalNeeded: true,
    insufficientFunds: true,
    validUntil: 1_790_000_149,
  }
  const signable = {
    kind: 'signature',
    orderHash: `0x${'cd'.repeat(32)}`,
    quoteId: 'q-1',
    order: { salt: '1', maker: ACCOUNT },
    extension: '0x0d',
    deadline: 1_790_000_209,
    typedData: {
      domain: { name: '1inch Aggregation Router', version: '6', chainId: 56, verifyingContract: LOP },
      types: { Order: [{ name: 'salt', type: 'uint256' }] },
      primaryType: 'Order',
      message: { salt: '1' },
    },
  }
  const respond = (result: unknown) => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ status: 'success', result }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('accepts ERC-20 and native sells on the four supported chains', () => {
    for (const chainId of [1, 8453, 42161, 56]) {
      expect(oneInchFusionAdapter.isAvailable({ chainId, tokenIn: WETH, tokenOut: DTF })).toBe(true)
      expect(oneInchFusionAdapter.isAvailable({ chainId, tokenIn: ethAddress, tokenOut: DTF })).toBe(true)
    }
    const polygon = { chainId: 137, tokenIn: WETH, tokenOut: DTF }
    expect(oneInchFusionAdapter.isAvailable(polygon)).toBe(false)
    expect(oneInchFusionAdapter.unavailableReason(polygon)).toMatch(/not available on this chain/i)
  })

  it('maps the server quote: its floor, spender and wallet flags, no USD values, the order as the rfq payload', async () => {
    const fetchMock = respond({ ...serverQuote, order: signable })

    const quote = await oneInchFusionAdapter.fetchQuote(makeCtx({ chainId: 56 }))

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.reserve.org/1inch/fusion/quote?chainId=56&tokenIn=${WETH}&tokenOut=${DTF}&amountIn=1000000000000000000&slippage=100&signer=${ACCOUNT}`
    )
    expect(quote).toMatchObject({
      amountOut: serverQuote.amountOut,
      minAmountOut: serverQuote.minAmountOut,
      approvalAddress: LOP,
      approvalNeeded: true,
      insufficientFunds: true,
      amountInValue: null,
      amountOutValue: null,
      priceImpact: 0,
      truePriceImpact: 0,
      gas: null,
      tx: null,
      validUntil: serverQuote.validUntil,
    })
    expect(quote.rfq).toMatchObject({
      adapter: '1inch',
      chainId: 56,
      kind: 'signature',
      quoteId: 'q-1',
      minAmountOut: serverQuote.minAmountOut,
      request: { account: ACCOUNT, tokenIn: WETH, tokenOut: DTF, amountIn: '1000000000000000000', slippage: 100 },
    })
  })

  it('asks for an indicative quote without a wallet: no signer, nothing executable', async () => {
    const fetchMock = respond({ ...serverQuote, approvalNeeded: false, insufficientFunds: false, validUntil: null })

    const quote = await oneInchFusionAdapter.fetchQuote(makeCtx({ chainId: 56, signerIsPlaceholder: true }))

    expect(String(fetchMock.mock.calls[0][0])).not.toContain('signer=')
    expect(quote.rfq).toBeUndefined()
    expect(quote.approvalNeeded).toBe(false)
    expect(quote.minAmountOut).toBe(serverQuote.minAmountOut)
  })

  it('surfaces the reason when 1inch cannot quote, and refuses a signer quote with nothing to sign', async () => {
    respond({ available: false, reason: 'insufficient liquidity' })
    await expect(oneInchFusionAdapter.fetchQuote(makeCtx({ chainId: 56 }))).rejects.toThrow('insufficient liquidity')

    respond(serverQuote)
    await expect(oneInchFusionAdapter.fetchQuote(makeCtx({ chainId: 56 }))).rejects.toThrow(/no order/i)
  })

  const displayed = {
    adapter: '1inch',
    chainId: 56,
    apiUrl: 'https://api.reserve.org/',
    ...signable,
    minAmountOut: serverQuote.minAmountOut,
    request: { account: ACCOUNT, tokenIn: WETH, tokenOut: DTF, amountIn: '1000000000000000000', slippage: 100 },
  } as OneInchFusionRfqOrder
  const fresh = {
    ...signable,
    orderHash: `0x${'ef'.repeat(32)}`,
    quoteId: 'q-2',
    deadline: signable.deadline + 40,
    typedData: { ...signable.typedData, message: { salt: '2' } },
  }

  it('re-quotes at click time and signs the fresh order: a Fusion auction starts seconds after the order is built', async () => {
    const fetchMock = respond({ ...serverQuote, order: fresh })

    const prepared = await oneInchFusionAdapter.prepareOrder(displayed)

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.reserve.org/1inch/fusion/quote?chainId=56&tokenIn=${WETH}&tokenOut=${DTF}&amountIn=1000000000000000000&slippage=100&signer=${ACCOUNT}`
    )
    expect(prepared).toMatchObject({ mode: 'signature', typedData: fresh.typedData, validTo: fresh.deadline })
  })

  it('relays the fresh order, not the displayed one', async () => {
    respond({ ...serverQuote, order: fresh })
    const prepared = await oneInchFusionAdapter.prepareOrder(displayed)
    const relayed: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      relayed.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ status: 'success', result: { orderHash: fresh.orderHash } }))
    }))

    const uid = await oneInchFusionAdapter.submitOrder(displayed, prepared, '0xabc', ACCOUNT)

    expect(uid).toBe(fresh.orderHash)
    expect(relayed[0]).toMatchObject({ quoteId: 'q-2', signature: '0xabc' })
  })

  it('accepts a fresh floor a hair below the displayed minimum, but not a real price move', async () => {
    const floor = BigInt(serverQuote.minAmountOut)
    respond({ ...serverQuote, minAmountOut: ((floor * 9_995n) / 10_000n).toString(), order: fresh })
    await expect(oneInchFusionAdapter.prepareOrder(displayed)).resolves.toMatchObject({ mode: 'signature' })

    respond({ ...serverQuote, minAmountOut: ((floor * 9_980n) / 10_000n).toString(), order: fresh })
    await expect(oneInchFusionAdapter.prepareOrder(displayed)).rejects.toThrow(/price moved/i)
  })

  it('does not sign when 1inch can no longer quote the trade', async () => {
    respond({ available: false, reason: 'insufficient liquidity' })

    await expect(oneInchFusionAdapter.prepareOrder(displayed)).rejects.toThrow('insufficient liquidity')
  })

  it('explains the refund for native orders only', () => {
    expect(oneInchFusionAdapter.expiryNotice!(displayed)).toBeNull()
    const native = { ...displayed, kind: 'native', tx: { to: FACTORY, data: '0x', value: '1' } }
    expect(oneInchFusionAdapter.expiryNotice!(native as OneInchFusionRfqOrder)).toMatch(/refund your BNB/i)
    expect(oneInchFusionAdapter.expiryNotice!({ ...native, chainId: 1 } as OneInchFusionRfqOrder)).toMatch(/refund your ETH/i)
  })
})
