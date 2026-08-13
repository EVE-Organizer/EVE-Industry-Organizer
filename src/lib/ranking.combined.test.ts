import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { defaultQuery } from '@/lib/blueprintQuery'
import { finalizeRankedRows, rankBlueprintsFromMarket, setupBudgetFromSlider } from '@/lib/ranking'
import { buildTypeMap } from '@/services/data/sdeLoader'
import type { BlueprintRegistry, GlobalSettings, TypeInfo } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** Goal-Orienting Neurolink Stabilizer from user screenshot (~425K ISK/hr formulas-only). */
const GOAL_ORIENTING_TYPE_ID = 57469

describe('combined ranking includes high-iph formulas', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const market = loadFixture<import('@/types').MarketData>('public/data/market.json')
  const regions = loadFixture<import('@/types').RegionsData>('public/data/regions.json')
  const systems = loadFixture<import('@/types').SystemInfo[]>('public/data/systems.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types!
  const typeMap = buildTypeMap(types)

  const q = defaultQuery(DEFAULT_SETTINGS)
  const settings: GlobalSettings & { batchSize: number } = {
    ...DEFAULT_SETTINGS,
    batchSize: q.batchSize,
    priceMethod: q.priceMethod,
    manufacturingSystemId: q.mfgSystem,
  }
  const baseFilters = {
    minSetupCost: setupBudgetFromSlider(q.budgetMinSlider),
    maxSetupCost: setupBudgetFromSlider(q.budgetMaxSlider),
    buildableOnly: q.buildableOnly,
    requireBlueprintPrice: q.requireBlueprintPrice,
    includeHaulCost: q.includeHaul,
    minVolume: q.minVolume,
    tiers: q.tiers,
    sortBy: 'iph' as const,
    sortDirection: 'desc' as const,
    limit: 50,
  }

  it('default setup budget filters high-capital formulas that still rank well', () => {
    const relaxed = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      q.hub,
      q.window,
      settings,
      {
        ...baseFilters,
        recipeKinds: ['reaction'],
        requireBlueprintPrice: false,
        maxSetupCost: Number.POSITIVE_INFINITY,
        minVolume: 0,
        limit: 500,
      },
      systems,
    )
    const goal = relaxed.find((r) => r.blueprint.productTypeId === GOAL_ORIENTING_TYPE_ID)
    expect(goal).toBeDefined()
    expect(goal!.iph).toBeGreaterThan(400_000)
    expect(goal!.upfrontCapital).toBeGreaterThan(baseFilters.maxSetupCost)

    const defaultFormula = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      q.hub,
      q.window,
      settings,
      { ...baseFilters, recipeKinds: ['reaction'] },
      systems,
    )
    expect(
      defaultFormula.find((r) => r.blueprint.productTypeId === GOAL_ORIENTING_TYPE_ID),
    ).toBeUndefined()
  })

  it('keeps top formulas visible when both recipe kinds are selected', () => {
    const openBudget = {
      ...baseFilters,
      requireBlueprintPrice: false,
      maxSetupCost: Number.POSITIVE_INFINITY,
      minVolume: 0,
    }
    const both = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      q.hub,
      q.window,
      settings,
      { ...openBudget, recipeKinds: ['manufacturing', 'reaction'] },
      systems,
    )

    const goal = both.find((r) => r.blueprint.productTypeId === GOAL_ORIENTING_TYPE_ID)
    expect(goal).toBeDefined()
    expect(goal!.iph).toBeGreaterThan(400_000)
    expect(both.some((r) => r.blueprint.kind === 'reaction')).toBe(true)
    expect(both.some((r) => r.blueprint.kind !== 'reaction')).toBe(true)
    expect(both.length).toBeLessThanOrEqual(100)
  })

  it('finalizeRankedRows takes top N from each kind when both are active', () => {
    const rows = [
      { blueprint: { kind: 'manufacturing' }, iph: 100, setupCost: 0, netProfit: 0, margin: 0, avgVolume: 0 } as never,
      { blueprint: { kind: 'manufacturing' }, iph: 90, setupCost: 0, netProfit: 0, margin: 0, avgVolume: 0 } as never,
      { blueprint: { kind: 'reaction' }, iph: 80, setupCost: 0, netProfit: 0, margin: 0, avgVolume: 0 } as never,
      { blueprint: { kind: 'reaction' }, iph: 200, setupCost: 0, netProfit: 0, margin: 0, avgVolume: 0 } as never,
    ]
    const out = finalizeRankedRows(rows, {
      recipeKinds: ['manufacturing', 'reaction'],
      sortBy: 'iph',
      sortDirection: 'desc',
      limit: 1,
    })
    expect(out).toHaveLength(2)
    expect(out[0]!.iph).toBe(200)
    expect(out[1]!.iph).toBe(100)
  })
})
