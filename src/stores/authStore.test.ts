import { describe, expect, it } from 'vitest'
import {
  mergeAssumedWithTrainedSkillLevels,
  normalizeImportedSkillLevels,
} from '@/lib/skillFields'
import { ZERO_SKILLS, type SkillLevels } from '@/types'

describe('trained vs assumed skill persistence', () => {
  it('normalizeImportedSkillLevels preserves assumed levels independently', () => {
    const trained: SkillLevels = normalizeImportedSkillLevels({
      industry: 4,
      advancedIndustry: 3,
    })
    const assumed: SkillLevels = normalizeImportedSkillLevels({
      ...trained,
      industry: 5,
    })
    expect(trained.industry).toBe(4)
    expect(assumed.industry).toBe(5)
  })

  it('reset-to-trained pattern copies trained onto assumed', () => {
    const trained = normalizeImportedSkillLevels({ industry: 4, massProduction: 5 })
    const assumed = normalizeImportedSkillLevels({ industry: 5, massProduction: 2 })
    const reset = normalizeImportedSkillLevels({ ...trained })
    expect(assumed.industry).toBe(5)
    expect(reset.industry).toBe(trained.industry)
    expect(reset.massProduction).toBe(trained.massProduction)
  })

  it('zero defaults fill missing keys', () => {
    expect(normalizeImportedSkillLevels({ industry: 5 })).toEqual({
      ...ZERO_SKILLS,
      industry: 5,
    })
  })

  it('fills newly tracked skills from ESI without replacing existing assumptions', () => {
    const merged = mergeAssumedWithTrainedSkillLevels(
      { industry: 5, mining: 4, astrogeology: 3 },
      { industry: 4, mining: 5, astrogeology: 5, miningBarge: 5, exhumers: 4 },
    )
    expect(merged.industry).toBe(5)
    expect(merged.mining).toBe(4)
    expect(merged.miningBarge).toBe(5)
    expect(merged.exhumers).toBe(4)
  })
})
