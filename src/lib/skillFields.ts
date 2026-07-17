import type { SkillLevels } from '@/types'
import { ZERO_SKILLS } from '@/types'

export interface SkillPrerequisite {
  key: keyof SkillLevels
  level: number
}

export interface SkillFieldDef {
  key: keyof SkillLevels
  skillId: number
  label: string
  tooltip: string
  prerequisites?: SkillPrerequisite[]
}

/** Manufacturing and market skills editable in Settings. */
export const SKILL_FIELDS: SkillFieldDef[] = [
  {
    key: 'industry',
    skillId: 3380,
    label: 'Industry',
    tooltip:
      'Required by most manufacturing blueprints. Your level is checked against each blueprint\'s Industry requirement for the "Only buildable" filter and skill gap flags.',
  },
  {
    key: 'advancedIndustry',
    skillId: 3388,
    label: 'Advanced Industry',
    tooltip:
      'Cuts manufacturing job time by 3% per level. Higher levels raise IPH and profit per hour in rankings. Also required by some advanced blueprints.',
    prerequisites: [{ key: 'industry', level: 3 }],
  },
  {
    key: 'massProduction',
    skillId: 3387,
    label: 'Mass Production',
    tooltip:
      'Adds one concurrent manufacturing job per level (plus one base slot). Used for production plan timelines.',
    prerequisites: [{ key: 'industry', level: 3 }],
  },
  {
    key: 'advancedMassProduction',
    skillId: 24625,
    label: 'Advanced Mass Production',
    tooltip:
      'Adds one more concurrent manufacturing job per level on top of Mass Production. Max 11 slots at V/V.',
    prerequisites: [{ key: 'massProduction', level: 5 }],
  },
  {
    key: 'science',
    skillId: 3403,
    label: 'Science',
    tooltip:
      'Required by a small set of blueprints (e.g. some tech items). Used for the buildable filter and skill gap flags, same as Industry.',
  },
  {
    key: 'accounting',
    skillId: 16622,
    label: 'Accounting',
    tooltip:
      'Lowers sales tax on market sales. NPC base is 7.5%; each level removes 11% of that base (3.375% at level V). Applied to net revenue in profit and ranking calculations.',
  },
  {
    key: 'brokerRelations',
    skillId: 3443,
    label: 'Broker Relations',
    tooltip:
      'Lowers broker fee when listing sell orders. NPC base is 3%; each level removes 0.3 percentage points (1.5% at level V). Not charged on instant buy-order sales.',
  },
]

export { typeIconUrl as skillIconUrl } from '@/lib/eveImages'

export const SKILL_KEY_TO_ID: Record<SkillFieldDef['key'], number> = Object.fromEntries(
  SKILL_FIELDS.map((f) => [f.key, f.skillId]),
) as Record<SkillFieldDef['key'], number>

export function skillIdForKey(key: string): number | undefined {
  return SKILL_KEY_TO_ID[key as SkillFieldDef['key']]
}

export const SKILL_LEVEL_ROMAN = ['-', 'I', 'II', 'III', 'IV', 'V'] as const

export function formatSkillLevel(level: number): string {
  return SKILL_LEVEL_ROMAN[Math.min(5, Math.max(0, level))] ?? String(level)
}

/** Merge an ESI or character snapshot onto zero defaults for every tracked skill. */
export function normalizeImportedSkillLevels(skills: Partial<SkillLevels> | undefined): SkillLevels {
  return enforceSkillPrerequisites({ ...ZERO_SKILLS, ...(skills ?? {}) } as SkillLevels)
}

export function skillLevel(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): number {
  const level = skills?.[key]
  return typeof level === 'number' ? level : ZERO_SKILLS[key]
}

export function prerequisitesMet(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): boolean {
  const field = SKILL_FIELDS.find((f) => f.key === key)
  if (!field?.prerequisites?.length) return true
  return field.prerequisites.every((req) => skillLevel(skills, req.key) >= req.level)
}

/** Highest level the slider allows (0 when prerequisites are not met). */
export function maxTrainableSkillLevel(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): number {
  return prerequisitesMet(skills, key) ? 5 : 0
}

/** Level that counts for profit, IPH, and plan slots (0 when locked). */
export function effectiveSkillLevel(
  skills: Partial<SkillLevels> | undefined,
  key: SkillFieldDef['key'],
): number {
  if (!prerequisitesMet(skills, key)) return 0
  return skillLevel(skills, key)
}

export function skillPrerequisiteLabel(key: SkillFieldDef['key']): string | undefined {
  const field = SKILL_FIELDS.find((f) => f.key === key)
  if (!field?.prerequisites?.length) return undefined
  const parts = field.prerequisites.map((req) => {
    const prereq = SKILL_FIELDS.find((f) => f.key === req.key)
    return `${prereq?.label ?? req.key} ${formatSkillLevel(req.level)}`
  })
  return `Requires ${parts.join(' and ')}`
}

/** Zero dependent skills when their prerequisites are no longer met. */
export function enforceSkillPrerequisites(skills: SkillLevels): SkillLevels {
  const result = { ...skills }
  for (const { key } of SKILL_FIELDS) {
    if (!prerequisitesMet(result, key)) {
      result[key] = 0
    }
  }
  return result
}
