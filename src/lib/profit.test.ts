import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MarketHistoryEntry } from '@/types'
import { filterHistoryByRange, formatIskInputUnit, parseIskInputUnit, trimHistoryByDays } from '@/lib/profit'

function historyEntry(date: string, average = 100): MarketHistoryEntry {
  return { date, average, highest: average, lowest: average, volume: 10 }
}

describe('trimHistoryByDays', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to the latest trading day when ESI daily rows miss the rolling window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T15:00:00Z'))

    const history = [historyEntry('2026-06-19'), historyEntry('2026-06-20', 74_000)]

    expect(trimHistoryByDays(history, 1)).toEqual([historyEntry('2026-06-20', 74_000)])
  })

  it('keeps rows inside the rolling window when they exist', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T15:00:00Z'))

    const history = [historyEntry('2026-06-19'), historyEntry('2026-06-21', 80_000)]

    expect(trimHistoryByDays(history, 1)).toEqual([historyEntry('2026-06-21', 80_000)])
  })
})

describe('filterHistoryByRange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the latest trading day for 1d when ESI has not published today yet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T15:00:00Z'))

    const history = [historyEntry('2026-06-20', 74_000)]

    expect(filterHistoryByRange(history, '1d')).toEqual([historyEntry('2026-06-20', 74_000)])
  })
})

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
