import type { BlueprintInfo, GlobalSettings, RecipeKind } from '@/types'
import { isActiveRefinery } from '@/lib/refinerySettings'

/** SDE activity IDs for industry jobs. */
export const MANUFACTURING_ACTIVITY = 1
export const REACTION_ACTIVITY = 11

export function recipeKind(blueprint: BlueprintInfo): RecipeKind {
  return blueprint.kind ?? 'manufacturing'
}

export function isReactionRecipe(blueprint: BlueprintInfo): boolean {
  return recipeKind(blueprint) === 'reaction'
}

export function isManufacturingRecipe(blueprint: BlueprintInfo): boolean {
  return recipeKind(blueprint) === 'manufacturing'
}

export function costIndexForRecipe(
  kind: RecipeKind,
  manufacturingIndex: number,
  reactionIndex: number,
): number {
  return kind === 'reaction' ? reactionIndex : manufacturingIndex
}

/** Reactions need an active refinery; "none" means buy from market. */
export function canRunReactionJobs(settings: GlobalSettings): boolean {
  return isActiveRefinery(settings.reactionFacility.refineryType)
}
