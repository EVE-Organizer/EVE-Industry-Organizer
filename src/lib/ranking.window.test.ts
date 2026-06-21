import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { applyME, estimateJobCost, materialCost } from '@/lib/cost'
import { WIDER_TIME_RANGES } from '@/lib/profit'
import { marketAwareIph, rankBlueprintsFromMarket } from '@/lib/ranking'
import { buildPriceMap, buildTypeMap, getHubMarket } from '@/services/data/sdeLoader'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintRegistry, MarketData, RegionsData, TimeRange, TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function pickWindowAvg(
  history: Partial<Record<TimeRange, { avgPrice: number }>>,
  window: TimeRange,
): number | null {
  const tryWindow = (w: TimeRange) => {
    const avg = history[w]?.avgPrice
    return avg && avg > 0 ? avg : null
  }
  const exact = tryWindow(window)
  if (exact) return exact
  for (const wider of WIDER_TIME_RANGES[window]) {
    const avg = tryWindow(wider)
    if (avg) return avg
  }
  return null
}

function setupCostForAmmoWindow(
  market: MarketData,
  regions: RegionsData,
  registry: BlueprintRegistry,
  window: TimeRange,
): number {
  const hubMarket = getHubMarket(market, 'jita')!
  const spot = buildPriceMap(hubMarket)
  const blueprint = registry.blueprints.find((b) => b.productTypeId === 178)!
  const region = regions.regions.find((r) => r.regionId === hubMarket.regionId)!
  const runs = 100
  const me = 10

  const windowPrices = new Map(spot)
  for (const [key, byWindow] of Object.entries(hubMarket.products)) {
    const avg = pickWindowAvg(byWindow, window)
    if (avg) windowPrices.set(Number(key), avg)
  }

  const mats = applyME(blueprint.materials, me, runs)
  const matCost = materialCost(mats, windowPrices)
  const jobCost = estimateJobCost(matCost, region.costIndex)
  return matCost + jobCost
}

describe('window-based material costs', () => {
  it('stores mineral history and ammo setup cost shifts with window', () => {
    const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
    const market = loadFixture<MarketData>('public/data/market.json')
    const regions = loadFixture<RegionsData>('public/data/regions.json')
    const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
    const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
    const typeMap = buildTypeMap(types)

    const hubMarket = getHubMarket(market, 'jita')!
    const tritHistory = hubMarket.products['34']
    expect(tritHistory?.['1w']?.avgPrice).toBeGreaterThan(0)
    expect(tritHistory?.['1y']?.avgPrice).toBeGreaterThan(0)
    expect(tritHistory?.['1w']?.avgPrice).not.toBe(tritHistory?.['1y']?.avgPrice)

    const setupByWindow = {
      '1w': setupCostForAmmoWindow(market, regions, registry, '1w'),
      '1m': setupCostForAmmoWindow(market, regions, registry, '1m'),
      '1y': setupCostForAmmoWindow(market, regions, registry, '1y'),
    }

    expect(new Set(Object.values(setupByWindow)).size).toBeGreaterThan(1)

    const ammoHistory = hubMarket.products['178']!
    expect(ammoHistory['1w']?.avgVolume).toBeGreaterThan(0)
    expect(ammoHistory['1m']?.avgVolume).toBeGreaterThan(0)
    expect(ammoHistory['1w']!.avgVolume).not.toBe(ammoHistory['1m']!.avgVolume)

    const volumeByWindow = Object.fromEntries(
      (['1w', '1m', '1y'] as TimeRange[]).map((window) => {
        const rows = rankBlueprintsFromMarket(
          registry,
          market,
          regions,
          typeMap,
          'jita',
          window,
          { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 },
          {
            minSetupCost: 0,
            maxSetupCost: Number.MAX_SAFE_INTEGER,
            buildableOnly: false,
            tier: 't1' as const,
            productGroup: 'Projectile Ammo',
          },
        )
        const ammo = rows.find((r) => r.blueprint.productTypeId === 178)
        return [window, ammo?.avgVolume ?? null]
      }),
    )

    expect(volumeByWindow['1w']).not.toBeNull()
    expect(volumeByWindow['1m']).not.toBeNull()
    expect(new Set(Object.values(volumeByWindow)).size).toBeGreaterThan(1)

    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const filters = {
      minSetupCost: 0,
      maxSetupCost: Number.MAX_SAFE_INTEGER,
      buildableOnly: false,
      tier: 't1' as const,
      productGroup: 'Projectile Ammo',
    }

    const ranked1w = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      filters,
    )
    const ranked1y = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1y',
      settings,
      filters,
    )

    expect(ranked1w.length).toBeGreaterThan(0)
    expect(ranked1y.length).toBeGreaterThan(0)
  })
})

describe('marketAwareIph', () => {
  it('applies a lower competition factor when production share exceeds market volume', () => {
    const thinMarket = marketAwareIph(1_000_000_000, 100, 24, 2.8)
    const deepMarket = marketAwareIph(1_000_000_000, 10_000, 24, 142_875)

    expect(thinMarket.marketShare).toBeGreaterThan(1)
    expect(deepMarket.marketShare).toBeLessThan(1)
    expect(thinMarket.competitionFactor).toBeLessThan(deepMarket.competitionFactor)
  })

  it('caps realized profit at market volume when production exceeds daily trades', () => {
    const capped = marketAwareIph(500_000_000, 100, 24, 5)
    const uncappedByVolume = marketAwareIph(500_000_000, 100, 24, 10_000)

    expect(capped.iph).toBeLessThan(uncappedByVolume.iph)
  })
})

