import { describe, expect, it } from 'vitest'
import { computeTreeLineMeta, flattenPlanNodesExpandable, isExpandableRowVisible, sortBuyGroupNodesDepthFirst, sortPlanNodesDepthFirst } from '@/lib/planTreeLines'
import type { PlanNode } from '@/types'

function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name'>): PlanNode {
  return {
    mode: 'build',
    totalDemandQty: 1,
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

describe('sortPlanNodesDepthFirst', () => {
  it('orders parent before nested children', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'Ship',
        isRoot: true,
        childProductTypeIds: [2, 3],
      }),
      mockNode({
        productTypeId: 2,
        name: 'Plate',
        parentProductTypeIds: [1],
        childProductTypeIds: [4],
      }),
      mockNode({
        productTypeId: 3,
        name: 'Cap',
        parentProductTypeIds: [1],
      }),
      mockNode({
        productTypeId: 4,
        name: 'Trit',
        parentProductTypeIds: [2],
      }),
    ]

    const ordered = sortPlanNodesDepthFirst(nodes)
    expect(ordered.map((r) => [r.item.name, r.depth])).toEqual([
      ['Ship', 0],
      ['Cap', 1],
      ['Plate', 1],
      ['Trit', 2],
    ])
  })
})

describe('sortBuyGroupNodesDepthFirst', () => {
  it('nests buy materials under intermediate buy parents in the group', () => {
    const groupNodes: PlanNode[] = [
      mockNode({
        productTypeId: 2,
        name: 'Raven',
        mode: 'buy',
        parentProductTypeIds: [1],
        demandByParent: [{ parentProductTypeId: 1, qty: 1 }],
      }),
      mockNode({
        productTypeId: 3,
        name: 'Construction Blocks',
        mode: 'buy',
        parentProductTypeIds: [1],
        demandByParent: [{ parentProductTypeId: 1, qty: 10 }],
      }),
      mockNode({
        productTypeId: 34,
        name: 'Tritanium',
        mode: 'buy',
        demandByParent: [{ parentProductTypeId: 2, qty: 100 }],
      }),
    ]

    const ordered = sortBuyGroupNodesDepthFirst(groupNodes, 1)
    expect(ordered.map((r) => [r.item.name, r.depth])).toEqual([
      ['Construction Blocks', 0],
      ['Raven', 0],
      ['Tritanium', 1],
    ])
  })
})

describe('flattenPlanNodesExpandable', () => {
  it('marks nodes with build children as expandable parents', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'Ship',
        isRoot: true,
        childProductTypeIds: [2, 3],
      }),
      mockNode({
        productTypeId: 2,
        name: 'Plate',
        parentProductTypeIds: [1],
        childProductTypeIds: [4],
      }),
      mockNode({
        productTypeId: 3,
        name: 'Cap',
        parentProductTypeIds: [1],
      }),
      mockNode({
        productTypeId: 4,
        name: 'Trit',
        parentProductTypeIds: [2],
      }),
    ]

    const rows = flattenPlanNodesExpandable(nodes, 'test')
    expect(rows.map((r) => [r.kind, r.node.name, r.depth])).toEqual([
      ['parent', 'Ship', 0],
      ['leaf', 'Cap', 1],
      ['parent', 'Plate', 1],
      ['leaf', 'Trit', 2],
    ])

    const plate = rows.find((r) => r.node.name === 'Plate' && r.kind === 'parent')!
    const trit = rows.find((r) => r.node.name === 'Trit')!
    expect(isExpandableRowVisible(trit, new Set([plate.collapseKey]))).toBe(false)
  })
})

describe('computeTreeLineMeta', () => {
  it('marks sibling and ancestor guides', () => {
    const rows = [{ depth: 0 }, { depth: 1 }, { depth: 2 }, { depth: 1 }]
    const meta = computeTreeLineMeta(rows)

    expect(meta[0]).toEqual({ isLast: true, continues: [] })
    expect(meta[1]).toEqual({ isLast: false, continues: [] })
    expect(meta[2]).toEqual({ isLast: true, continues: [true] })
    expect(meta[3]).toEqual({ isLast: true, continues: [] })
  })
})
