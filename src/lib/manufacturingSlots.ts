import type { PlanSlotBonuses, SkillLevels } from '@/types'
import { effectiveSkillLevel } from '@/lib/skillFields'
import {
  extraManufacturingSlotsPerLevel,
  extraReactionSlotsPerLevel,
  extraScienceSlotsPerLevel,
} from '@/lib/industrySkillBonuses'

/** EVE: 1 base + Mass Production + Advanced Mass Production (max 11 at V/V). */
export function manufacturingSlotsFromSkills(skills: Partial<SkillLevels> | undefined): number {
  const mass = effectiveSkillLevel(skills, 'massProduction')
  const advanced = effectiveSkillLevel(skills, 'advancedMassProduction')
  return (
    1 +
    mass * extraManufacturingSlotsPerLevel(false) +
    advanced * extraManufacturingSlotsPerLevel(true)
  )
}

/** EVE: 1 base + Laboratory Operation + Advanced Laboratory Operation (max 11 at V/V). */
export function researchSlotsFromSkills(skills: Partial<SkillLevels> | undefined): number {
  const lab = effectiveSkillLevel(skills, 'laboratoryOperation')
  const advanced = effectiveSkillLevel(skills, 'advancedLaboratoryOperation')
  return 1 + lab * extraScienceSlotsPerLevel(false) + advanced * extraScienceSlotsPerLevel(true)
}

/** EVE: 1 base + Mass Reactions + Advanced Mass Reactions (max 11 at V/V). */
export function reactionSlotsFromSkills(skills: Partial<SkillLevels> | undefined): number {
  const mass = effectiveSkillLevel(skills, 'massReactions')
  const advanced = effectiveSkillLevel(skills, 'advancedMassReactions')
  return 1 + mass * extraReactionSlotsPerLevel(false) + advanced * extraReactionSlotsPerLevel(true)
}

function clampBonus(bonus: number | undefined): number {
  return Math.max(0, bonus ?? 0)
}

/** Skill slots plus non-negative plan bonus. */
export function effectiveManufacturingSlots(
  skills: Partial<SkillLevels> | undefined,
  bonus = 0,
): number {
  return manufacturingSlotsFromSkills(skills) + clampBonus(bonus)
}

export function effectiveResearchSlots(
  skills: Partial<SkillLevels> | undefined,
  bonus = 0,
): number {
  return researchSlotsFromSkills(skills) + clampBonus(bonus)
}

export function effectiveReactionSlots(
  skills: Partial<SkillLevels> | undefined,
  bonus = 0,
): number {
  return reactionSlotsFromSkills(skills) + clampBonus(bonus)
}

export function planSlotBonusesFromTemplate(
  template: PlanSlotBonuses | undefined,
): Required<PlanSlotBonuses> {
  return {
    manufacturing: clampBonus(template?.manufacturing),
    reactions: clampBonus(template?.reactions),
    research: clampBonus(template?.research),
  }
}

export function effectivePlanSlots(
  skills: Partial<SkillLevels> | undefined,
  bonuses?: PlanSlotBonuses,
): { manufacturing: number; reactions: number; research: number } {
  const bonus = planSlotBonusesFromTemplate(bonuses)
  return {
    manufacturing: effectiveManufacturingSlots(skills, bonus.manufacturing),
    reactions: effectiveReactionSlots(skills, bonus.reactions),
    research: effectiveResearchSlots(skills, bonus.research),
  }
}

export function planSlotBonusesFromManufacturingTemplate(
  template:
    | {
        manufacturingSlotBonus?: number
        reactionSlotBonus?: number
        researchSlotBonus?: number
      }
    | undefined,
): Required<PlanSlotBonuses> {
  return planSlotBonusesFromTemplate({
    manufacturing: template?.manufacturingSlotBonus,
    reactions: template?.reactionSlotBonus,
    research: template?.researchSlotBonus,
  })
}

const PLAN_WIDE_SLOT_BONUS_KEY = {
  manufacturing: 'manufacturingSlotBonus',
  reactions: 'reactionSlotBonus',
  research: 'researchSlotBonus',
} as const

/** Extra rings beyond skill slots for one crew character. Empty result is omitted. */
export function bumpCharacterSlotBonus(
  current: Record<string, PlanSlotBonuses> | undefined,
  characterKey: string,
  pool: keyof PlanSlotBonuses,
  delta: number,
): Record<string, PlanSlotBonuses> | undefined {
  const prev = current?.[characterKey] ?? {}
  const nextCount = Math.max(0, (prev[pool] ?? 0) + delta)
  const nextForKey: PlanSlotBonuses = { ...prev, [pool]: nextCount || undefined }
  const hasBonus =
    (nextForKey.manufacturing ?? 0) > 0 ||
    (nextForKey.reactions ?? 0) > 0 ||
    (nextForKey.research ?? 0) > 0
  if (!hasBonus) {
    const { [characterKey]: _removed, ...rest } = current ?? {}
    return Object.keys(rest).length > 0 ? rest : undefined
  }
  return { ...current, [characterKey]: nextForKey }
}

export function bumpPlanWideSlotBonus(
  template: {
    manufacturingSlotBonus?: number
    reactionSlotBonus?: number
    researchSlotBonus?: number
  },
  pool: keyof PlanSlotBonuses,
  delta: number,
): { manufacturingSlotBonus?: number; reactionSlotBonus?: number; researchSlotBonus?: number } {
  const key = PLAN_WIDE_SLOT_BONUS_KEY[pool]
  const next = Math.max(0, (template[key] ?? 0) + delta)
  return { [key]: next || undefined }
}
