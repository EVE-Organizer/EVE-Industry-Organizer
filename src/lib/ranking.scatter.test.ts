import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { rankBlueprintsFromMarket } from '@/lib/ranking'
import { referenceMedianFromMaps } from '@/lib/hubPriceSanity'
import { buildBlueprintRankingSettings } from '@/lib/structureSettings'
import { buildTypeMap } from '@/services/data/sdeLoader'
import { DEFAULT_SETTINGS, type BlueprintRegistry, type HubId, type MarketData, type RegionsData, type TimeRange, type TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

const TRITANIUM = 34

function cloneMarket(market: MarketData): MarketData {
  return JSON.parse(JSON.stringify(market)) as MarketData
}

function setHubQuote(
  market: MarketData,
  hub: HubId,
  typeId: number,
  avgPrice: number,
  avgVolume: number,
) {
  const hubMarket = market.hubs[hub]
  hubMarket.prices[String(typeId)] = avgPrice
  const existing = hubMarket.products[String(typeId)] ?? {}
  const windows: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']
  const next = { ...existing }
  for (const window of windows) {
    next[window] = {
      avgPrice,
      avgVolume,
      high: avgPrice,
      low: avgPrice,
    }
  }
  hubMarket.products[String(typeId)] = next
}

describe('rankBlueprintsFromMarket scatter-cheap buy quotes', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const baseMarket = loadFixture<MarketData>('public/data/market.json')
  const regions = loadFixture<RegionsData>('public/data/regions.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
  const typeMap = buildTypeMap(types)
  const systems = loadFixture<import('@/types').SystemInfo[]>('public/data/systems.json')

  const settings = buildBlueprintRankingSettings(
    { ...DEFAULT_SETTINGS, sellHubId: 'jita', primaryHub: 'vale' },
    systems,
    { mfgSystem: DEFAULT_SETTINGS.manufacturingSystemId, rankingTimeHours: 24, priceMethod: 'sell_orders' },
  )
  const filters = {
    minSetupCost: 0,
    maxSetupCost: Number.MAX_SAFE_INTEGER,
    buildableOnly: false,
    requireBlueprintPrice: false,
    minVolume: 0,
    tiers: ['t1'] as ('t1' | 't2' | 'faction')[],
    productGroups: ['Projectile Ammo'],
    includeHaulCost: false,
    limit: 20,
  }

  function rank(market: MarketData) {
    return rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'vale',
      '1m',
      settings,
      filters,
      systems,
    )
  }

  it('does not cost Tritanium at a 1 ISK Vale thin quote', () => {
    const npcPrices = new Map<HubId, Map<number, number>>()
    for (const hub of ['jita', 'amarr', 'dodixie', 'rens', 'hek'] as const) {
      const avg = baseMarket.hubs[hub].products[String(TRITANIUM)]?.['1m']?.avgPrice ?? 0
      npcPrices.set(hub, new Map([[TRITANIUM, avg]]))
    }
    const median = referenceMedianFromMaps(TRITANIUM, npcPrices)
    expect(median).toBeGreaterThan(1)

    const poisoned = cloneMarket(baseMarket)
    setHubQuote(poisoned, 'vale', TRITANIUM, 0.01, 1)

    const floored = cloneMarket(baseMarket)
    setHubQuote(floored, 'vale', TRITANIUM, median!, 50_000)

    const cheapRows = rank(poisoned)
    const fairRows = rank(floored)
    expect(cheapRows.length).toBeGreaterThan(0)
    expect(fairRows.length).toBeGreaterThan(0)

    const cheap = cheapRows.find((row) =>
      row.blueprint.materials.some((mat) => mat.typeId === TRITANIUM),
    )
    const fair = fairRows.find((row) => row.blueprint.productTypeId === cheap?.blueprint.productTypeId)
    expect(cheap).toBeDefined()
    expect(fair).toBeDefined()
    expect(cheap!.setupBreakdown.materialCost).toBeCloseTo(fair!.setupBreakdown.materialCost, 0)
    expect(cheap!.setupBreakdown.materialCost).toBeGreaterThan(1)
  })
})
