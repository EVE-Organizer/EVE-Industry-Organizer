import { describe, expect, it } from 'vitest'
import {
  enforceSkillPrerequisites,
  maxTrainableSkillLevel,
  normalizeImportedSkillLevels,
  prerequisitesMet,
  skillLevel,
  trainingAttributesForSkill,
} from '@/lib/skillFields'
import { manufacturingSlotsFromSkills, researchSlotsFromSkills } from '@/lib/manufacturingSlots'

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
      massProduction: 0,
      advancedMassProduction: 0,
      laboratoryOperation: 0,
      advancedLaboratoryOperation: 0,
      reactions: 0,
      science: 0,
      accounting: 0,
      brokerRelations: 0,
    })
  })

  it('locks advanced mass production until mass production V', () => {
    expect(prerequisitesMet({ industry: 5, massProduction: 4 }, 'advancedMassProduction')).toBe(false)
    expect(maxTrainableSkillLevel({ industry: 5, massProduction: 4 }, 'advancedMassProduction')).toBe(0)
    expect(
      enforceSkillPrerequisites({
        industry: 5,
        advancedIndustry: 5,
        massProduction: 4,
        advancedMassProduction: 5,
        laboratoryOperation: 0,
        advancedLaboratoryOperation: 0,
        reactions: 0,
        science: 0,
        accounting: 0,
        brokerRelations: 0,
      }).advancedMassProduction,
    ).toBe(0)
    expect(
      manufacturingSlotsFromSkills({
        industry: 5,
        massProduction: 4,
        advancedMassProduction: 5,
      }),
    ).toBe(5)
  })

  it('counts both mass production skills at V for plan slots', () => {
    expect(
      manufacturingSlotsFromSkills({
        industry: 5,
        massProduction: 5,
        advancedMassProduction: 5,
      }),
    ).toBe(11)
  })

  it('locks advanced laboratory until laboratory operation V and science III', () => {
    expect(
      prerequisitesMet({ science: 3, laboratoryOperation: 4 }, 'advancedLaboratoryOperation'),
    ).toBe(false)
    expect(
      researchSlotsFromSkills({
        science: 3,
        laboratoryOperation: 5,
        advancedLaboratoryOperation: 5,
      }),
    ).toBe(11)
    expect(
      researchSlotsFromSkills({
        science: 2,
        laboratoryOperation: 5,
        advancedLaboratoryOperation: 5,
      }),
    ).toBe(1)
  })

  it('resolves training attributes from SDE or industry fallbacks', () => {
    expect(trainingAttributesForSkill(3380)).toEqual({
      primaryAttribute: 'intelligence',
      secondaryAttribute: 'memory',
    })
    expect(
      trainingAttributesForSkill(
        99,
        new Map([
          [
            99,
            {
              skillId: 99,
              name: 'Test',
              rank: 1,
              prerequisites: [],
              iconUrl: '',
              primaryAttribute: 'perception',
              secondaryAttribute: 'willpower',
            },
          ],
        ]),
      ),
    ).toEqual({
      primaryAttribute: 'perception',
      secondaryAttribute: 'willpower',
    })
  })
})
