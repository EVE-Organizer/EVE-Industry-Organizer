import { describe, expect, it } from 'vitest'
import {
  computeFlatSetup,
  priceSourceForMaterial,
  type PriceContext,
} from '@/lib/blueprintEconomics'
import {
  applyME,
  estimatedItemValue,
  estimateJobCost,
  materialCost,
  resolveBlueprintMeTe,
} from '@/lib/cost'
import { resolveRecipeModifiers } from '@/lib/facilityModifiers'
import { isReactionRecipe } from '@/lib/recipes'
import type { BlueprintInfo, ContractsData, HubMarketData, TypeInfo } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

function mockBlueprint(
  productTypeId: number,
  blueprintTypeId = productTypeId + 10_000,
  materials: { typeId: number; quantity: number }[] = [],
): BlueprintInfo {
  return {
    blueprintTypeId,
    productTypeId,
    productQuantity: 1,
    manufacturingTime: 3600,
    materials,
    requiredSkills: {},
    tier: 't1',
    productGroup: 'Module',
    bpIconUrl: '',
    productIconUrl: '',
    productRenderUrl: '',
  }
}

function priceCtx(partial: Partial<PriceContext> & Pick<PriceContext, 'windowSell' | 'spotSell'>): PriceContext {
  return {
    hubId: 'amarr',
    window: '1w',
    buyOrders: new Map(),
    priceMethod: 'sell_orders',
    ...partial,
  }
}

function hubMarketWithBpo(typeId: number, spot: number): HubMarketData {
  return {
    regionId: 10000002,
    marketSystemId: 30002187,
    buildSystemId: 30002187,
    costIndex: 0.01,
    prices: { [String(typeId)]: spot },
    products: {
      [String(typeId)]: {
        all: { avgPrice: spot, avgVolume: 1, high: spot, low: spot },
        '1w': { avgPrice: spot, avgVolume: 1, high: spot, low: spot },
      },
    },
  }
}

const product: TypeInfo = {
  typeId: 100,
  name: 'Widget',
  group: '',
  category: 'Module',
  volume: 0,
  iconUrl: '',
  renderUrl: '',
  bpIconUrl: '',
}

describe('priceSourceForMaterial', () => {
  it('classifies spot, window average, and missing prices', () => {
    const typeId = 34
    expect(
      priceSourceForMaterial(
        typeId,
        priceCtx({
          windowSell: new Map([[typeId, 5]]),
          spotSell: new Map([[typeId, 5]]),
        }),
      ),
    ).toBe('spot')

    expect(
      priceSourceForMaterial(
        typeId,
        priceCtx({
          windowSell: new Map([[typeId, 6]]),
          spotSell: new Map([[typeId, 5]]),
        }),
      ),
    ).toBe('window_avg')

    expect(
      priceSourceForMaterial(
        typeId,
        priceCtx({
          windowSell: new Map(),
          spotSell: new Map(),
        }),
      ),
    ).toBe('missing')
  })
})

