import type { ManufacturingPlanTemplate, SkillLevels } from '@/types'
import { skillLevel } from '@/lib/skillFields'

/** EVE: 1 base + Mass Production + Advanced Mass Production (max 11 at V/V). */
export function manufacturingSlotsFromSkills(skills: Partial<SkillLevels> | undefined): number {
  const mass = skillLevel(skills, 'massProduction')
  const advanced = skillLevel(skills, 'advancedMassProduction')
  return 1 + mass + advanced
}

/** @deprecated Slots always come from character/settings skills. */
export function resolveTemplateSlots(
  _template: Pick<ManufacturingPlanTemplate, 'slotSource' | 'manufacturingSlots'>,
  skills: Partial<SkillLevels> | undefined,
): number {
  return manufacturingSlotsFromSkills(skills)
}
