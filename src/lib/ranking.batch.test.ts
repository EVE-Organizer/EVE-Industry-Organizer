import { describe, expect, it } from 'vitest'
import { resolveRankingRuns } from '@/lib/ranking'

describe('resolveRankingRuns', () => {
  it('uses batch size above legacy 500 cap when hub volume allows more', () => {
    const avgVolume = 200
    const productQuantity = 1
    const maxMarketRuns = Math.floor(avgVolume * 7 / productQuantity)

    expect(maxMarketRuns).toBeGreaterThan(600)
    expect(resolveRankingRuns(500, productQuantity, avgVolume)).toBe(500)
    expect(resolveRankingRuns(600, productQuantity, avgVolume)).toBe(600)
    expect(resolveRankingRuns(1000, productQuantity, avgVolume)).toBe(1000)
  })

  it('returns null when hub volume cannot clear one run in 7 days', () => {
    expect(resolveRankingRuns(100, 1, 0.1)).toBeNull()
  })

  it('uses full batch when hub volume is missing', () => {
    expect(resolveRankingRuns(750, 10, 0)).toBe(750)
  })
})
