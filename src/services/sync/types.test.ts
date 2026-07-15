import { describe, expect, it } from 'vitest'
import { normalizeSkillLevels } from '@/services/sync/types'

describe('normalizeSkillLevels', () => {
  it('preserves explicit zeros for character imports', () => {
    const zeros = {
      industry: 0,
      advancedIndustry: 0,
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
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    }
    expect(normalizeSkillLevels(zeros, { legacyZeroMeansDefault: true })).toEqual({
      industry: 3,
      advancedIndustry: 3,
      science: 3,
      accounting: 3,
      brokerRelations: 3,
    })
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
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    })
  })
})
