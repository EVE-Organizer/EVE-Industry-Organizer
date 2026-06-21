import type { CharacterAccount } from '@/types'

export interface SkillFieldDef {
  key: keyof CharacterAccount['skills']
  skillId: number
  label: string
}

/** Skills collected during onboarding (Step 3). */
export const ONBOARDING_SKILL_FIELDS: SkillFieldDef[] = [
  { key: 'industry', skillId: 3380, label: 'Industry' },
  { key: 'massProduction', skillId: 3387, label: 'Mass Production' },
  { key: 'advancedIndustry', skillId: 24625, label: 'Advanced Industry' },
  { key: 'accounting', skillId: 16622, label: 'Accounting' },
  { key: 'brokerRelations', skillId: 3443, label: 'Broker Relations' },
  { key: 'metallurgy', skillId: 3402, label: 'Metallurgy' },
  { key: 'science', skillId: 3403, label: 'Science' },
  { key: 'research', skillId: 3406, label: 'Research' },
]

export { typeIconUrl as skillIconUrl } from '@/lib/eveImages'

export const SKILL_KEY_TO_ID: Record<SkillFieldDef['key'], number> = Object.fromEntries(
  ONBOARDING_SKILL_FIELDS.map((f) => [f.key, f.skillId]),
) as Record<SkillFieldDef['key'], number>

export function skillIdForKey(key: string): number | undefined {
  return SKILL_KEY_TO_ID[key as SkillFieldDef['key']]
}

export const SKILL_LEVEL_ROMAN = ['-', 'I', 'II', 'III', 'IV', 'V'] as const

export function formatSkillLevel(level: number): string {
  return SKILL_LEVEL_ROMAN[Math.min(5, Math.max(0, level))] ?? String(level)
}