describe('computeFlatSetup', () => {
  it('marks hasReliablePrices false when a material price is missing', () => {
    const blueprint = mockBlueprint(100, 10100, [{ typeId: 34, quantity: 10 }])
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100 }
    const prices = new Map<number, number>()

    const { hasReliablePrices, missingPriceTypeIds } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs: 10,
      prices,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
      includeHaulCost: false,
    })

    expect(hasReliablePrices).toBe(false)
    expect(missingPriceTypeIds).toEqual([34])
  })

  it('matches materialCost + jobCost from cost helpers for a simple fixture', () => {
    const blueprint = mockBlueprint(100, 10100, [{ typeId: 34, quantity: 100 }])
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, includeBlueprintCost: false }
    const runs = 10
    const prices = new Map([[34, 5]])
    const systemCostIndex = 0.02

    const { setup } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs,
      prices,
      systemCostIndex,
      reactionCostIndex: 0.01,
      includeHaulCost: false,
    })

    const { me } = resolveBlueprintMeTe(blueprint.tier, settings, undefined, blueprint)
    const structure = resolveRecipeModifiers(settings, blueprint)
    const effectiveMe = isReactionRecipe(blueprint) ? 0 : me
    const mats = applyME(blueprint.materials, effectiveMe, runs, structure.meBonusPercent)
    const expectedMat = materialCost(mats, prices)
    const eiv = estimatedItemValue(blueprint.materials, runs, prices)
    const expectedJob = estimateJobCost(eiv, systemCostIndex, structure)

    expect(setup.materialCost).toBeCloseTo(expectedMat, 6)
    expect(setup.jobCost).toBeCloseTo(expectedJob, 6)
    expect(setup.materialCost + setup.jobCost).toBeCloseTo(expectedMat + expectedJob, 6)
  })

  it('charges 0 per batch but full BPO upfront when BPO exists at selected hub', () => {
    const blueprint = mockBlueprint(100, 10100)
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, includeBlueprintCost: true }
    const spot = new Map([[10100, 50_000_000]])
    const ctx = priceCtx({ spotSell: spot, windowSell: new Map([[34, 5]]) })

    const { setup } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs: 10,
      prices: new Map([[34, 5]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
      hubId: 'amarr',
      hubMarket: hubMarketWithBpo(10100, 50_000_000),
      jitaHubMarket: null,
      spotPrices: spot,
      priceCtx: ctx,
      includeHaulCost: false,
    })

    expect(setup.blueprintCost.mode).toBe('bpo')
    expect(setup.blueprintCost.sourceHub).toBe('amarr')
    expect(setup.bpoCost).toBe(0)
    expect(setup.blueprintCost.upfront).toBe(50_000_000)
    expect(setup.upfrontCapital).toBeGreaterThanOrEqual(50_000_000)
    expect(setup.blueprintCost.bpoUnitPrice).toBe(50_000_000)
  })

  it('falls back to Jita BPO before local BPC', () => {
    const blueprint = mockBlueprint(100, 10100)
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, includeBlueprintCost: true }
    const amarrSpot = new Map<number, number>()
    const jitaSpot = new Map([[10100, 40_000_000]])
    const ctx = priceCtx({ spotSell: amarrSpot, windowSell: new Map([[34, 5]]) })
    const contracts: ContractsData = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      hubs: {
        amarr: {
          byBlueprintTypeId: {
            '10100': {
              count: 1,
              minBuyout: 1_000_000,
              listings: [
                {
                  contractId: 1,
                  price: 1_000_000,
                  buyout: 1_000_000,
                  me: 0,
                  te: 0,
                  runs: 10,
                  expires: '2026-07-25T00:00:00Z',
                },
              ],
            },
          },
        },
      },
    }

    const { setup } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs: 10,
      prices: new Map([[34, 5]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
      hubId: 'amarr',
      hubMarket: hubMarketWithBpo(10100, 0),
      jitaHubMarket: hubMarketWithBpo(10100, 40_000_000),
      spotPrices: amarrSpot,
      jitaSpotPrices: jitaSpot,
      contracts,
      priceCtx: ctx,
      includeHaulCost: false,
    })

    expect(setup.blueprintCost.mode).toBe('bpo')
    expect(setup.blueprintCost.sourceHub).toBe('jita')
    expect(setup.bpoCost).toBe(0)
    expect(setup.blueprintCost.bpoUnitPrice).toBe(40_000_000)
  })

  it('charges BPC per run when no BPO exists at hub or Jita', () => {
    const blueprint = mockBlueprint(100, 10100)
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, includeBlueprintCost: true }
    const spot = new Map<number, number>()
    const ctx = priceCtx({ spotSell: spot, windowSell: new Map([[34, 5]]) })
    const contracts: ContractsData = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      hubs: {
        amarr: {
          byBlueprintTypeId: {
            '10100': {
              count: 1,
              minBuyout: 500_000,
              listings: [
                {
                  contractId: 2,
                  price: 500_000,
                  buyout: 500_000,
                  me: 0,
                  te: 0,
                  runs: 10,
                  expires: '2026-07-25T00:00:00Z',
                },
              ],
            },
          },
        },
      },
    }

    const { setup } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs: 10,
      prices: new Map([[34, 5]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
      hubId: 'amarr',
      hubMarket: hubMarketWithBpo(10100, 0),
      jitaHubMarket: hubMarketWithBpo(10100, 0),
      spotPrices: spot,
      jitaSpotPrices: spot,
      contracts,
      priceCtx: ctx,
      includeHaulCost: false,
    })

    expect(setup.blueprintCost.mode).toBe('bpc')
    expect(setup.blueprintCost.sourceHub).toBe('amarr')
    expect(setup.bpoCost).toBe(500_000)
    expect(setup.blueprintCost.bpcCostPerRun).toBe(50_000)
  })

  it('marks blueprint price missing when include is on and no source exists', () => {
    const blueprint = mockBlueprint(100, 10100)
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, includeBlueprintCost: true }
    const spot = new Map<number, number>()
    const ctx = priceCtx({ spotSell: spot, windowSell: new Map([[34, 5]]) })

    const { setup } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs: 10,
      prices: new Map([[34, 5]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
      hubId: 'jita',
      hubMarket: hubMarketWithBpo(10100, 0),
      jitaHubMarket: hubMarketWithBpo(10100, 0),
      spotPrices: spot,
      jitaSpotPrices: spot,
      contracts: { generatedAt: '', hubs: {} },
      priceCtx: ctx,
      includeHaulCost: false,
    })

    expect(setup.blueprintCost.bpoPriceMissing).toBe(true)
  })

  it('detects missing blueprint price when includeBlueprintCost is off but charges nothing', () => {
    const blueprint = mockBlueprint(100, 10100)
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, includeBlueprintCost: false }
    const spot = new Map<number, number>()
    const ctx = priceCtx({ spotSell: spot, windowSell: new Map([[34, 5]]) })

    const { setup } = computeFlatSetup({
      blueprint,
      product,
      settings,
      runs: 10,
      prices: new Map([[34, 5]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
      hubId: 'jita',
      hubMarket: hubMarketWithBpo(10100, 0),
      contracts: { generatedAt: '', hubs: {} },
      priceCtx: ctx,
      includeHaulCost: false,
    })

    expect(setup.bpoCost).toBe(0)
    expect(setup.blueprintCost.charged).toBe(0)
    expect(setup.blueprintCost.bpoPriceMissing).toBe(true)
  })
})
