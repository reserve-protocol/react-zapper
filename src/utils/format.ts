export function formatCurrency(
  value: number,
  decimals = 2,
  options: Intl.NumberFormatOptions = {}
): string {
  return Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.min(2, decimals),
    ...options,
  }).format(value)
}

export function formatTokenAmount(value: number) {
  return value < 1
    ? formatCurrency(value, 0, {
        maximumSignificantDigits: 4,
        notation: 'compact',
        compactDisplay: 'short',
      })
    : formatCurrency(value, 2, {
        minimumFractionDigits: 0,
        notation: 'compact',
        compactDisplay: 'short',
      })
}

export const formatPercentage = (value: number, decimals = 2): string =>
  (value / 100).toLocaleString('en-US', {
    style: 'percent',
    maximumFractionDigits: decimals,
  })
