import { describe, expect, it } from 'vitest'
import { aggregateHistoryWindows, robustVolumeWeightedAvgPrice } from './market-data.mjs'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Ducinium II-Grade-style history: one spike day vs normal trading days. */
const DUCINIUM_DAYS = [
  { date: daysAgo(25), average: 1_005_000, volume: 2, highest: 1_005_000, lowest: 1_005_000 },
  { date: daysAgo(21), average: 2_000, volume: 310, highest: 2_000, lowest: 2_000 },
  { date: daysAgo(16), average: 2_000, volume: 2, highest: 2_000, lowest: 2_000 },
  { date: daysAgo(11), average: 4_001, volume: 18, highest: 4_001, lowest: 4_001 },
  { date: daysAgo(6), average: 4_004, volume: 348, highest: 4_004, lowest: 4_004 },
  { date: daysAgo(2), average: 2_807, volume: 1_522, highest: 2_807, lowest: 2_807 },
]

describe('robustVolumeWeightedAvgPrice', () => {
  it('rejects a single spike day on Ducinium II-Grade', () => {
    const avg = robustVolumeWeightedAvgPrice(DUCINIUM_DAYS)
    expect(avg).toBeGreaterThan(2_000)
    expect(avg).toBeLessThan(5_000)
    expect(avg).not.toBeCloseTo(169_969, -2)
  })
})

describe('aggregateHistoryWindows', () => {
  it('stores robust avgPrice for the 1m window', () => {
    const windows = aggregateHistoryWindows(DUCINIUM_DAYS)
    expect(windows['1m']?.avgPrice).toBeGreaterThan(2_000)
    expect(windows['1m']?.avgPrice).toBeLessThan(5_000)
  })
})
