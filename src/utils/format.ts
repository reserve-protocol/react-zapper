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
