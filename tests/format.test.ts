import { describe, expect, it } from 'vitest'

import { formatElapsedTime, formatOutputAmount } from '../src/utils/format'

describe('formatOutputAmount', () => {
  it('shows up to 2 decimals at or above 1', () => {
    expect(formatOutputAmount(1234.5678)).toBe('1234.57')
    expect(formatOutputAmount(2)).toBe('2')
    expect(formatOutputAmount(1.5)).toBe('1.5')
  })

  it('shows up to 6 decimals below 1, trimming zeros', () => {
    expect(formatOutputAmount(0.123456789)).toBe('0.123457')
    expect(formatOutputAmount(0.5)).toBe('0.5')
    expect(formatOutputAmount(0.000123)).toBe('0.000123')
  })

  it('falls back to significant digits when 6 decimals round to 0', () => {
    expect(formatOutputAmount(0.000000123456)).toBe('0.0000001235')
    expect(formatOutputAmount(2e-9)).toBe('0.000000002')
  })

  it('handles zero and non-finite values', () => {
    expect(formatOutputAmount(0)).toBe('0')
    expect(formatOutputAmount(NaN)).toBe('0')
    expect(formatOutputAmount(Infinity)).toBe('0')
  })

  it('never uses grouping separators (renders inside a numeric input)', () => {
    expect(formatOutputAmount(1234567.89)).toBe('1234567.89')
  })
})

describe('formatElapsedTime', () => {
  it('shows plain seconds under a minute', () => {
    expect(formatElapsedTime(1)).toBe('1s')
    expect(formatElapsedTime(59)).toBe('59s')
  })

  it('rolls over to minutes and seconds', () => {
    expect(formatElapsedTime(60)).toBe('1m')
    expect(formatElapsedTime(72)).toBe('1m 12s')
    expect(formatElapsedTime(3599)).toBe('59m 59s')
  })

  it('drops seconds at hour scale', () => {
    expect(formatElapsedTime(3600)).toBe('1h')
    expect(formatElapsedTime(3900)).toBe('1h 5m')
    expect(formatElapsedTime(7322)).toBe('2h 2m')
  })
})
