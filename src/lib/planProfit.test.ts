import { describe, expect, it } from 'vitest'
import { computePlanProfitSummary, computeRootProfitRow, computeRootSetupBreakdown } from '@/lib/planProfit'
import { createDefaultPlanTemplate } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo } from '@/types'
import type { ExpandPlanInput } from '@/lib/manufacturingPlan'

function mockBlueprint(
  productTypeId: number,
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

describe('planProfit', () => {
  const widget = mockBlueprint(100, [{ typeId: 34, quantity: 10 }])
  const blueprints = [widget]
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
        name: 'Widget',
        group: '',
        category: '',
        volume: 0,
        iconUrl: '',
        renderUrl: '',
        bpIconUrl: '',
      },
    ],
  ])
  const sellPrices = new Map([
    [34, 5],
    [100, 1000],
  ])
  const buyPrices = new Map([[100, 900]])

  it('computes profit and margin for a simple root', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 100, runs: 100, productionDurationHours: 10 },
    ]
    const expandInput: ExpandPlanInput = {
      template,
      blueprints,
      typeMap,
      prices: sellPrices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    }

    const row = computeRootProfitRow(
      template.roots[0],
      widget,
      expandInput,
      sellPrices,
      buyPrices,
      10,
    )

    expect(row.setupCost).toBeGreaterThan(0)
    expect(row.netRevenue).toBeGreaterThan(0)
    expect(row.netProfit).toBe(row.netRevenue - row.setupCost)
    expect(row.margin).toBeCloseTo((row.netProfit / row.setupCost) * 100, 5)
    expect(row.iph).toBeCloseTo(row.netProfit / 10, 5)
  })

  it('aggregates root rows into a plan summary', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 100, runs: 100, productionDurationHours: 10 },
    ]
    const expandInput: ExpandPlanInput = {
      template,
      blueprints,
      typeMap,
      prices: sellPrices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    }

    const summary = computePlanProfitSummary(
      template,
      expandInput,
      sellPrices,
      buyPrices,
      new Map([['root-1', 10]]),
    )

    expect(summary.rootRows).toHaveLength(1)
    expect(summary.setupCost).toBe(summary.rootRows[0].setupCost)
    expect(summary.netProfit).toBe(summary.netRevenue - summary.setupCost)
    expect(summary.jobHours).toBe(10)
  })

  it('builds setup breakdown with buy lines and build chain remainder', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 100, runs: 100, productionDurationHours: 10 },
    ]
    const expandInput: ExpandPlanInput = {
      template,
      blueprints,
      typeMap,
      prices: sellPrices,
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    }

    const breakdown = computeRootSetupBreakdown(
      template.roots[0],
      widget,
      expandInput,
      'Widget',
    )

    expect(breakdown.totalSetupCost).toBeGreaterThan(0)
    expect(breakdown.buyLines.some((line) => line.productTypeId === 34)).toBe(true)
    expect(breakdown.buildChainCost).toBeGreaterThanOrEqual(0)
    const parts = breakdown.buyLines.reduce((s, l) => s + l.cost, 0)
      + breakdown.buildChainCost
      + breakdown.packagedBuyCost
    expect(parts).toBeCloseTo(breakdown.totalSetupCost, 5)
  })

  it('does not double-count packaged self-input in setup cost', () => {
    const selfRef = mockBlueprint(200, [
      { typeId: 200, quantity: 1 },
      { typeId: 34, quantity: 5 },
    ])
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 200, runs: 100, productionDurationHours: 10 },
    ]
    const expandInput: ExpandPlanInput = {
      template,
      blueprints: [selfRef],
      typeMap: new Map([
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
      prices: new Map([
        [34, 5],
        [200, 1_000_000],
      ]),
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    }

    const row = computeRootProfitRow(
      template.roots[0],
      selfRef,
      expandInput,
      expandInput.prices,
      new Map([[200, 900_000]]),
      10,
    )
    const breakdown = computeRootSetupBreakdown(
      template.roots[0],
      selfRef,
      expandInput,
      'Kit',
    )

    expect(breakdown.packagedBuyCost).toBeGreaterThan(0)
    expect(row.setupCost).toBeCloseTo(
      breakdown.totalSetupCost,
      5,
    )
    const withoutPackaged =
      breakdown.totalSetupCost - breakdown.packagedBuyCost
    expect(withoutPackaged).toBeLessThan(row.setupCost)
  })
})
