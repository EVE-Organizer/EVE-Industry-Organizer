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
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo, TypeInfo } from '@/types'

function mockBlueprint(
  productTypeId: number,
  materials: { typeId: number; quantity: number }[] = [],
): BlueprintInfo {
  return {
    blueprintTypeId: productTypeId + 10_000,
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
    hubId: 'jita',
    window: '1w',
    buyOrders: new Map(),
    priceMethod: 'sell_orders',
    ...partial,
  }
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
  const product: TypeInfo = {
    typeId: 100,
    name: 'Widget',
    group: '',
    category: '',
    volume: 0,
    iconUrl: '',
    renderUrl: '',
    bpIconUrl: '',
  }

  it('marks hasReliablePrices false when a material price is missing', () => {
    const blueprint = mockBlueprint(100, [{ typeId: 34, quantity: 10 }])
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
    const blueprint = mockBlueprint(100, [{ typeId: 34, quantity: 100 }])
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
})
