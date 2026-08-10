import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MarketHistoryEntry } from '@/types'
import { filterHistoryByRange, formatDuration, formatDurationHms, formatGraphQuantity, formatGraphUnitIsk, formatIsk, formatIskInputUnit, formatVolumeM3, parseDurationHms, parseIskInputUnit, trimHistoryByDays } from '@/lib/profit'

function historyEntry(date: string, average = 100): MarketHistoryEntry {
  return { date, average, highest: average, lowest: average, volume: 10, orderCount: 3 }
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

describe('formatGraphQuantity', () => {
  it('prefixes quantity with x and comma-groups thousands', () => {
    expect(formatGraphQuantity(1552)).toBe('x1,552')
    expect(formatGraphQuantity(1)).toBe('x1')
  })
})

describe('formatVolumeM3', () => {
  it('uses compact K/M/B suffixes for large cargo volumes', () => {
    expect(formatVolumeM3(12.34)).toBe('12.34 m³')
    expect(formatVolumeM3(456.7)).toBe('456.7 m³')
    expect(formatVolumeM3(12_345)).toBe('12.3K m³')
    expect(formatVolumeM3(2_500_000)).toBe('2.50M m³')
    expect(formatVolumeM3(3_400_000_000)).toBe('3.40B m³')
    expect(formatVolumeM3(0)).toBe('—')
  })
})

describe('formatDuration', () => {
  it('picks a readable unit for job time', () => {
    expect(formatDuration(45)).toBe('45 sec')
    expect(formatDuration(90)).toBe('1.5 min')
    expect(formatDuration(7_200)).toBe('2.00 hr')
    expect(formatDuration(172_800)).toBe('2.00 days')
    expect(formatDuration(0)).toBe('—')
  })
})

describe('formatDurationHms', () => {
  it('formats seconds as hours:minutes:seconds', () => {
    expect(formatDurationHms(45)).toBe('0:00:45')
    expect(formatDurationHms(90)).toBe('0:01:30')
    expect(formatDurationHms(7_200)).toBe('2:00:00')
    expect(formatDurationHms(172_800)).toBe('48:00:00')
    expect(formatDurationHms(3_665)).toBe('1:01:05')
    expect(formatDurationHms(0)).toBe('—')
  })
})

describe('parseDurationHms', () => {
  it('parses H:MM:SS and M:SS', () => {
    expect(parseDurationHms('0:57:36')).toBe(3_456)
    expect(parseDurationHms('1:01:05')).toBe(3_665)
    expect(parseDurationHms('57:36')).toBe(3_456)
    expect(parseDurationHms('3600')).toBe(3_600)
  })

  it('returns null for invalid input', () => {
    expect(parseDurationHms('')).toBeNull()
    expect(parseDurationHms('1:65:00')).toBeNull()
    expect(parseDurationHms('abc')).toBeNull()
  })
})

describe('formatIsk', () => {
  it('formats compact values with suffix and ISK', () => {
    expect(formatIsk(842)).toBe('842 ISK')
    expect(formatIsk(5_000)).toBe('5.0K ISK')
    expect(formatIsk(1_770_000)).toBe('1.77M ISK')
    expect(formatIsk(2_500_000_000)).toBe('2.50B ISK')
    expect(formatIsk(Number.POSITIVE_INFINITY)).toBe('∞')
  })

  it('shows decimals for cheap unit prices under 100 ISK', () => {
    expect(formatIsk(3.45)).toBe('3.45 ISK')
    expect(formatIsk(42.5)).toBe('42.5 ISK')
    expect(formatIsk(99.9)).toBe('99.9 ISK')
  })
})

describe('formatGraphUnitIsk', () => {
  it('formats compact unit prices with lowercase suffix and ISK', () => {
    expect(formatGraphUnitIsk(4700)).toBe('4.7k ISK')
    expect(formatGraphUnitIsk(5000)).toBe('5k ISK')
    expect(formatGraphUnitIsk(842)).toBe('842 ISK')
    expect(formatGraphUnitIsk(2_500_000)).toBe('2.5m ISK')
    expect(formatGraphUnitIsk(0)).toBe('—')
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
