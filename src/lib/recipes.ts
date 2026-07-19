import type { BlueprintInfo, RecipeKind } from '@/types'

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
