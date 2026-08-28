import {
  effectiveSkillLevel,
  skillLevel,
  SKILL_FIELDS,
  type SkillFieldDef,
} from '@/lib/skillFields'
import type { InventionInfo, SkillInfo, SkillLevels } from '@/types'

/** Bonuses that live on dogma effects, not attributes. Used when SkillInfo calc fields are absent. */
export const EFFECT_TIME_BONUS_PER_LEVEL: Record<number, number> = {
  3380: 0.04,
  3388: 0.03,
}

const MASS_PRODUCTION_ID = 3387
const ADVANCED_MASS_PRODUCTION_ID = 24625
const LABORATORY_OPERATION_ID = 3406
const ADVANCED_LABORATORY_OPERATION_ID = 24624
const MASS_REACTIONS_ID = 45748
const ADVANCED_MASS_REACTIONS_ID = 45749
const INDUSTRY_ID = 3380
const ADVANCED_INDUSTRY_ID = 3388
const SCIENCE_ID = 3402
const REACTIONS_ID = 45746

let skillsById = new Map<number, SkillInfo>()
let skillsByName = new Map<string, SkillInfo>()

export function setSkillCalcCatalog(skills: SkillInfo[] | undefined): void {
  skillsById = new Map((skills ?? []).map((skill) => [skill.skillId, skill]))
  skillsByName = new Map((skills ?? []).map((skill) => [skill.name, skill]))
}

function fractionField(
  skillId: number,
  field: 'manufacturingTimeBonusPerLevel' | 'copyTimeBonusPerLevel' | 'reactionTimeBonusPerLevel',
  fallback: number,
): number {
  return skillsById.get(skillId)?.[field] ?? fallback
}

function slotField(
  skillId: number,
  field: 'extraJobSlotsPerLevel' | 'extraScienceJobSlotsPerLevel' | 'extraReactionJobSlotsPerLevel',
): number {
  return skillsById.get(skillId)?.[field] ?? 1
}

export function industryTimeBonusPerLevel(): number {
  return fractionField(
    INDUSTRY_ID,
    'manufacturingTimeBonusPerLevel',
    EFFECT_TIME_BONUS_PER_LEVEL[3380] ?? 0.04,
  )
}

export function advancedIndustryTimeBonusPerLevel(): number {
  return fractionField(
    ADVANCED_INDUSTRY_ID,
    'manufacturingTimeBonusPerLevel',
    EFFECT_TIME_BONUS_PER_LEVEL[3388] ?? 0.03,
  )
}

export function scienceCopyBonusPerLevel(): number {
  return fractionField(SCIENCE_ID, 'copyTimeBonusPerLevel', 0.05)
}

export function reactionsTimeBonusPerLevel(): number {
  return fractionField(REACTIONS_ID, 'reactionTimeBonusPerLevel', 0.04)
}

export function extraManufacturingSlotsPerLevel(advanced = false): number {
  return slotField(
    advanced ? ADVANCED_MASS_PRODUCTION_ID : MASS_PRODUCTION_ID,
    'extraJobSlotsPerLevel',
  )
}

export function extraScienceSlotsPerLevel(advanced = false): number {
  return slotField(
    advanced ? ADVANCED_LABORATORY_OPERATION_ID : LABORATORY_OPERATION_ID,
    'extraScienceJobSlotsPerLevel',
  )
}

export function extraReactionSlotsPerLevel(advanced = false): number {
  return slotField(
    advanced ? ADVANCED_MASS_REACTIONS_ID : MASS_REACTIONS_ID,
    'extraReactionJobSlotsPerLevel',
  )
}

/** Skills whose time bonus is applied globally, not per-blueprint. */
const GLOBAL_TIME_SKILL_LABELS = new Set(['Industry', 'Advanced Industry', 'Science', 'Reactions'])

/** Gate-only skills: required to start jobs but no manufacturing time bonus. */
const GATE_ONLY_SKILL_LABELS = new Set([
  'Capital Ship Construction',
  'Drug Manufacturing',
  'Metallurgy',
  'Research',
])

const labelToField = new Map(SKILL_FIELDS.map((f) => [f.label, f]))

