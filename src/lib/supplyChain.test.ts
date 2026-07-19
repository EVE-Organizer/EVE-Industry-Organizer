import { describe, expect, it } from 'vitest'
import { buildSupplyChain } from '@/lib/supplyChain'
import { applyME } from '@/lib/cost'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo } from '@/types'

function mockBlueprint(
  productTypeId: number,
  opts: {
    productQuantity?: number
    materials?: { typeId: number; quantity: number }[]
    kind?: BlueprintInfo['kind']
    reactionFamily?: BlueprintInfo['reactionFamily']
  } = {},
): BlueprintInfo {
  return {
    blueprintTypeId: productTypeId + 10_000,
    productTypeId,
    productQuantity: opts.productQuantity ?? 1,
    manufacturingTime: 3600,
    materials: opts.materials ?? [],
    requiredSkills: {},
    tier: 't1',
    productGroup: 'Module',
    bpIconUrl: '',
    productIconUrl: '',
    productRenderUrl: '',
    kind: opts.kind,
    reactionFamily: opts.reactionFamily,
  }
}

describe('buildSupplyChain', () => {
  const typeMap = new Map([
    [
      34,
      {
        typeId: 34,
        name: 'Tritanium',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
    [
      200,
      {
        typeId: 200,
        name: 'Plate',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
    [
      300,
      {
        typeId: 300,
        name: 'Ship',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
    [
      10_300,
      {
        typeId: 10_300,
        name: 'Plate BPO',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
    [
      10_200,
      {
        typeId: 10_200,
        name: 'Reaction Formula',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
  ])

  const plate = mockBlueprint(200, {
    productQuantity: 10,
    materials: [{ typeId: 34, quantity: 100 }],
  })
  const ship = mockBlueprint(300, {
    productQuantity: 1,
    materials: [{ typeId: 200, quantity: 3 }],
  })
  const reaction = mockBlueprint(150, {
    kind: 'reaction',
    reactionFamily: 'composite',
    productQuantity: 10_000,
    materials: [{ typeId: 34, quantity: 5 }],
  })
  const blueprints = [ship, plate, reaction]

  const prices = new Map([
    [34, 5],
    [200, 50],
    [300, 1_000],
  ])

  it('scales sub-blueprint runs to material demand, not root batch size', () => {
    const settings = { ...DEFAULT_SETTINGS, batchSize: 100, meDefault: 0, teDefault: 0 }
    const chain = buildSupplyChain(
      ship,
      blueprints,
      typeMap,
      prices,
      settings,
      0,
      0.01,
    )

    const plateChild = chain.children?.find((c) => c.typeId === 200)
    expect(plateChild).toBeDefined()
    // 100 ships × 3 plates = 300 plates; plate BP outputs 10/run → 30 runs, not 100.
    const plateRuns = 30
    const plateMats = applyME(plate.materials, 0, plateRuns, 0)
    const tritChild = plateChild!.children?.find((c) => c.typeId === 34)
    expect(tritChild?.quantity).toBe(plateMats[0]!.quantity)
  })

  it('treats packaged self-input as a market buy leaf', () => {
    const selfRef = mockBlueprint(400, {
      materials: [{ typeId: 400, quantity: 2 }, { typeId: 34, quantity: 10 }],
    })
    typeMap.set(400, {
      typeId: 400,
      name: 'Array',
      group: '',
      category: '',
      volume: 0,
      iconUrl: '',
      renderUrl: '',
      bpIconUrl: '',
    })
    prices.set(400, 1_000_000)

    const chain = buildSupplyChain(
      selfRef,
      [selfRef],
      typeMap,
      prices,
      { ...DEFAULT_SETTINGS, batchSize: 10 },
      0,
      0.01,
    )

    const selfChild = chain.children?.find((c) => c.typeId === 400)
    expect(selfChild?.mode).toBe('buy')
    expect(selfChild?.isLeaf).toBe(true)
    expect(selfChild?.totalCost).toBe(2 * 10 * 1_000_000)
  })

  it('defaults reaction intermediates to buy when refinery is inactive', () => {
    const consumer = mockBlueprint(500, {
      materials: [{ typeId: 150, quantity: 100 }],
    })
    typeMap.set(500, {
      typeId: 500,
      name: 'Consumer',
      group: '',
      category: '',
      volume: 0,
      iconUrl: '',
      renderUrl: '',
      bpIconUrl: '',
    })
    prices.set(150, 200)

    const chain = buildSupplyChain(
      consumer,
      [consumer, reaction],
      typeMap,
      prices,
      {
        ...DEFAULT_SETTINGS,
        batchSize: 1,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'none',
        },
      },
      0,
      0.01,
      0,
      10,
      new Map([[150, 'build']]),
    )

    const reactionChild = chain.children?.find((c) => c.typeId === 150)
    expect(reactionChild?.mode).toBe('buy')
  })
})
