/**
 * Unit tests for the central quote-value normalization: every source's USD
 * values and price impact are recomputed from Reserve prices, with the
 * provider-reported values kept as fallbacks.
 */
import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'

import {
  applyReservePricing,
  type QuotePricing,
} from '../src/hooks/zap-quote-providers'
import type { ZapResult } from '../src/types/api'

const baseResult = (overrides: Partial<ZapResult> = {}): ZapResult => ({
  tokenIn: '0x1111111111111111111111111111111111111111' as Address,
  amountIn: '1000000000000000000', // 1.0 (18d)
  amountInValue: 2900, // provider's own valuation (methodology differs)
  tokenOut: '0x2222222222222222222222222222222222222222' as Address,
  amountOut: '900000000', // 900 (6d)
  amountOutValue: 2850,
  minAmountOut: '890000000',
  approvalAddress: '0x3333333333333333333333333333333333333333' as Address,
  approvalNeeded: false,
  insufficientFunds: false,
  dust: [],
  dustValue: null,
  gas: null,
  priceImpact: 1.7,
  truePriceImpact: 1.5,
  tx: null,
  ...overrides,
})

const pricing = (overrides: Partial<QuotePricing> = {}): QuotePricing => ({
  tokenInPrice: 3000,
  tokenInDecimals: 18,
  tokenOutPrice: 3.3,
  tokenOutDecimals: 6,
  ...overrides,
})

describe('applyReservePricing', () => {
  it('recomputes values and impacts from Reserve prices', () => {
    const result = applyReservePricing(baseResult(), pricing())

    expect(result.amountInValue).toBe(3000) // 1.0 * $3000
    expect(result.amountOutValue).toBeCloseTo(2970) // 900 * $3.3
    expect(result.priceImpact).toBeCloseTo(1) // (3000-2970)/3000
    expect(result.truePriceImpact).toBeCloseTo(1) // no dust
  })

  it('subtracts the quoted dust value from truePriceImpact', () => {
    const result = applyReservePricing(
      baseResult({ dustValue: 15 }),
      pricing()
    )
    expect(result.priceImpact).toBeCloseTo(1)
    expect(result.truePriceImpact).toBeCloseTo(0.5) // (3000-2970-15)/3000
  })

  it('falls back per side and keeps provider impacts when a price is missing', () => {
    const noOutPrice = applyReservePricing(
      baseResult(),
      pricing({ tokenOutPrice: null })
    )
    expect(noOutPrice.amountInValue).toBe(3000) // normalized side
    expect(noOutPrice.amountOutValue).toBe(2850) // provider fallback
    expect(noOutPrice.priceImpact).toBe(1.7) // provider fallback
    expect(noOutPrice.truePriceImpact).toBe(1.5)

    const noInPrice = applyReservePricing(
      baseResult(),
      pricing({ tokenInPrice: null })
    )
    expect(noInPrice.amountInValue).toBe(2900)
    expect(noInPrice.amountOutValue).toBeCloseTo(2970)
    expect(noInPrice.truePriceImpact).toBe(1.5)
  })

  it('returns the result untouched without a pricing context', () => {
    const original = baseResult()
    expect(applyReservePricing(original, undefined)).toBe(original)
  })

  it('can report negative impact (positive surplus)', () => {
    const result = applyReservePricing(
      baseResult({ amountOut: '1000000000' }), // 1000 out * $3.3 = $3300
      pricing()
    )
    expect(result.truePriceImpact).toBeCloseTo(-10) // got more value than sent
  })
})
