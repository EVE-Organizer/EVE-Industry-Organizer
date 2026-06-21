import type { MarketHistoryEntry, TimeRange } from '@/types'

export function daysForRange(range: TimeRange): number | null {
  if (range === '1d') return 1
  if (range === '1w') return 7
  if (range === '1m') return 30
  if (range === '1y') return 365
  return null
}

export function trimHistoryByDays(history: MarketHistoryEntry[], days: number): MarketHistoryEntry[] {
  if (!history.length) return history
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return history.filter((h) => new Date(h.date).getTime() >= cutoff)
}

export function filterHistoryByRange(history: MarketHistoryEntry[], range: TimeRange): MarketHistoryEntry[] {
  const days = daysForRange(range)
  if (days === null || !history.length) return history
  return trimHistoryByDays(history, days)
}

export function formatIsk(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

/** Compact amount + unit for setup budget inputs (M/B only). */
export function formatIskInputUnit(value: number): { amount: string; unit: 'M' | 'B' } {
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
  const match = cleaned.match(/^([\d.]+)\s*([bB])?$/)
  if (!match) return null
  const num = Number(match[1])
  if (!Number.isFinite(num) || num < 0) return null
  if (match[2]) return Math.round(num * 1_000_000_000)
  const multiplier = defaultUnit === 'B' ? 1_000_000_000 : 1_000_000
  return Math.round(num * multiplier)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatAvgVolume(avgVolume: number): string {
  if (avgVolume <= 0) return '—'
  return avgVolume.toFixed(1)
}
