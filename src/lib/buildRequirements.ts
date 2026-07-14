import type { BlueprintInfo, SkillLevels } from '@/types'
import { SKILL_FIELDS, skillLevel } from '@/lib/skillFields'

export interface MissingBuildSkill {
  skillName: string
  skillId: number
  requiredLevel: number
  currentLevel: number
}

const nameToField = new Map(SKILL_FIELDS.map((f) => [f.label, f]))

export function getMissingBuildSkills(
  blueprint: BlueprintInfo,
  skills?: SkillLevels,
): MissingBuildSkill[] {
  if (!skills) return []

  const missing: MissingBuildSkill[] = []
  for (const [skillName, requiredLevel] of Object.entries(blueprint.requiredSkills)) {
    const field = nameToField.get(skillName)
    if (!field) continue
    const currentLevel = skillLevel(skills, field.key)
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
  skills?: SkillLevels,
): boolean {
  return getMissingBuildSkills(blueprint, skills).length === 0
}
