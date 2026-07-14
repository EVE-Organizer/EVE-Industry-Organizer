import { describe, expect, it } from 'vitest'
import { DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY } from '@/types'
import {
  clampLifetimeRuns,
  lifetimeCategoryKeyFromProductCategory,
  normalizeBpoLifetimeRunsByCategory,
  resolveBlueprintLifetimeRuns,
} from '@/lib/bpoLifetime'

describe('bpoLifetime', () => {
  it('maps SDE product categories to lifetime buckets', () => {
    expect(lifetimeCategoryKeyFromProductCategory('Ship')).toBe('ship')
    expect(lifetimeCategoryKeyFromProductCategory('Module')).toBe('module')
    expect(lifetimeCategoryKeyFromProductCategory('Drone')).toBe('drone')
    expect(lifetimeCategoryKeyFromProductCategory('Deployable')).toBe('deployable')
    expect(lifetimeCategoryKeyFromProductCategory('Structure')).toBe('structure')
    expect(lifetimeCategoryKeyFromProductCategory('Charge')).toBe('default')
    expect(lifetimeCategoryKeyFromProductCategory(undefined)).toBe('default')
  })

  it('resolves lifetime runs from category settings', () => {
    const byCategory = {
      ...DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY,
      ship: 80,
      module: 600,
    }
    expect(resolveBlueprintLifetimeRuns('Ship', byCategory)).toBe(80)
    expect(resolveBlueprintLifetimeRuns('Module', byCategory)).toBe(600)
    expect(resolveBlueprintLifetimeRuns('Commodity', byCategory)).toBe(
      DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY.default,
    )
  })

  it('migrates legacy single lifetime into the Other bucket', () => {
    const migrated = normalizeBpoLifetimeRunsByCategory(undefined, 1200)
    expect(migrated.default).toBe(1200)
    expect(migrated.ship).toBe(DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY.ship)
  })

  it('clamps lifetime runs', () => {
    expect(clampLifetimeRuns(0)).toBe(1)
    expect(clampLifetimeRuns(200_000)).toBe(100_000)
  })
})
