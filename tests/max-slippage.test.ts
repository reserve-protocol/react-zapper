/**
 * Regression guard for the "Max slippage" detail (requested by Nevin): the
 * number shown to the user is derived from the quote's minAmountOut, but it
 * must agree with the conceptual definition `projected slippage + tolerance`.
 * If the two methodologies diverge on a standard quote, this fails loudly.
 *
 * Venue-supplied minimums (e.g. PCSX Dutch orders) are the deliberate
 * exception: there minAmountOut does not come from our tolerance, and the
 * derived number is the truthful one.
 */
import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'

import { computeMaxSlippage } from '../src/utils/slippage'
import {
  applyReservePricing,
  type QuotePricing,
} from '../src/hooks/zap-quote-providers'
import type { ZapResult } from '../src/types/api'

const pricing: QuotePricing = {
  tokenInPrice: 3000,
  tokenInDecimals: 18,
  tokenOutPrice: 3.3,
  tokenOutDecimals: 6,
}

// A quote whose minAmountOut comes from applying `tolerance` to amountOut —
// the standard shape for every aggregator provider.
const makeQuote = (
  tolerancePct: number,
  overrides: Partial<ZapResult> = {}
): ZapResult => {
  const amountOut = 900_000_000n // 900 (6d)
  const minAmountOut =
    (amountOut * BigInt(Math.round((100 - tolerancePct) * 1000))) / 100_000n
  return {
    tokenIn: '0x1111111111111111111111111111111111111111' as Address,
    amountIn: '1000000000000000000', // 1.0 (18d)
    amountInValue: null,
    tokenOut: '0x2222222222222222222222222222222222222222' as Address,
    amountOut: amountOut.toString(),
    amountOutValue: null,
    minAmountOut: minAmountOut.toString(),
    approvalAddress: '0x3333333333333333333333333333333333333333' as Address,
    approvalNeeded: false,
    insufficientFunds: false,
    dust: [],
    dustValue: null,
    gas: null,
    priceImpact: 0,
    truePriceImpact: 0,
    tx: null,
    ...overrides,
  }
}

describe('Max slippage consistency (min-amount-out vs projected + tolerance)', () => {
  it.each([0.1, 0.5, 1, 5])(
    'matches projected + tolerance within epsilon at %s%% tolerance',
    (tolerance) => {
      const quote = applyReservePricing(makeQuote(tolerance), pricing)
      const projected = quote.truePriceImpact! // % — Reserve-priced
      const priceImpact = quote.priceImpact! // % — without dust adjustment

      const maxSlippage = computeMaxSlippage(quote)!
      expect(maxSlippage).not.toBeNull()

      // exact identity: max = projected + tolerance × (1 − priceImpact)
      const expected = projected + tolerance * (1 - priceImpact / 100)
      expect(Math.abs(maxSlippage - expected)).toBeLessThan(0.01)
      // and the intuitive approximation holds: max ≈ projected + tolerance
      expect(Math.abs(maxSlippage - (projected + tolerance))).toBeLessThan(0.1)
    }
  )

  it('stays consistent when the quote carries dust', () => {
    const tolerance = 0.5
    const quote = applyReservePricing(
      makeQuote(tolerance, { dustValue: 15 }),
      pricing
    )
    const maxSlippage = computeMaxSlippage(quote)!
    const expected =
      quote.truePriceImpact! + tolerance * (1 - quote.priceImpact! / 100)
    expect(Math.abs(maxSlippage - expected)).toBeLessThan(0.01)
  })

  it('reports the venue-supplied minimum truthfully (PCSX-style Dutch order)', () => {
    // minAmountOut set by the venue: 2% below amountOut regardless of our
    // 0.5% tolerance — the derived number must reflect the venue's 2%.
    const quote = applyReservePricing(
      makeQuote(0.5, { minAmountOut: '882000000' }), // 900 × 0.98
      pricing
    )
    const projected = quote.truePriceImpact!
    const maxSlippage = computeMaxSlippage(quote)!
    expect(maxSlippage).toBeGreaterThan(projected + 1.5)
    expect(Math.abs(maxSlippage - (projected + 2 * (1 - quote.priceImpact! / 100)))).toBeLessThan(0.01)
  })

  it('returns null without pricing or amounts', () => {
    expect(computeMaxSlippage(makeQuote(0.5))).toBeNull() // no USD values
    expect(
      computeMaxSlippage(
        applyReservePricing(makeQuote(0.5, { amountOut: '0' }), pricing)
      )
    ).toBeNull()
  })
})
