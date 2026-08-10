import type { ZapResult } from '../types/api'

/**
 * Max projected slippage (%): the dust-adjusted loss vs. the input value if
 * the trade executes at exactly `minAmountOut`, valuing the output at the
 * quote's own unit price. Conceptually `projected slippage + tolerance`, but
 * derived from `minAmountOut` so it stays truthful for venues that supply
 * their own minimum (e.g. PCSX Dutch orders).
 */
export const computeMaxSlippage = (result: ZapResult): number | null => {
  const { amountInValue, amountOutValue } = result
  if (amountInValue == null || amountInValue <= 0 || amountOutValue == null) {
    return null
  }
  let amountOut: bigint
  let minAmountOut: bigint
  try {
    amountOut = BigInt(result.amountOut || 0)
    minAmountOut = BigInt(result.minAmountOut || 0)
  } catch {
    return null
  }
  if (amountOut <= 0n || minAmountOut <= 0n) return null

  const minOutValue =
    amountOutValue * (Number(minAmountOut) / Number(amountOut))
  return (
    ((amountInValue - minOutValue - (result.dustValue ?? 0)) / amountInValue) *
    100
  )
}
