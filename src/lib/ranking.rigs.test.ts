import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { rankBlueprintsFromMarket } from '@/lib/ranking'
import { buildBlueprintRankingSettings } from '@/lib/structureSettings'
import { buildTypeMap } from '@/services/data/sdeLoader'
import { DEFAULT_SETTINGS, type BlueprintRegistry, type MarketData, type RegionsData, type TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('rankBlueprintsFromMarket structure rigs', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const market = loadFixture<MarketData>('public/data/market.json')
  const regions = loadFixture<RegionsData>('public/data/regions.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
  const typeMap = buildTypeMap(types)
  const systems = [{ systemId: 30002780, security: -0.5, name: 'Null', regionId: 10000001 }]

  const filters = {
    minSetupCost: 0,
    maxSetupCost: Number.MAX_SAFE_INTEGER,
    buildableOnly: false,
    tiers: ['t1'] as ('t1' | 't2' | 'faction')[],
    productGroups: ['Projectile Ammo'],
  }

  it('fits more ammo runs in the same target job time when family rigs are fitted', () => {
    const query = {
      mfgSystem: 30002780,
      rankingTimeHours: 24,
      priceMethod: 'sell_orders' as const,
    }
    const base = buildBlueprintRankingSettings(
      { ...DEFAULT_SETTINGS, structureType: 'sotiyo', meDefault: 10, teDefault: 20 },
      systems,
      query,
    )
    const rigged = buildBlueprintRankingSettings(
      {
        ...DEFAULT_SETTINGS,
        structureType: 'sotiyo',
        meDefault: 10,
        teDefault: 20,
        manufacturingRigs: {
          ...DEFAULT_SETTINGS.manufacturingRigs,
          familyRigs: { ammo: { meRig: 't2', teRig: 't2' } },
        },
      },
      systems,
      query,
    )

    const rank = (settings: typeof base) =>
      rankBlueprintsFromMarket(
        registry,
        market,
        regions,
        typeMap,
        'jita',
        '1w',
        settings,
        filters,
        systems,
      ).find((r) => r.blueprint.productTypeId === 178)

    const hullOnlyRow = rank(base)
    const riggedRow = rank(rigged)
    expect(hullOnlyRow).toBeDefined()
    expect(riggedRow).toBeDefined()
    expect(riggedRow!.iphBreakdown.runs).toBeGreaterThan(hullOnlyRow!.iphBreakdown.runs)
    expect(riggedRow!.jobTimeSeconds).toBeGreaterThan(20 * 3600)
    expect(hullOnlyRow!.jobTimeSeconds).toBeGreaterThan(20 * 3600)
    expect(riggedRow!.setupBreakdown.facilityBonus?.rigTeBonusPercent ?? 0).toBeGreaterThan(0)
  })
})
