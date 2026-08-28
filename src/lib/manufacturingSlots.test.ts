import { afterEach, describe, expect, it } from 'vitest'
import {
  effectiveManufacturingSlots,
  effectivePlanSlots,
  effectiveReactionSlots,
  effectiveResearchSlots,
  manufacturingSlotsFromSkills,
  planSlotBonusesFromManufacturingTemplate,
  planSlotBonusesFromTemplate,
  reactionSlotsFromSkills,
  researchSlotsFromSkills,
} from '@/lib/manufacturingSlots'
import { setSkillCalcCatalog } from '@/lib/industrySkillBonuses'

afterEach(() => {
  setSkillCalcCatalog(undefined)
})

describe('manufacturingSlots', () => {
  it('uses 1 extra slot per level when SkillInfo calc fields are absent', () => {
    expect(
      manufacturingSlotsFromSkills({
        industry: 5,
        massProduction: 5,
        advancedMassProduction: 5,
      }),
    ).toBe(11)
    expect(
      researchSlotsFromSkills({
        science: 5,
        laboratoryOperation: 5,
        advancedLaboratoryOperation: 5,
      }),
    ).toBe(11)
    expect(
      reactionSlotsFromSkills({
        reactions: 5,
        massReactions: 5,
        advancedMassReactions: 5,
      }),
    ).toBe(11)
  })

  it('reads extraJobSlotsPerLevel from the skill catalog', () => {
    setSkillCalcCatalog([
      {
        skillId: 3387,
        name: 'Mass Production',
        rank: 2,
        prerequisites: [],
        iconUrl: '',
        extraJobSlotsPerLevel: 1,
      },
      {
        skillId: 24625,
        name: 'Advanced Mass Production',
        rank: 8,
        prerequisites: [],
        iconUrl: '',
        extraJobSlotsPerLevel: 1,
      },
    ])
    expect(
      manufacturingSlotsFromSkills({
        industry: 5,
        massProduction: 3,
        advancedMassProduction: 0,
      }),
    ).toBe(4)
  })

  it('adds non-negative bonus slots on top of skill counts', () => {
    const skills = {
      industry: 5,
      massProduction: 5,
      advancedMassProduction: 5,
      science: 5,
      laboratoryOperation: 5,
      advancedLaboratoryOperation: 5,
      reactions: 5,
      massReactions: 5,
      advancedMassReactions: 5,
    }

    expect(effectiveManufacturingSlots(skills, 2)).toBe(13)
    expect(effectiveResearchSlots(skills, 1)).toBe(12)
    expect(effectiveReactionSlots(skills, 3)).toBe(14)
    expect(effectiveManufacturingSlots(skills, -5)).toBe(11)
  })

  it('reads per-category bonuses from plan templates', () => {
    expect(
      planSlotBonusesFromManufacturingTemplate({
        manufacturingSlotBonus: 2,
        reactionSlotBonus: 1,
        researchSlotBonus: 0,
      }),
    ).toEqual({ manufacturing: 2, reactions: 1, research: 0 })

    expect(
      effectivePlanSlots(
        { industry: 5, massProduction: 2, advancedMassProduction: 0 },
        planSlotBonusesFromTemplate({ manufacturing: 3, reactions: 1, research: 2 }),
      ),
    ).toEqual({ manufacturing: 6, reactions: 2, research: 3 })
  })
})
