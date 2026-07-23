/**
 * Unit tests for the CoW RFQ adapter's pure pieces: slippage math, quote
 * normalization (fee folding, validUntil, approval), availability rules, and
 * the eth-flow order uid computation.
 */
import { describe, expect, it } from 'vitest'
import { ethAddress, type Address } from 'viem'
import type { OrderQuoteResponse } from '@cowprotocol/cow-sdk'

import {
  applySlippage,
  computeEthFlowOrderUid,
  cowswapAdapter,
  mapCowQuoteToZapResult,
  pcsxAdapter,
  type CowRfqOrder,
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
  amountInValue: 3000,
  tokenOutPrice: 3,
  tokenOutDecimals: 18,
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

  it('fills USD values from the client context, impact 0 when missing', () => {
    const priced = mapCowQuoteToZapResult(makeResponse(), makeCtx(), {
      approvalNeeded: false,
      flow: 'gasless',
    })
    expect(priced.amountInValue).toBe(3000)
    expect(priced.amountOutValue).toBe(3000) // 1000 tokens * $3
    expect(priced.priceImpact).toBeCloseTo(0)

    const unpriced = mapCowQuoteToZapResult(
      makeResponse(),
      makeCtx({ tokenOutPrice: null }),
      { approvalNeeded: false, flow: 'gasless' }
    )
    expect(unpriced.amountOutValue).toBeNull()
    expect(unpriced.priceImpact).toBe(0)
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
