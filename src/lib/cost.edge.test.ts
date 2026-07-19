import { describe, expect, it } from 'vitest'
import {
  applyME,
  applyReactionTime,
  applyTE,
  estimateJobCost,
  estimatedItemValue,
} from '@/lib/cost'
import { canRunReactionJobs } from '@/lib/recipes'
import { DEFAULT_SETTINGS } from '@/types'

describe('cost edge cases', () => {
  it('applyME returns zero quantities for non-positive runs', () => {
    const mats = applyME([{ typeId: 34, quantity: 100 }], 10, 0)
    expect(mats[0]!.quantity).toBe(0)
  })

  it('applyME never drops below one unit per run for qty-1 materials', () => {
    const mats = applyME([{ typeId: 38, quantity: 1 }], 10, 50)
    expect(mats[0]!.quantity).toBe(50)
  })

  it('clamps extreme structure ME bonuses so quantity never goes below runs', () => {
    const mats = applyME([{ typeId: 34, quantity: 100 }], 0, 10, 150)
    expect(mats[0]!.quantity).toBe(10)
  })

  it('clamps extreme structure TE bonuses to non-negative job time', () => {
    const seconds = applyTE(3600, 20, 10, 5, 5, 150)
    expect(seconds).toBe(0)
  })

  it('applyReactionTime stays non-negative with extreme structure TE', () => {
    expect(applyReactionTime(3600, 5, 5, 200)).toBe(0)
  })

  it('estimateJobCost never goes negative with extreme job cost bonus', () => {
    const eiv = 1_000_000
    const clamped = estimateJobCost(eiv, 0.01, { jobCostBonusPercent: 200, taxPercent: 0 })
    expect(clamped).toBe(0)
    expect(clamped).toBeGreaterThanOrEqual(0)
  })

  it('estimatedItemValue is zero for non-positive runs', () => {
    const prices = new Map([[34, 5]])
    expect(estimatedItemValue([{ typeId: 34, quantity: 100 }], 0, prices)).toBe(0)
    expect(estimatedItemValue([{ typeId: 34, quantity: 100 }], -5, prices)).toBe(0)
  })

  it('canRunReactionJobs is false when refinery is none', () => {
    expect(
      canRunReactionJobs({
        ...DEFAULT_SETTINGS,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'none',
        },
      }),
    ).toBe(false)
    expect(
      canRunReactionJobs({
        ...DEFAULT_SETTINGS,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'tatara',
        },
      }),
    ).toBe(true)
  })
})
