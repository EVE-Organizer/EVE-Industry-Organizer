import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { defaultQuery } from '@/lib/blueprintQuery'
import { rankBlueprintsFromMarket, setupBudgetFromSlider } from '@/lib/ranking'
import { buildTypeMap } from '@/services/data/sdeLoader'
import type { BlueprintRegistry, GlobalSettings, TypeInfo } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('ranking recipe kinds with default page filters', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const market = loadFixture<import('@/types').MarketData>('public/data/market.json')
  const regions = loadFixture<import('@/types').RegionsData>('public/data/regions.json')
  const systems = loadFixture<import('@/types').SystemInfo[]>('public/data/systems.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types!
  const typeMap = buildTypeMap(types)

  it('surfaces reaction formulas somewhere in an expanded ranking with default filters', () => {
    const q = defaultQuery(DEFAULT_SETTINGS)
    const settings: GlobalSettings & { batchSize: number } = {
      ...DEFAULT_SETTINGS,
      batchSize: q.batchSize,
      priceMethod: q.priceMethod,
      manufacturingSystemId: q.mfgSystem,
    }

    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      q.hub,
      q.window,
      settings,
      {
        minSetupCost: setupBudgetFromSlider(q.budgetMinSlider),
        maxSetupCost: setupBudgetFromSlider(q.budgetMaxSlider),
        buildableOnly: q.buildableOnly,
        requireBlueprintPrice: q.requireBlueprintPrice,
        recipeKinds: ['manufacturing', 'reaction'],
        includeHaulCost: q.includeHaul,
        minVolume: q.minVolume,
        tiers: q.tiers,
        limit: 500,
      },
      systems,
    )

    expect(rows.some((r) => r.blueprint.kind === 'reaction')).toBe(true)
  })

  it('shows reaction formulas in default top 50 when recipe filter is formulas only', () => {
    const q = defaultQuery(DEFAULT_SETTINGS)
    const settings: GlobalSettings & { batchSize: number } = {
      ...DEFAULT_SETTINGS,
      batchSize: q.batchSize,
      priceMethod: q.priceMethod,
      manufacturingSystemId: q.mfgSystem,
    }

    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      q.hub,
      q.window,
      settings,
      {
        minSetupCost: setupBudgetFromSlider(q.budgetMinSlider),
        maxSetupCost: setupBudgetFromSlider(q.budgetMaxSlider),
        buildableOnly: q.buildableOnly,
        requireBlueprintPrice: q.requireBlueprintPrice,
        recipeKinds: ['reaction'],
        includeHaulCost: q.includeHaul,
        minVolume: q.minVolume,
        tiers: q.tiers,
        limit: 50,
      },
      systems,
    )

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.blueprint.kind === 'reaction')).toBe(true)
  })
})
