import type { ManufacturingPlanTemplate, SkillLevels } from '@/types'
import { effectiveSkillLevel } from '@/lib/skillFields'

/** EVE: 1 base + Mass Production + Advanced Mass Production (max 11 at V/V). */
export function manufacturingSlotsFromSkills(skills: Partial<SkillLevels> | undefined): number {
  const mass = effectiveSkillLevel(skills, 'massProduction')
  const advanced = effectiveSkillLevel(skills, 'advancedMassProduction')
  return 1 + mass + advanced
}

/** @deprecated Slots always come from character/settings skills. */
export function resolveTemplateSlots(
  _template: Pick<ManufacturingPlanTemplate, 'slotSource' | 'manufacturingSlots'>,
  skills: Partial<SkillLevels> | undefined,
): number {
  return manufacturingSlotsFromSkills(skills)
}
