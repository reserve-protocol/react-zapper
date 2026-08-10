import { getAddress } from 'viem'

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

export function formatToSignificantDigits(
  value: number,
  digits = 4,
  options: Intl.NumberFormatOptions = {}
): string {
  return value >= 1
    ? Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options,
      }).format(value)
    : Intl.NumberFormat('en-US', {
        maximumSignificantDigits: digits,
        ...options,
      }).format(value)
}

export function formatSignedPercentage(value: number) {
  return (
    (Math.sign(value) > 0 ? '+' : '') +
    value.toLocaleString('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
  )
}

export function formatShortAddress(addr: string) {
  try {
    const checksumed = getAddress(addr)
    return checksumed.slice(0, 6) + '...' + addr.slice(-4)
  } catch {
    return addr.slice(0, 6) + '...' + addr.slice(-4)
  }
}

export const formatPercentage = (value: number, decimals = 2): string =>
  (value / 100).toLocaleString('en-US', {
    style: 'percent',
    maximumFractionDigits: decimals,
  })

// Main output amount: <1 → up to 6 decimals, ≥1 → up to 2, trailing zeros
// trimmed. Values that would round to 0 fall back to 4 significant digits.
// No grouping — the value renders inside a numeric input.
export function formatOutputAmount(value: number): string {
  if (!isFinite(value) || value === 0) return '0'
  const formatted = Intl.NumberFormat('en-US', {
    maximumFractionDigits: value < 1 ? 6 : 2,
    useGrouping: false,
  }).format(value)
  if (Number(formatted) === 0) {
    return Intl.NumberFormat('en-US', {
      maximumSignificantDigits: 4,
      useGrouping: false,
    }).format(value)
  }
  return formatted
}

// 45 → "45s", 72 → "1m 12s", 3900 → "1h 5m" (seconds dropped at hour scale)
export function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const s = seconds % 60
    return s > 0 ? `${minutes}m ${s}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${hours}h ${m}m` : `${hours}h`
}
