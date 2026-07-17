import { describe, expect, it } from 'vitest'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
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
    [34, { typeId: 34, name: 'Tritanium', group: '', category: '', volume: 0, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
    [100, { typeId: 100, name: 'Cap Recharger', group: '', category: '', volume: 0, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
    [200, { typeId: 200, name: 'Ship A', group: '', category: '', volume: 0, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
    [201, { typeId: 201, name: 'Ship B', group: '', category: '', volume: 0, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
  ])
  const prices = new Map([[34, 5], [100, 1000], [200, 50000], [201, 60000]])

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
    expect(ship?.buyCost).toBeUndefined()

    const tri = nodes.find((n) => n.productTypeId === 34)
    expect(tri?.canToggle).toBe(false)
    expect(tri?.mode).toBe('buy')
    expect(tri?.unitPrice).toBe(5)
    expect(tri?.buyCost).toBe(5 * tri!.totalDemandQty)
  })

  it('timeline hours follow the longest root job time', () => {
    const template = createDefaultPlanTemplate('test')
    template.productionWindowHours = 999
    template.roots = [
      { id: 'root-a', productTypeId: 200, runs: 10, productionDurationHours: 12 },
      { id: 'root-b', productTypeId: 201, runs: 10, productionDurationHours: 48.5 },
    ]

    const { windowHours, slots } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
    })

    const hoursA = durationHoursFromRuns(shipA, DEFAULT_SETTINGS, 10, slots)
    const hoursB = durationHoursFromRuns(shipB, DEFAULT_SETTINGS, 10, slots)
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
    })

    const ship = nodes.find((n) => n.productTypeId === 200)
    expect(ship?.isRoot).toBe(true)
    expect(ship?.runs).toBe(25)
    expect(ship?.outputQty).toBe(25)
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
