import { describe, expect, it } from 'vitest'
import { formatIskInputUnit, parseIskInputUnit } from '@/lib/profit'

describe('formatIskInputUnit', () => {
  it('splits 5B into amount and unit for split input display', () => {
    expect(formatIskInputUnit(5_000_000_000)).toEqual({ amount: '5', unit: 'B' })
  })

  it('formats millions for sub-billion values', () => {
    expect(formatIskInputUnit(50_000_000)).toEqual({ amount: '50', unit: 'M' })
  })
})

describe('parseIskInputUnit', () => {
  it('defaults plain numbers to millions', () => {
    expect(parseIskInputUnit('5')).toBe(5_000_000)
  })

  it('parses plain numbers as billions when defaultUnit is B', () => {
    expect(parseIskInputUnit('5', 'B')).toBe(5_000_000_000)
  })

  it('parses explicit B suffix as billions regardless of defaultUnit', () => {
    expect(parseIskInputUnit('5b')).toBe(5_000_000_000)
    expect(parseIskInputUnit('5B', 'M')).toBe(5_000_000_000)
  })

  it('round-trips split display values (focus regression: 5 + B unit)', () => {
    const { amount, unit } = formatIskInputUnit(5_000_000_000)
    expect(amount).toBe('5')
    expect(unit).toBe('B')
    expect(parseIskInputUnit(amount, unit)).toBe(5_000_000_000)
  })
})
