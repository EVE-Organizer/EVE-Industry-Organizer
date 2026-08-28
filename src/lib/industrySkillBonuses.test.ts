import { afterEach, describe, expect, it } from 'vitest'
import {
  industryTimeBonusPerLevel,
  inventionSuccessChanceFromLevels,
  itemTypeManufacturingTimeFactor,
  itemTypeTimeBonusPerLevel,
  setSkillCalcCatalog,
} from '@/lib/industrySkillBonuses'
import { applyTE } from '@/lib/cost'

afterEach(() => {
  setSkillCalcCatalog(undefined)
})

describe('industrySkillBonuses', () => {
  it('inventionSuccessChanceFromLevels matches enc/40 + datacores/30', () => {
    expect(inventionSuccessChanceFromLevels(0.34, 5, 5, 5)).toBeCloseTo(
      0.34 * (1 + 5 / 40 + 10 / 30),
      5,
    )
  })

  it('itemTypeManufacturingTimeFactor applies 1% only for required construction skills', () => {
    const factor = itemTypeManufacturingTimeFactor(
      { 'Advanced Small Ship Construction': 1, Industry: 1 },
      { advancedSmallShipConstruction: 5, industry: 5 },
    )
    expect(factor).toBeCloseTo(0.95, 5)
  })

  it('applyTE stacks item-type bonus with industry skills', () => {
    const base = 3600
    const withSpec = applyTE(
      base,
      0,
      1,
      5,
      5,
      0,
      { 'Advanced Small Ship Construction': 1 },
      {
        industry: 5,
        advancedIndustry: 5,
        advancedSmallShipConstruction: 5,
      },
    )
    const withoutSpec = applyTE(base, 0, 1, 5, 5, 0, {}, { industry: 5, advancedIndustry: 5 })
    expect(withSpec).toBeLessThan(withoutSpec)
  })

  it('reads manufacturingTimeBonusPerLevel from SkillInfo with effect fallbacks', () => {
    expect(industryTimeBonusPerLevel()).toBe(0.04)
    expect(itemTypeTimeBonusPerLevel('Advanced Small Ship Construction')).toBe(0.01)
    setSkillCalcCatalog([
      {
        skillId: 3380,
        name: 'Industry',
        rank: 1,
        prerequisites: [],
        iconUrl: '',
        manufacturingTimeBonusPerLevel: 0.04,
      },
      {
        skillId: 3395,
        name: 'Advanced Small Ship Construction',
        rank: 2,
        prerequisites: [],
        iconUrl: '',
        manufacturingTimeBonusPerLevel: 0.01,
      },
    ])
    expect(industryTimeBonusPerLevel()).toBe(0.04)
    expect(itemTypeTimeBonusPerLevel('Advanced Small Ship Construction')).toBe(0.01)
  })
})
