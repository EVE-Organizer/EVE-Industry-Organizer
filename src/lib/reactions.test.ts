import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import {
  applyReactionTime,
  totalManufacturingCost,
} from '@/lib/cost'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { buildSupplyChain } from '@/lib/supplyChain'
import { rankBlueprintsFromMarket } from '@/lib/ranking'
import { buildTypeMap, getAllBlueprints, getBlueprintForProduct } from '@/services/data/sdeLoader'
import type { BlueprintRegistry, GlobalSettings, TypeInfo } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('reaction formulas', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types!
  const typeMap = buildTypeMap(types)
  const blueprints = getAllBlueprints(registry)

  it('includes Titanium Carbide reaction formula in blueprints.json', () => {
    const tc = getBlueprintForProduct(blueprints, 16671)
    expect(tc).toBeDefined()
    expect(tc!.kind).toBe('reaction')
    expect(tc!.blueprintTypeId).toBe(46204)
    expect(tc!.productQuantity).toBe(10000)
    expect(tc!.materials).toEqual(
      expect.arrayContaining([
        { typeId: 4312, quantity: 5 },
        { typeId: 16654, quantity: 100 },
        { typeId: 16658, quantity: 100 },
      ]),
    )
    expect(tc!.requiredSkills.Reactions).toBe(3)
  })

  it('does not apply blueprint ME to reaction material quantities', () => {
    const tc = getBlueprintForProduct(blueprints, 16671)!
    const prices = new Map([
      [4312, 1000],
      [16654, 1000],
      [16658, 1000],
    ])
    const baseSettings = { ...DEFAULT_SETTINGS, batchSize: 1, meDefault: 0 }
    const me10Settings = { ...DEFAULT_SETTINGS, batchSize: 1, meDefault: 10 }
    const base = totalManufacturingCost(tc, prices, baseSettings, 0, 0.01, 0.01)
    const me10 = totalManufacturingCost(tc, prices, me10Settings, 10, 0.01, 0.01)
    expect(base.materialCost).toBe(me10.materialCost)
  })

  it('applies Reactions skill to reaction job time', () => {
    const tc = getBlueprintForProduct(blueprints, 16671)!
    const slow = applyReactionTime(tc.manufacturingTime, 1, 0, 0)
    const fast = applyReactionTime(tc.manufacturingTime, 1, 5, 0)
    expect(fast).toBeLessThan(slow)
    expect(fast / slow).toBeCloseTo(0.8, 5)
  })

  it('uses reaction cost index for reaction job fees', () => {
    const tc = getBlueprintForProduct(blueprints, 16671)!
    const settings = { ...DEFAULT_SETTINGS, batchSize: 1 }
    const prices = new Map([
      [4312, 1000],
      [16654, 1000],
      [16658, 1000],
    ])
    const highIndex = totalManufacturingCost(tc, prices, settings, 0, 0.01, 0.5)
    const lowIndex = totalManufacturingCost(tc, prices, settings, 0, 0.01, 0.001)
    expect(highIndex.jobCost).toBeGreaterThan(lowIndex.jobCost)
  })

  it('defaults reaction intermediates to buy when refinery is inactive', () => {
    const plate = getBlueprintForProduct(blueprints, 11544)
    expect(plate).toBeDefined()

    const prices = new Map<number, number>()
    for (const t of types) prices.set(t.typeId, 100)

    const { nodes } = expandManufacturingPlan({
      template: {
        id: 't',
        name: 'test',
        roots: [{ id: 'r1', productTypeId: 11544, runs: 100, productionDurationHours: 1 }],
        defaultRunsPerBpc: 100,
        modeOverrides: {},
        nodeOverrides: {},
      },
      blueprints,
      typeMap,
      prices,
      settings: {
        ...DEFAULT_SETTINGS,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'none',
        },
      },
      systemCostIndex: 0.01,
      reactionCostIndex: 0.02,
    })

    const tcNode = nodes.find((n) => n.productTypeId === 16671)
    expect(tcNode).toBeDefined()
    expect(tcNode!.mode).toBe('buy')
  })

  it('expands Titanium Diborite plan through Titanium Carbide reactions', () => {
    const plate = getBlueprintForProduct(blueprints, 11544)
    expect(plate).toBeDefined()

    const prices = new Map<number, number>()
    for (const t of types) prices.set(t.typeId, 100)

    const { nodes } = expandManufacturingPlan({
      template: {
        id: 't',
        name: 'test',
        roots: [{ id: 'r1', productTypeId: 11544, runs: 100, productionDurationHours: 1 }],
        defaultRunsPerBpc: 100,
        modeOverrides: {},
        nodeOverrides: {},
      },
      blueprints,
      typeMap,
      prices,
      settings: {
        ...DEFAULT_SETTINGS,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'tatara',
        },
      },
      systemCostIndex: 0.01,
      reactionCostIndex: 0.02,
    })

    const tcNode = nodes.find((n) => n.productTypeId === 16671)
    expect(tcNode).toBeDefined()
    expect(tcNode!.recipeKind).toBe('reaction')
  })

  it('builds supply chain for reaction intermediates', () => {
    const tc = getBlueprintForProduct(blueprints, 16671)!
    const prices = new Map<number, number>()
    for (const t of types) prices.set(t.typeId, 50)
    // Raw moon materials are cheaper to buy than reacting intermediates at flat pricing.
    prices.set(16654, 5000)
    prices.set(16658, 5000)

    const chain = buildSupplyChain(
      tc,
      blueprints,
      typeMap,
      prices,
      {
        ...DEFAULT_SETTINGS,
        batchSize: 1,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'tatara',
        },
      },
      0,
      0.01,
      0,
      10,
      new Map([[16654, 'build'], [16658, 'build']]),
      0.02,
    )

    expect(chain.mode).toBe('react')
    const chromide = chain.children?.find((c) => c.typeId === 16654)
    expect(chromide?.mode).toBe('react')
  })

  it('excludes reaction products from manufacturing rankings', () => {
    const market = loadFixture<import('@/types').MarketData>('public/data/market.json')
    const regions = loadFixture<import('@/types').RegionsData>('public/data/regions.json')
    const systems = loadFixture<import('@/types').SystemInfo[]>('public/data/systems.json')

    const rows = rankBlueprintsFromMarket(
      registry,
      market,
      regions,
      typeMap,
      DEFAULT_SETTINGS.primaryHub,
      '1m',
      DEFAULT_SETTINGS,
      { tiers: ['t1'], productTypeIds: [16671], limit: 10 },
      systems,
    )

    expect(rows).toHaveLength(0)
  })
})
