import type { BpoLifetimeCategoryKey, BpoLifetimeRunsByCategory } from '@/types'
import {
  BPO_LIFETIME_CATEGORY_KEYS,
  DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY,
  MAX_BLUEPRINT_LIFETIME_RUNS,
  MIN_BLUEPRINT_LIFETIME_RUNS,
} from '@/types'

export const BPO_LIFETIME_CATEGORY_LABELS: Record<BpoLifetimeCategoryKey, string> = {
  ship: 'Ships',
  module: 'Modules',
  drone: 'Drones',
  deployable: 'Deployables',
  structure: 'Structures',
  default: 'Other',
}

const SDE_CATEGORY_TO_LIFETIME: Record<string, BpoLifetimeCategoryKey> = {
  Ship: 'ship',
  Module: 'module',
  Drone: 'drone',
  Deployable: 'deployable',
  Structure: 'structure',
}

export function clampLifetimeRuns(value: number): number {
  return Math.min(
    MAX_BLUEPRINT_LIFETIME_RUNS,
    Math.max(MIN_BLUEPRINT_LIFETIME_RUNS, Math.round(value) || MIN_BLUEPRINT_LIFETIME_RUNS),
  )
}

export function lifetimeCategoryKeyFromProductCategory(
  productCategory: string | undefined,
): BpoLifetimeCategoryKey {
  if (!productCategory) return 'default'
  return SDE_CATEGORY_TO_LIFETIME[productCategory] ?? 'default'
}

export function resolveBlueprintLifetimeRuns(
  productCategory: string | undefined,
  byCategory: BpoLifetimeRunsByCategory,
): number {
  const key = lifetimeCategoryKeyFromProductCategory(productCategory)
  return clampLifetimeRuns(byCategory[key] ?? DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY[key])
}

/** Merge saved settings with defaults; migrate legacy single global lifetime into "Other". */
export function normalizeBpoLifetimeRunsByCategory(
  parsed: Partial<BpoLifetimeRunsByCategory> | undefined,
  legacySingle?: number,
): BpoLifetimeRunsByCategory {
  const base = { ...DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY }
  if (typeof legacySingle === 'number') {
    base.default = clampLifetimeRuns(legacySingle)
  }
  if (parsed) {
    for (const key of BPO_LIFETIME_CATEGORY_KEYS) {
      if (typeof parsed[key] === 'number') {
        base[key] = clampLifetimeRuns(parsed[key]!)
      }
    }
  }
  return base
}
