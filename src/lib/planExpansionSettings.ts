import type { GlobalSettings } from '@/types'

/** Settings fields that affect plan expansion, scheduling, and build-cost math. */
export function planExpansionSettingsKey(settings: GlobalSettings): string {
  return JSON.stringify({
    skills: settings.skills,
    meDefault: settings.meDefault,
    teDefault: settings.teDefault,
    inventionSkillLevel: settings.inventionSkillLevel,
    structureType: settings.structureType,
    structureMeBonusPercent: settings.structureMeBonusPercent,
    structureTeBonusPercent: settings.structureTeBonusPercent,
    structureJobCostBonusPercent: settings.structureJobCostBonusPercent,
    manufacturingRigs: settings.manufacturingRigs,
    structureTaxPercent: settings.structureTaxPercent,
    reactionFacility: settings.reactionFacility,
    includeBlueprintCost: settings.includeBlueprintCost,
    blueprintLifetimeRunsByCategory: settings.blueprintLifetimeRunsByCategory,
  })
}
