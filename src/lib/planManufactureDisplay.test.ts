import { describe, expect, it } from 'vitest'
import { buildManufactureDisplayRows, rootDisplayPlanNode } from '@/lib/planManufactureDisplay'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo, PlanNode, PlanRootEntry } from '@/types'

function mockBlueprint(productTypeId: number): BlueprintInfo {
  return {
    blueprintTypeId: productTypeId + 10000,
    productTypeId,
    productQuantity: 1,
    manufacturingTime: 3600,
    materials: [{ typeId: 34, quantity: 100 }],
    requiredSkills: {},
    tier: 't1',
    productGroup: 'Ship',
    bpIconUrl: '',
    productIconUrl: '',
    productRenderUrl: '',
  }
}

function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name'>): PlanNode {
  return {
    mode: 'build',
    totalDemandQty: 10,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: 10,
    bpcCount: 1,
    concurrentCopies: 1,
    jobTimeSeconds: 3600,
    outputQty: 10,
    isRoot: false,
    isLeaf: false,
    depth: 0,
    canToggle: false,
    ...partial,
  } as PlanNode
}

describe('buildManufactureDisplayRows', () => {
  it('shows one row per duplicate root of the same product', () => {
    const mergedRoot = mockNode({
      productTypeId: 200,
      name: 'Ship A',
      isRoot: true,
      runs: 25,
      outputQty: 25,
      totalDemandQty: 25,
      childProductTypeIds: [100],
    })
    const sub = mockNode({
      productTypeId: 100,
      name: 'Cap Recharger',
      parentProductTypeIds: [200],
      childProductTypeIds: [],
      isLeaf: true,
    })
    const nodes = [mergedRoot, sub]
    const roots: PlanRootEntry[] = [
      { id: 'root-1', productTypeId: 200, runs: 10, productionDurationHours: 24 },
      { id: 'root-2', productTypeId: 200, runs: 15, productionDurationHours: 24 },
    ]

    const rows = buildManufactureDisplayRows(
      nodes,
      roots,
      () => mockBlueprint(200),
      DEFAULT_SETTINGS,
      6,
      10,
    )

    const rootRows = rows.filter((r) => r.node.isRoot)
    expect(rootRows).toHaveLength(2)
    expect(rootRows[0].node.runs).toBe(10)
    expect(rootRows[1].node.runs).toBe(15)
    expect(rootRows[0].rootInstance).toBe(1)
    expect(rootRows[1].rootInstance).toBe(2)
    expect(rows.some((r) => r.node.productTypeId === 100)).toBe(true)
  })
})

describe('rootDisplayPlanNode', () => {
  it('uses per-root runs instead of merged totals', () => {
    const merged = mockNode({
      productTypeId: 200,
      name: 'Ship A',
      isRoot: true,
      runs: 25,
      outputQty: 25,
    })
    const root: PlanRootEntry = {
      id: 'root-1',
      productTypeId: 200,
      runs: 10,
      productionDurationHours: 24,
    }

    const display = rootDisplayPlanNode(
      root,
      merged,
      mockBlueprint(200),
      DEFAULT_SETTINGS,
      6,
      10,
    )

    expect(display.runs).toBe(10)
    expect(display.outputQty).toBe(10)
    expect(display.totalDemandQty).toBe(10)
  })
})
