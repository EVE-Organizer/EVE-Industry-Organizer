import type { BlueprintInfo, CharacterAccount } from '@/types'
import { ONBOARDING_SKILL_FIELDS } from '@/lib/skillFields'

export interface MissingBuildSkill {
  skillName: string
  skillId: number
  requiredLevel: number
  currentLevel: number
}

const nameToField = new Map(ONBOARDING_SKILL_FIELDS.map((f) => [f.label, f]))

export function getMissingBuildSkills(
  blueprint: BlueprintInfo,
  account?: CharacterAccount,
): MissingBuildSkill[] {
  if (!account) return []

  const missing: MissingBuildSkill[] = []
  for (const [skillName, requiredLevel] of Object.entries(blueprint.requiredSkills)) {
    const field = nameToField.get(skillName)
    if (!field) continue
    const currentLevel = account.skills[field.key] ?? 0
    if (currentLevel < requiredLevel) {
      missing.push({
        skillName,
        skillId: field.skillId,
        requiredLevel,
        currentLevel,
      })
    }
  }
  return missing
}

export function meetsBuildRequirements(
  blueprint: BlueprintInfo,
  account?: CharacterAccount,
): boolean {
  return getMissingBuildSkills(blueprint, account).length === 0
}
