import { describe, expect, it } from 'vitest'
import { ensurePlanRootIds, normalizeSkillLevels } from '@/services/sync/types'
import { DEFAULT_SKILLS, ZERO_SKILLS } from '@/types'

describe('normalizeSkillLevels', () => {
  it('preserves explicit zeros for character imports', () => {
    expect(normalizeSkillLevels({ ...ZERO_SKILLS })).toEqual(ZERO_SKILLS)
  })

  it('upgrades legacy all-zero saves to default 3 on load', () => {
    const zeros = {
      industry: 0,
      advancedIndustry: 0,
      massProduction: 0,
      advancedMassProduction: 0,
      reactions: 0,
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    }
    expect(normalizeSkillLevels(zeros, { legacyZeroMeansDefault: true })).toEqual(DEFAULT_SKILLS)
  })

  it('keeps imported levels without filling untrained keys with 3', () => {
    expect(
      normalizeSkillLevels({
        industry: 5,
        advancedIndustry: 4,
      }),
    ).toEqual({
      ...ZERO_SKILLS,
      industry: 5,
      advancedIndustry: 4,
      mining: 4,
      astrogeology: 4,
      iceHarvesting: 4,
      gasCloudHarvesting: 4,
      miningBarge: 4,
      exhumers: 4,
      miningFrigate: 4,
      expeditionFrigates: 4,
      miningDirector: 4,
      industrialCommandShips: 4,
      capitalIndustrialShips: 4,
    })
  })

  it('preserves skill levels without prerequisite enforcement', () => {
    expect(
      normalizeSkillLevels({
        industry: 0,
        miningBarge: 5,
        astrogeology: 5,
      }),
    ).toMatchObject({
      industry: 0,
      miningBarge: 5,
      astrogeology: 5,
    })
  })

  it('defaults missing laboratory skills to zero on import', () => {
    const normalized = normalizeSkillLevels({
      industry: 5,
      science: 3,
    })
    expect(normalized.laboratoryOperation).toBe(0)
    expect(normalized.advancedLaboratoryOperation).toBe(0)
  })
})

describe('ensurePlanRootIds', () => {
  it('assigns unique ids to legacy roots missing them', () => {
    const roots = ensurePlanRootIds([
      { productTypeId: 100, runs: 10, productionDurationHours: 24 },
      { productTypeId: 100, runs: 20, productionDurationHours: 12 },
    ])

    expect(roots[0].id).toBeTruthy()
    expect(roots[1].id).toBeTruthy()
    expect(roots[0].id).not.toBe(roots[1].id)
  })

  it('preserves existing root ids', () => {
    const roots = ensurePlanRootIds([
      { id: 'root-a', productTypeId: 100, runs: 10, productionDurationHours: 24 },
    ])
    expect(roots[0].id).toBe('root-a')
  })
})
