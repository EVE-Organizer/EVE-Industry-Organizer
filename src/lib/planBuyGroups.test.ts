import { describe, expect, it } from 'vitest'
import { buildBuyGroups, buildBuyTableRows, isBuyTableRowVisible } from '@/lib/planBuyGroups'
import { sortBuyGroupNodesDepthFirst } from '@/lib/planTreeLines'
import type { PlanNode } from '@/types'

function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name' | 'mode'>): PlanNode {
  return {
    totalDemandQty: 100,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: 0,
    bpcCount: 0,
    concurrentCopies: 0,
    jobTimeSeconds: 0,
    outputQty: 0,
    isRoot: false,
    isLeaf: true,
    depth: 0,
    canToggle: false,
    ...partial,
  }
}

describe('buildBuyGroups', () => {
  it('groups buy materials under their build parent', () => {
    const all: PlanNode[] = [
      mockNode({ productTypeId: 1, name: 'Ship', mode: 'build', depth: 0, isRoot: true }),
      mockNode({
        productTypeId: 2,
        name: 'Morphite',
        mode: 'buy',
        depth: 1,
        parentProductTypeIds: [1],
        demandByParent: [{ parentProductTypeId: 1, qty: 50 }],
      }),
    ]
    const buy = all.filter((n) => n.mode === 'buy')
    const groups = buildBuyGroups(all, buy)
    expect(groups).toHaveLength(1)
    expect(groups[0].parentProductTypeId).toBe(1)
    expect(groups[0].nodes.map((n) => n.name)).toEqual(['Morphite'])
  })

  it('puts multi-parent buy lines in shared group', () => {
    const all: PlanNode[] = [
      mockNode({ productTypeId: 1, name: 'A', mode: 'build', depth: 0 }),
      mockNode({ productTypeId: 2, name: 'B', mode: 'build', depth: 0 }),
      mockNode({
        productTypeId: 3,
        name: 'Tritanium',
        mode: 'buy',
        depth: 1,
        demandByParent: [
          { parentProductTypeId: 1, qty: 10 },
          { parentProductTypeId: 2, qty: 20 },
        ],
      }),
    ]
    const groups = buildBuyGroups(all, all.filter((n) => n.mode === 'buy'))
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('shared')
    expect(groups[0].nodes[0].name).toBe('Tritanium')
  })

  it('lists consumer product ids on shared group table row', () => {
    const all: PlanNode[] = [
      mockNode({ productTypeId: 1, name: 'A', mode: 'build', depth: 0 }),
      mockNode({ productTypeId: 2, name: 'B', mode: 'build', depth: 0 }),
      mockNode({
        productTypeId: 3,
        name: 'Tritanium',
        mode: 'buy',
        depth: 1,
        demandByParent: [
          { parentProductTypeId: 1, qty: 10 },
          { parentProductTypeId: 2, qty: 20 },
        ],
      }),
    ]
    const groups = buildBuyGroups(all, all.filter((n) => n.mode === 'buy'))
    const rows = buildBuyTableRows(groups, all)
    expect(rows[0]).toMatchObject({
      kind: 'group',
      key: 'shared',
      consumerProductTypeIds: [1, 2],
    })
  })

  it('does not recurse on cyclic parent links', () => {
    const all: PlanNode[] = [
      mockNode({
        productTypeId: 12238,
        name: 'Reprocessing Array',
        mode: 'buy',
        depth: 0,
        isRoot: true,
        parentProductTypeIds: [12238],
        demandByParent: [{ parentProductTypeId: 12238, qty: 100 }],
      }),
    ]
    expect(() => buildBuyGroups(all, all)).not.toThrow()
    expect(buildBuyGroups(all, all)[0]?.key).toBe('shared')
  })
})

describe('buildBuyTableRows', () => {
  it('emits group header then nested item rows', () => {
    const all: PlanNode[] = [
      mockNode({ productTypeId: 1, name: 'Ship', mode: 'build', depth: 0 }),
      mockNode({
        productTypeId: 2,
        name: 'Hull',
        mode: 'buy',
        depth: 1,
        parentProductTypeIds: [1],
        demandByParent: [{ parentProductTypeId: 1, qty: 1 }],
      }),
      mockNode({
        productTypeId: 3,
        name: 'Plate',
        mode: 'buy',
        depth: 2,
        parentProductTypeIds: [2],
        demandByParent: [{ parentProductTypeId: 2, qty: 5 }],
      }),
    ]
    const groups = buildBuyGroups(all, all.filter((n) => n.mode === 'buy'))
    const rows = buildBuyTableRows(groups, all)
    expect(rows[0].kind).toBe('group')
    expect(rows[1]).toMatchObject({ kind: 'parent', depth: 1, node: { name: 'Hull' } })
    expect(rows[2]).toMatchObject({ kind: 'item', depth: 2, node: { name: 'Plate' } })
  })

  it('aligns indent to supply-chain depth from the group build parent', () => {
    const all: PlanNode[] = [
      mockNode({ productTypeId: 1, name: 'Golem', mode: 'build', depth: 0, isRoot: true }),
      mockNode({
        productTypeId: 2,
        name: 'Raven',
        mode: 'buy',
        depth: 1,
        parentProductTypeIds: [1],
        demandByParent: [{ parentProductTypeId: 1, qty: 1 }],
      }),
      mockNode({
        productTypeId: 3,
        name: 'Construction Blocks',
        mode: 'buy',
        depth: 1,
        parentProductTypeIds: [1],
        demandByParent: [{ parentProductTypeId: 1, qty: 10 }],
      }),
      mockNode({
        productTypeId: 34,
        name: 'Tritanium',
        mode: 'buy',
        depth: 2,
        parentProductTypeIds: [2],
        demandByParent: [{ parentProductTypeId: 2, qty: 100 }],
      }),
    ]
    const groups = buildBuyGroups(all, all.filter((n) => n.mode === 'buy'))
    expect(
      sortBuyGroupNodesDepthFirst(groups[0].nodes, groups[0].parentProductTypeId).map((r) => [
        r.item.name,
        r.depth,
      ]),
    ).toEqual([
      ['Construction Blocks', 0],
      ['Raven', 0],
      ['Tritanium', 1],
    ])
    const rows = buildBuyTableRows(groups, all)
    const itemRows = rows.filter((r): r is Extract<typeof r, { kind: 'item' }> => r.kind === 'item')
    const parentRows = rows.filter((r): r is Extract<typeof r, { kind: 'parent' }> => r.kind === 'parent')
    expect(parentRows.map((r) => [r.node.name, r.depth])).toEqual([['Raven', 1]])
    expect(itemRows.map((r) => [r.node.name, r.depth])).toEqual([
      ['Construction Blocks', 1],
      ['Tritanium', 2],
    ])

    const raven = parentRows[0]
    const trit = itemRows.find((r) => r.node.name === 'Tritanium')!
    expect(trit.ancestorCollapseKeys).toContain(raven.collapseKey)
    expect(isBuyTableRowVisible(trit, new Set([raven.collapseKey]))).toBe(false)
    expect(isBuyTableRowVisible(trit, new Set())).toBe(true)
  })
})
