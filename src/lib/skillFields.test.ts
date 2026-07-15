import { describe, expect, it } from 'vitest'
import { normalizeImportedSkillLevels, skillLevel } from '@/lib/skillFields'

describe('skillFields', () => {
  it('skillLevel returns 0 for missing keys', () => {
    expect(skillLevel({}, 'industry')).toBe(0)
    expect(skillLevel({}, 'advancedIndustry')).toBe(0)
    expect(skillLevel({}, 'science')).toBe(0)
    expect(skillLevel({}, 'accounting')).toBe(0)
    expect(skillLevel({}, 'brokerRelations')).toBe(0)
  })

  it('skillLevel preserves explicit zero', () => {
    expect(skillLevel({ advancedIndustry: 0 }, 'advancedIndustry')).toBe(0)
  })

  it('normalizeImportedSkillLevels fills every tracked skill with zero defaults', () => {
    expect(normalizeImportedSkillLevels({ industry: 5 })).toEqual({
      industry: 5,
      advancedIndustry: 0,
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    })
  })
})
