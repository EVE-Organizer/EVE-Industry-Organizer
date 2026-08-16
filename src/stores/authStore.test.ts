import { describe, expect, it } from 'vitest'
import { normalizeImportedSkillLevels } from '@/lib/skillFields'
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
})
