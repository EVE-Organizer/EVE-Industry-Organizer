import { describe, expect, it } from 'vitest'
import {
  applyME,
  applyTE,
  estimatedItemValue,
  estimateJobCost,
  teTimeFactor,
} from '@/lib/cost'

describe('teTimeFactor', () => {
  it('treats TE 0–20 as 1% per point (TE 20 → 20% faster)', () => {
    expect(teTimeFactor(0)).toBe(1)
    expect(teTimeFactor(4)).toBeCloseTo(0.96, 10)
    expect(teTimeFactor(20)).toBeCloseTo(0.8, 10)
  })
})

describe('applyTE', () => {
  it('matches in-game Nova Heavy Missile 6 runs at Industry I, TE 0', () => {
    const seconds = applyTE(600, 0, 6, 1, 0)
    expect(seconds).toBeCloseTo(57 * 60 + 36, 0)
  })

  it('applies TE 20 as 20% reduction, not 80%', () => {
    const te0 = applyTE(3600, 0, 1, 0, 0)
    const te20 = applyTE(3600, 20, 1, 0, 0)
    expect(te0).toBe(3600)
    expect(te20).toBeCloseTo(2880, 5)
  })
})

describe('applyME', () => {
  it('never goes below 1 unit per run for qty-1 materials', () => {
    const mats = applyME([{ typeId: 34, quantity: 1 }], 10, 100)
    expect(mats[0]!.quantity).toBe(100)
  })

  it('reduces multi-qty materials with ME 10', () => {
    const mats = applyME([{ typeId: 34, quantity: 100 }], 10, 10)
    // 100 * 10 * 0.9 = 900
    expect(mats[0]!.quantity).toBe(900)
  })

  it('rounds to 2 decimals before ceil (EVE formula)', () => {
    // 3 * 7 * 0.9 = 18.9 → ceil 19
    const mats = applyME([{ typeId: 34, quantity: 3 }], 10, 7)
    expect(mats[0]!.quantity).toBe(19)
  })
})

describe('estimatedItemValue / estimateJobCost', () => {
  it('uses base ME0 quantities for EIV, not ME-reduced materials', () => {
    const prices = new Map([[34, 5]])
    const materials = [{ typeId: 34, quantity: 100 }]
    const runs = 10
    const eiv = estimatedItemValue(materials, runs, prices)
    expect(eiv).toBe(5000)

    const meMats = applyME(materials, 10, runs)
    expect(meMats[0]!.quantity).toBe(900)

    const jobFromEiv = estimateJobCost(eiv, 0.02)
    const jobFromMeCost = estimateJobCost(meMats[0]!.quantity * 5, 0.02)
    expect(jobFromEiv).toBe(100)
    expect(jobFromMeCost).toBe(90)
    expect(jobFromEiv).toBeGreaterThan(jobFromMeCost)
  })
})
