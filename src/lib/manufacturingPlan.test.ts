import { describe, expect, it } from 'vitest'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { schedulePlanJobs } from '@/pages/Plan/planScheduler'
import { durationHoursFromRuns } from '@/lib/rootRunsDuration'
import { createDefaultPlanTemplate } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo } from '@/types'

function mockBlueprint(
  productTypeId: number,
  name: string,
  materials: { typeId: number; quantity: number }[] = [],
): BlueprintInfo {
  return {
    blueprintTypeId: productTypeId + 10000,
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

describe('expandManufacturingPlan', () => {
  const capBp = mockBlueprint(100, 'Cap Recharger', [{ typeId: 34, quantity: 100 }])
  const shipA = mockBlueprint(200, 'Ship A', [{ typeId: 100, quantity: 10 }])
  const shipB = mockBlueprint(201, 'Ship B', [{ typeId: 100, quantity: 20 }])
  const blueprints = [capBp, shipA, shipB]
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
      100,
      {
        typeId: 100,
        name: 'Cap Recharger',
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
        name: 'Ship A',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
    [
      201,
      {
        typeId: 201,
        name: 'Ship B',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
  ])
  const prices = new Map([
    [34, 5],
    [100, 1000],
    [200, 50000],
    [201, 60000],
  ])

  it('merges shared intermediate from two roots', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 },
      { id: 'root-b', productTypeId: 201, runs: 10, productionDurationHours: 24 },
    ]

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const cap = nodes.find((n) => n.productTypeId === 100)
    expect(cap).toBeDefined()
    expect(cap!.canToggle).toBe(true)
    expect(cap!.buyCost).toBeDefined()
    expect(cap!.buildCost).toBeDefined()
    expect(cap!.demandByParent).toHaveLength(2)
    expect(cap!.totalDemandQty).toBeGreaterThan(0)

    const ship = nodes.find((n) => n.productTypeId === 200)
    expect(ship?.isRoot).toBe(true)
    expect(ship?.canToggle).toBe(false)
    expect(ship?.mode).toBe('build')

    const tri = nodes.find((n) => n.productTypeId === 34)
    expect(tri?.canToggle).toBe(false)
    expect(tri?.mode).toBe('buy')
    expect(tri?.unitPrice).toBe(5)
    expect(tri?.buyCost).toBe(5 * tri!.totalDemandQty)
  })

  it('skips disabled roots', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 },
      { id: 'root-b', productTypeId: 201, runs: 10, productionDurationHours: 24, enabled: false },
    ]

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    expect(nodes.some((n) => n.productTypeId === 200 && n.isRoot)).toBe(true)
    expect(nodes.some((n) => n.productTypeId === 201)).toBe(false)
  })

  it('timeline hours follow the longest root job time', () => {
    const template = createDefaultPlanTemplate('test')
    template.productionWindowHours = 999
    template.roots = [
      { id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 12 },
      { id: 'root-b', productTypeId: 201, runs: 10, productionDurationHours: 48.5 },
    ]

    const { windowHours } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const hoursA = durationHoursFromRuns(shipA, DEFAULT_SETTINGS, 10, 1)
    const hoursB = durationHoursFromRuns(shipB, DEFAULT_SETTINGS, 10, 1)
    expect(windowHours).toBe(Math.max(hoursA, hoursB, 1))
  })

  it('sums runs from duplicate roots of the same product', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 200, runs: 10, productionDurationHours: 24 },
      { id: 'root-2', productTypeId: 200, runs: 15, productionDurationHours: 24 },
    ]

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const ship = nodes.find((n) => n.productTypeId === 200)
    expect(ship?.isRoot).toBe(true)
    expect(ship?.runs).toBe(25)
    expect(ship?.outputQty).toBe(25)
  })

  it('schedules duplicate roots on separate industry slots', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 200, runs: 10, productionDurationHours: 24 },
      { id: 'root-2', productTypeId: 200, runs: 10, productionDurationHours: 24 },
    ]

    const { nodes, slots } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const ship = nodes.find((n) => n.productTypeId === 200)
    expect(ship?.concurrentCopies).toBe(2)

    const jobs = schedulePlanJobs({ nodes, slots, windowHours: 500 })
    const rootJobs = jobs.filter((j) => j.productTypeId === 200)
    expect(rootJobs.length).toBeGreaterThanOrEqual(2)
    expect(new Set(rootJobs.map((j) => j.slot)).size).toBeGreaterThanOrEqual(2)
  })

  it('builds buildable intermediates when hub sell price is zero', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 }]
    const pricesNoIntermediate = new Map([
      [34, 5],
      [200, 50_000],
    ])

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices: pricesNoIntermediate,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const cap = nodes.find((n) => n.productTypeId === 100)
    expect(cap?.mode).toBe('build')
    expect(cap?.buyCost).toBe(0)
  })

  it('honors modeOverrides build for reactions when refinery is none', () => {
    const reactionBp: BlueprintInfo = {
      ...mockBlueprint(300, 'Reaction Out', [{ typeId: 34, quantity: 50 }]),
      kind: 'reaction',
    }
    const rootBp = mockBlueprint(400, 'Root Item', [{ typeId: 300, quantity: 10 }])
    const reactionBlueprints = [rootBp, reactionBp]
    const reactionTypeMap = new Map([
      ...typeMap,
      [
        300,
        {
          typeId: 300,
          name: 'Reaction Out',
          group: '',
          category: '',
          volume: 0,
          iconUrl: '',
          renderUrl: '',
          bpIconUrl: '',
        },
      ],
      [
        400,
        {
          typeId: 400,
          name: 'Root Item',
          group: '',
          category: '',
          volume: 0,
          iconUrl: '',
          renderUrl: '',
          bpIconUrl: '',
        },
      ],
    ])
    const reactionPrices = new Map([...prices, [300, 100], [400, 50_000]])

    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-r', productTypeId: 400, runs: 10, productionDurationHours: 24 }]
    template.modeOverrides[300] = 'build'

    const settings = {
      ...DEFAULT_SETTINGS,
      reactionFacility: { ...DEFAULT_SETTINGS.reactionFacility, refineryType: 'none' as const },
    }

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints: reactionBlueprints,
      typeMap: reactionTypeMap,
      prices: reactionPrices,
      settings,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const reaction = nodes.find((n) => n.productTypeId === 300)
    expect(reaction?.mode).toBe('build')
  })

  it('ignores pooled stock when includeInventory is off', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 }]
    const expandInput = {
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    }
    const baseline = expandManufacturingPlan(expandInput).nodes.find(
      (n) => n.productTypeId === 100,
    )!
    const withStock = expandManufacturingPlan({
      ...expandInput,
      pooledStock: new Map([[100, 999]]),
    }).nodes.find((n) => n.productTypeId === 100)!
    expect(withStock.totalDemandQty).toBe(baseline.totalDemandQty)
  })

  it('subtracts station stock from component demand when includeInventory is on', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 }]
    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: { ...DEFAULT_SETTINGS, includeInventory: true },
      pooledStock: new Map([[100, 40]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })
    const cap = nodes.find((n) => n.productTypeId === 100)!
    expect(cap.grossDemandQty).toBe(90)
    expect(cap.totalDemandQty).toBe(50)
    expect(nodes.find((n) => n.productTypeId === 200)!.runs).toBe(10)
  })

  it('zero-runs fully covered components', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 }]
    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: { ...DEFAULT_SETTINGS, includeInventory: true },
      pooledStock: new Map([[100, 90]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })
    const cap = nodes.find((n) => n.productTypeId === 100)!
    expect(cap.totalDemandQty).toBe(0)
    expect(cap.runs).toBe(0)
  })

  it('nets buy-leaf demand from stock', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 }]
    const without = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: { ...DEFAULT_SETTINGS, includeInventory: true },
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })
    const withStock = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: { ...DEFAULT_SETTINGS, includeInventory: true },
      pooledStock: new Map([[34, 500]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })
    const triBase = without.nodes.find((n) => n.productTypeId === 34)!
    const tri = withStock.nodes.find((n) => n.productTypeId === 34)!
    expect(tri.totalDemandQty).toBeLessThan(triBase.totalDemandQty)
    expect(tri.grossDemandQty).toBe(triBase.totalDemandQty)
  })

  it('consumes shared stock once across two roots', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 24 },
      { id: 'root-b', productTypeId: 201, runs: 10, productionDurationHours: 24 },
    ]
    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: { ...DEFAULT_SETTINGS, includeInventory: true },
      pooledStock: new Map([[100, 250]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })
    const cap = nodes.find((n) => n.productTypeId === 100)!
    expect(cap.grossDemandQty).toBe(270)
    expect(cap.totalDemandQty).toBe(20)
  })

  it('nets packaged self-input from station stock', () => {
    const kit = mockBlueprint(300, 'Kit', [
      { typeId: 300, quantity: 1 },
      { typeId: 34, quantity: 10 },
    ])
    const template = createDefaultPlanTemplate('test')
    template.roots = [{ id: 'root-k', productTypeId: 300, runs: 10, productionDurationHours: 24 }]
    const { nodes } = expandManufacturingPlan({
      template,
      blueprints: [...blueprints, kit],
      typeMap: new Map([
        ...typeMap,
        [
          300,
          {
            typeId: 300,
            name: 'Kit',
            group: '',
            category: '',
            volume: 0,
            iconUrl: '',
            renderUrl: '',
            bpIconUrl: '',
          },
        ],
      ]),
      prices: new Map([...prices, [300, 1000]]),
      settings: { ...DEFAULT_SETTINGS, includeInventory: true },
      pooledStock: new Map([[300, 4]]),
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })
    const root = nodes.find((n) => n.productTypeId === 300)!
    expect(root.packagedBuyQty).toBe(6)
  })
})

describe('manufacturingSlotsFromSkills', () => {
  it('computes slots from mass production skills', async () => {
    const { manufacturingSlotsFromSkills } = await import('@/lib/manufacturingSlots')
    expect(
      manufacturingSlotsFromSkills({
        industry: 5,
        massProduction: 5,
        advancedMassProduction: 3,
      }),
    ).toBe(9)
    expect(
      manufacturingSlotsFromSkills({
        industry: 5,
        massProduction: 5,
        advancedMassProduction: 5,
      }),
    ).toBe(11)
  })
})