/** Per-level manufacturing time reduction when the BPO lists this skill. */
export function itemTypeTimeBonusPerLevel(label: string): number {
  if (GATE_ONLY_SKILL_LABELS.has(label)) return 0
  const fromCatalog = skillsByName.get(label)?.manufacturingTimeBonusPerLevel
  if (fromCatalog != null) return fromCatalog
  if (label === 'Mutagenic Stabilization') return 0.02
  const field = labelToField.get(label)
  if (!field?.manufacturingTimeBonus) return 0
  return field.manufacturingTimeBonus
}

/** Multiplicative factor from blueprint-required item-type skills (excludes global bonuses). */
export function itemTypeManufacturingTimeFactor(
  requiredSkills: Record<string, number> | undefined,
  skills: Partial<SkillLevels> | undefined,
): number {
  if (!requiredSkills) return 1
  let factor = 1
  for (const skillName of Object.keys(requiredSkills)) {
    if (GLOBAL_TIME_SKILL_LABELS.has(skillName)) continue
    const bonus = itemTypeTimeBonusPerLevel(skillName)
    if (bonus <= 0) continue
    const field = labelToField.get(skillName)
    if (!field) continue
    const level = effectiveSkillLevel(skills, field.key)
    factor *= Math.max(0, 1 - bonus * level)
  }
  return factor
}

/** Current-game invention chance: enc/40 + (dc1+dc2)/30, optional decryptor multiplier. */
export function inventionSuccessChanceFromLevels(
  baseChance: number,
  encryptionLevel: number,
  datacore1Level: number,
  datacore2Level: number,
  decryptorModifier = 1,
): number {
  const skillBonus = 1 + encryptionLevel / 40 + (datacore1Level + datacore2Level) / 30
  return Math.min(1, baseChance * skillBonus * decryptorModifier)
}

/**
 * Fallback when per-skill levels are unknown: treat encryption + both datacores
 * as the same assumed level.
 */
export function inventionSuccessChance(baseChance: number, inventionSkillLevel: number): number {
  return inventionSuccessChanceFromLevels(
    baseChance,
    inventionSkillLevel,
    inventionSkillLevel,
    inventionSkillLevel,
  )
}

export interface InventionSkillLevels {
  encryption: number
  datacore1: number
  datacore2: number
}

/** Resolve invention skill levels from settings, falling back to inventionSkillLevel. */
export function resolveInventionSkillLevels(
  invention: InventionInfo | undefined,
  skills: Partial<SkillLevels> | undefined,
  fallbackLevel: number,
): InventionSkillLevels {
  if (!invention?.requiredSkills || Object.keys(invention.requiredSkills).length === 0) {
    return {
      encryption: fallbackLevel,
      datacore1: fallbackLevel,
      datacore2: fallbackLevel,
    }
  }

  const entries = Object.entries(invention.requiredSkills)
  const encryptionEntry = entries.find(([name]) => name.includes('Encryption'))
  const scienceEntries = entries.filter(([name]) => !name.includes('Encryption'))

  const levelFor = (skillName: string) => {
    const field = labelToField.get(skillName)
    if (field) return skillLevel(skills, field.key)
    return fallbackLevel
  }

  return {
    encryption: encryptionEntry ? levelFor(encryptionEntry[0]) : fallbackLevel,
    datacore1: scienceEntries[0] ? levelFor(scienceEntries[0][0]) : fallbackLevel,
    datacore2: scienceEntries[1] ? levelFor(scienceEntries[1][0]) : fallbackLevel,
  }
}

export function inventionChanceForBlueprint(
  invention: InventionInfo | undefined,
  skills: Partial<SkillLevels> | undefined,
  fallbackLevel: number,
  baseChance: number,
): number {
  if (!invention) return 0
  const levels = resolveInventionSkillLevels(invention, skills, fallbackLevel)
  return inventionSuccessChanceFromLevels(
    baseChance,
    levels.encryption,
    levels.datacore1,
    levels.datacore2,
  )
}

export function skillFieldByLabel(label: string): SkillFieldDef | undefined {
  return labelToField.get(label)
}