describe('market-aware blueprint ranking', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const market = loadFixture<MarketData>('public/data/market.json')
  const regions = loadFixture<RegionsData>('public/data/regions.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
  const typeMap = buildTypeMap(types)

  const PROJECTILE_AMMO = 178
  const CONDENSER_GALVASURGE = 54773

  it('ranks charge blueprints even when hub BPO price is missing', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.MAX_SAFE_INTEGER,
        buildableOnly: false,
        tier: 't1',
        productGroup: 'Condenser Pack',
      },
    )

    const condenser = rows.find((r) => r.blueprint.productTypeId === CONDENSER_GALVASURGE)
    expect(condenser).toBeDefined()
    expect(condenser!.setupBreakdown.blueprintCost.chargeExcluded).toBe(true)
    expect(condenser!.setupBreakdown.bpoCost).toBe(0)
  })

  it('includes T1 ice compression BPOs once blueprint BPO types are in types.json', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.MAX_SAFE_INTEGER,
        buildableOnly: false,
        tier: 't1',
        productGroup: 'Ice',
      },
    )

    const iceCompression = rows.find((r) => r.blueprint.blueprintTypeId === 28495)
    expect(iceCompression).toBeDefined()
    expect(iceCompression!.setupBreakdown.bpoUnitPrice).toBeGreaterThan(0)
  })

  it('excludes T1 blueprints with no hub BPO price when blueprint cost is included', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.MAX_SAFE_INTEGER,
        buildableOnly: false,
        tier: 't1',
        productGroup: 'all',
      },
    )

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.setupBreakdown.blueprintCost.bpoPriceMissing).toBeUndefined()
      // Charges intentionally skip the BPO cost, so they may lack a hub BPO price.
      if (row.setupBreakdown.blueprintCost.chargeExcluded) continue
      expect(row.setupBreakdown.bpoUnitPrice).toBeGreaterThan(0)
    }
  })

  it('excludes BPO cost for charges (huge volume from one reusable BPO)', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.MAX_SAFE_INTEGER,
        buildableOnly: false,
        tier: 't1',
        productGroup: 'Projectile Ammo',
      },
    )

    const ammo = rows.find((r) => r.blueprint.productTypeId === PROJECTILE_AMMO)
    expect(ammo).toBeDefined()
    expect(ammo!.setupBreakdown.bpoCost).toBe(0)
    expect(ammo!.setupBreakdown.blueprintCost.chargeExcluded).toBe(true)
    expect(ammo!.setupCost).toBe(
      ammo!.setupBreakdown.materialCost +
        ammo!.setupBreakdown.jobCost +
        ammo!.setupBreakdown.haulIn,
    )
    expect(ammo!.upfrontCapital).toBe(ammo!.setupCost)
    expect(ammo!.setupBreakdown.blueprintCost.mode).toBe('bpo')
  })

  it('excludes haul cost when includeHaulCost is off', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const baseFilters = {
      minSetupCost: 0,
      maxSetupCost: Number.MAX_SAFE_INTEGER,
      buildableOnly: false,
      tier: 't1' as const,
      productGroup: 'Projectile Ammo',
    }

    const rowsWithHaul = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      { ...baseFilters, includeHaulCost: true },
    )
    const rowsWithoutHaul = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      { ...baseFilters, includeHaulCost: false },
    )

    const withRow = rowsWithHaul.find((r) => r.blueprint.productTypeId === PROJECTILE_AMMO)
    const withoutRow = rowsWithoutHaul.find((r) => r.blueprint.productTypeId === PROJECTILE_AMMO)
    expect(withRow).toBeDefined()
    expect(withoutRow).toBeDefined()
    expect(withoutRow!.haulIn).toBe(0)
    expect(withoutRow!.haulOut).toBe(0)
    expect(withoutRow!.setupBreakdown.haulExcluded).toBe(true)
    expect(withoutRow!.setupCost).toBeLessThan(withRow!.setupCost)
    expect(withoutRow!.netProfit).toBeGreaterThan(withRow!.netProfit)
  })

  it('ranks faction blueprints as BPCs with no BPO acquisition cost', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 10, teDefault: 20 }
    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.MAX_SAFE_INTEGER,
        buildableOnly: false,
        tier: 'faction',
        productGroup: 'all',
      },
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows.slice(0, 5)) {
      expect(row.blueprint.tier).toBe('faction')
      expect(row.setupBreakdown.blueprintCost.mode).toBe('faction_bpc')
      expect(row.setupBreakdown.bpoCost).toBe(0)
      expect(row.setupBreakdown.blueprintCost.bpoPriceMissing).toBeUndefined()
      // BPCs cannot be researched, so faction stays at ME0/TE0.
      expect(row.iphBreakdown.me).toBe(0)
      expect(row.iphBreakdown.te).toBe(0)
      expect(row.upfrontCapital).toBe(
        row.setupBreakdown.materialCost + row.setupBreakdown.jobCost + row.setupBreakdown.haulIn,
      )
    }
  })

  it('ranks T2 blueprints with invention cost and ME2/TE4', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      batchSize: 100,
      meDefault: 10,
      teDefault: 20,
      inventionSkillLevel: 4,
    }
    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      'jita',
      '1w',
      settings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.MAX_SAFE_INTEGER,
        buildableOnly: false,
        tier: 't2',
        productGroup: 'all',
      },
    )

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows.slice(0, 5)) {
      expect(row.blueprint.invention).toBeDefined()
      expect(row.iphBreakdown.me).toBe(2)
      expect(row.iphBreakdown.te).toBe(4)
      expect(row.setupBreakdown.blueprintCost.mode).toBe('invention')
      expect(row.setupBreakdown.bpoCost).toBeGreaterThan(0)
      expect(row.upfrontCapital).toBe(row.setupCost)
    }
  })
})
