import { describe, expect, it } from 'vitest'
import { normalizeSkillLevels } from '@/services/sync/types'
import { DEFAULT_SKILLS } from '@/types'

describe('normalizeSkillLevels', () => {
  it('preserves explicit zeros for character imports', () => {
    const zeros = {
      industry: 0,
      advancedIndustry: 0,
      massProduction: 0,
      advancedMassProduction: 0,
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    }
    expect(normalizeSkillLevels(zeros)).toEqual(zeros)
  })

  it('upgrades legacy all-zero saves to default 3 on load', () => {
    const zeros = {
      industry: 0,
      advancedIndustry: 0,
      massProduction: 0,
      advancedMassProduction: 0,
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
      industry: 5,
      advancedIndustry: 4,
      massProduction: 0,
      advancedMassProduction: 0,
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    })
  })
})
