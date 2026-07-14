import type { MarketHistoryEntry, TimeRange } from '@/types'

/** Fallback order when a shorter history window has no data. */
export const WIDER_TIME_RANGES: Record<TimeRange, TimeRange[]> = {
  '1d': ['1w', '1m', '1y', 'all'],
  '1w': ['1m', '1y', 'all'],
  '1m': ['1y', 'all'],
  '1y': ['all'],
  all: [],
}

export function daysForRange(range: TimeRange): number | null {
  if (range === '1d') return 1
  if (range === '1w') return 7
  if (range === '1m') return 30
  if (range === '1y') return 365
  return null
}

export function trimHistoryByDays(history: MarketHistoryEntry[], days: number): MarketHistoryEntry[] {
  if (!history.length) return history
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const filtered = sorted.filter((h) => new Date(h.date).getTime() >= cutoff)
  if (filtered.length) return filtered

  // ESI history is daily and lags; use the most recent N trading days available.
  return sorted.slice(-Math.min(days, sorted.length))
}

export function filterHistoryByRange(history: MarketHistoryEntry[], range: TimeRange): MarketHistoryEntry[] {
  const days = daysForRange(range)
  if (days === null || !history.length) return history
  return trimHistoryByDays(history, days)
}

export function formatIsk(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  if (Math.abs(value) >= 1_000_000_000) {
    return `${formatDecimal(value / 1_000_000_000, 2)}B`
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${formatDecimal(value / 1_000_000, 2)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${formatNumber(value / 1_000, 1)}K`
  }
  return formatNumber(value, 0)
}

/** Compact amount + unit for setup budget inputs (M/B only). */
export function formatIskInputUnit(value: number): { amount: string; unit: 'M' | 'B' } {
  if (!Number.isFinite(value)) return { amount: '∞', unit: 'B' }
  if (Math.abs(value) >= 1_000_000_000) {
    const scaled = value / 1_000_000_000
    return { amount: trimInputAmount(scaled), unit: 'B' }
  }
  const scaled = value / 1_000_000
  return { amount: trimInputAmount(scaled), unit: 'M' }
}

function trimInputAmount(n: number): string {
  const fixed = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

/** Parse setup budget input: plain number uses defaultUnit; optional B/b suffix for billions. */
export function parseIskInputUnit(raw: string, defaultUnit: 'M' | 'B' = 'M'): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return null
  if (/^∞$/.test(cleaned) || /^infinity$/i.test(cleaned)) return Number.POSITIVE_INFINITY
  const match = cleaned.match(/^([\d.]+)\s*([bB])?$/)
  if (!match) return null
  const num = Number(match[1])
  if (!Number.isFinite(num) || num < 0) return null
  if (match[2]) return Math.round(num * 1_000_000_000)
  const multiplier = defaultUnit === 'B' ? 1_000_000_000 : 1_000_000
  return Math.round(num * multiplier)
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDecimal(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`
}

export function formatAvgVolume(avgVolume: number): string {
  if (avgVolume <= 0) return '—'
  return formatNumber(avgVolume, 1)
}

export function formatQuantity(value: number): string {
  return formatNumber(value, 0)
}

/** Production graph nodes: `x1,552`. */
export function formatGraphQuantity(value: number): string {
  return `x${formatNumber(value, 0)}`
}

/** Production graph nodes: `4.7k ISK` (lowercase suffix, explicit ISK). */
export function formatGraphUnitIsk(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (Math.abs(value) >= 1_000_000_000) {
    return `${trimCompactDecimal(value / 1_000_000_000, 1)}b ISK`
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${trimCompactDecimal(value / 1_000_000, 1)}m ISK`
  }
  if (Math.abs(value) >= 1_000) {
    return `${trimCompactDecimal(value / 1_000, 1)}k ISK`
  }
  return `${formatNumber(value, 0)} ISK`
}

/** Job duration for UI: days, hr, min, or sec. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds >= 86_400) return `${formatDecimal(seconds / 86_400, 2)} days`
  if (seconds >= 3_600) return `${formatDecimal(seconds / 3_600, 2)} hr`
  if (seconds >= 60) return `${formatDecimal(seconds / 60, 1)} min`
  return `${formatNumber(seconds, 0)} sec`
}

function trimCompactDecimal(value: number, decimals: number): string {
  return formatDecimal(value, decimals).replace(/\.0$/, '')
}
