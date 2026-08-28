import { describe, expect, it } from 'vitest'
import {
  applyME,
  applyTE,
  estimatedItemValue,
  estimateJobCost,
  inventionBlueprintCostForSettings,
  inventionBlueprintCostPerRun,
  teTimeFactor,
} from '@/lib/cost'
import { DEFAULT_SETTINGS } from '@/types'

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

describe('inventionBlueprintCostPerRun', () => {
  it('applies +1% per invention skill level multiplicatively', () => {
    const prices = new Map([
      [11467, 100_000],
      [11455, 100_000],
    ])
    const base = inventionBlueprintCostPerRun({
      datacores: [
        { typeId: 11467, quantity: 1 },
        { typeId: 11455, quantity: 1 },
      ],
      prices,
      baseChance: 0.3,
      runsPerBPC: 10,
      skillLevel: 0,
    })
    const skilled = inventionBlueprintCostPerRun({
      datacores: [
        { typeId: 11467, quantity: 1 },
        { typeId: 11455, quantity: 1 },
      ],
      prices,
      baseChance: 0.3,
      runsPerBPC: 10,
      skillLevel: 4,
    })
    expect(skilled.chance).toBeCloseTo(0.3 * 1.04 ** 3, 5)
    expect(skilled.costPerRun).toBeLessThan(base.costPerRun)
  })

  it('adds copy and invention job fees when cost indices are set', () => {
    const prices = new Map([
      [11467, 100_000],
      [34, 10],
    ])
    const blueprint = {
      ...{
        productTypeId: 1,
        blueprintTypeId: 2,
        productQuantity: 1,
        manufacturingTime: 60,
        materials: [{ typeId: 34, quantity: 100 }],
        requiredSkills: {},
        tier: 't2' as const,
        productGroup: 'Module',
        bpIconUrl: '',
        productIconUrl: '',
        productRenderUrl: '',
        invention: {
          t1BlueprintTypeId: 3,
          datacores: [{ typeId: 11467, quantity: 1 }],
          runsPerBPC: 10,
          baseChance: 1,
        },
      },
    }
    const datacoresOnly = inventionBlueprintCostPerRun({
      datacores: blueprint.invention.datacores,
      prices,
      baseChance: 1,
      runsPerBPC: 10,
      skillLevel: 0,
    })
    const withFees = inventionBlueprintCostForSettings({
      blueprint,
      t1Blueprint: { materials: [{ typeId: 34, quantity: 50 }] },
      settings: DEFAULT_SETTINGS,
      prices,
      systems: [
        {
          systemId: DEFAULT_SETTINGS.copyFacility.systemId,
          name: 'Perimeter',
          regionId: 10000002,
          security: 1,
          costIndex: 0.02,
          copyingCostIndex: 0.01,
          inventionCostIndex: 0.02,
        },
      ],
    })
    expect(withFees).not.toBeNull()
    expect(withFees!.attemptCost).toBeGreaterThan(datacoresOnly.attemptCost)
    expect(withFees!.attemptCost).toBe(
      datacoresOnly.attemptCost + 50 * 10 * 0.01 + 100 * 10 * 0.02,
    )
  })
})
