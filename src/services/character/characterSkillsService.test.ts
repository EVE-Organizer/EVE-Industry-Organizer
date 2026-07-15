import { describe, expect, it } from 'vitest'
import { mapEsiSkillsToSkillLevels } from '@/services/character/characterSkillsService'

describe('mapEsiSkillsToSkillLevels', () => {
  it('maps tracked skill ids to app keys', () => {
    const skills = mapEsiSkillsToSkillLevels([
      { skill_id: 3380, trained_skill_level: 5, active_skill_level: 5 },
      { skill_id: 24625, trained_skill_level: 4, active_skill_level: 4 },
      { skill_id: 3403, trained_skill_level: 3, active_skill_level: 3 },
      { skill_id: 16622, trained_skill_level: 2, active_skill_level: 2 },
      { skill_id: 3443, trained_skill_level: 1, active_skill_level: 1 },
    ])

    expect(skills).toMatchObject({
      industry: 5,
      advancedIndustry: 4,
      science: 3,
      accounting: 2,
      brokerRelations: 1,
    })
  })

  it('uses zero for skills not on the character', () => {
    const skills = mapEsiSkillsToSkillLevels([
      { skill_id: 3380, trained_skill_level: 5, active_skill_level: 5 },
    ])

    expect(skills.industry).toBe(5)
    expect(skills.advancedIndustry).toBe(0)
  })
})
