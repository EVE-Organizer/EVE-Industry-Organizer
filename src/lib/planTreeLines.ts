import type { PlanNode } from '@/types'

export interface PlanTreeRow<T> {
  item: T
  depth: number
}

export interface TreeLineMeta {
  isLast: boolean
  continues: boolean[]
}

/** Depth-first order with relative depth (roots at 0). */
export function sortPlanNodesDepthFirst(nodes: PlanNode[]): PlanTreeRow<PlanNode>[] {
  const idSet = new Set(nodes.map((n) => n.productTypeId))
  const byId = new Map(nodes.map((n) => [n.productTypeId, n]))
  const result: PlanTreeRow<PlanNode>[] = []
  const visited = new Set<number>()

  function visit(node: PlanNode, depth: number) {
    if (visited.has(node.productTypeId)) return
    visited.add(node.productTypeId)
    result.push({ item: node, depth })

    const children = node.childProductTypeIds
      .map((id) => byId.get(id))
      .filter((n): n is PlanNode => n != null && idSet.has(n.productTypeId))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const child of children) visit(child, depth + 1)
  }

  const roots = nodes.filter((n) => n.isRoot).sort((a, b) => a.name.localeCompare(b.name))
  for (const root of roots) visit(root, 0)
  for (const node of nodes) {
    if (!visited.has(node.productTypeId)) visit(node, 0)
  }

  return result
}

export function computeTreeLineMeta(rows: { depth: number }[]): TreeLineMeta[] {
  return rows.map((row, index) => {
    const depth = row.depth
    const continues: boolean[] = []

    for (let level = 0; level < depth - 1; level++) {
      let cont = false
      for (let j = index + 1; j < rows.length; j++) {
        if (rows[j].depth <= level) break
        cont = true
        break
      }
      continues.push(cont)
    }

    let isLast = true
    for (let j = index + 1; j < rows.length; j++) {
      if (rows[j].depth < depth) break
      if (rows[j].depth === depth) {
        isLast = false
        break
      }
    }

    return { isLast, continues }
  })
}

export function withTreeLineMeta<T extends { depth: number }>(
  rows: T[],
): (T & TreeLineMeta)[] {
  const meta = computeTreeLineMeta(rows)
  return rows.map((row, i) => ({ ...row, ...meta[i] }))
}

function childrenInNodeSet(node: PlanNode, nodes: PlanNode[]): PlanNode[] {
  const idSet = new Set(nodes.map((n) => n.productTypeId))
  const byId = new Map(nodes.map((n) => [n.productTypeId, n]))
  return node.childProductTypeIds
    .map((id) => byId.get(id))
    .filter((n): n is PlanNode => n != null && idSet.has(n.productTypeId))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface ExpandableParentRow {
  kind: 'parent'
  node: PlanNode
  depth: number
  isLast: boolean
  continues: boolean[]
  collapseKey: string
  ancestorCollapseKeys: string[]
  childCount: number
}

export interface ExpandableLeafRow {
  kind: 'leaf'
  node: PlanNode
  depth: number
  isLast: boolean
  continues: boolean[]
  ancestorCollapseKeys: string[]
}

export type ExpandablePlanRow = ExpandableParentRow | ExpandableLeafRow

/** Depth-first rows where nodes with children become expandable parents. */
export function flattenPlanNodesExpandable(nodes: PlanNode[], keyPrefix: string): ExpandablePlanRow[] {
  const rawRows: Array<{
    kind: 'parent' | 'leaf'
    node: PlanNode
    depth: number
    collapseKey?: string
    ancestorCollapseKeys: string[]
    childCount?: number
  }> = []
  const visited = new Set<number>()

  function visit(node: PlanNode, relDepth: number, ancestorKeys: string[]) {
    if (visited.has(node.productTypeId)) return
    visited.add(node.productTypeId)

    const children = childrenInNodeSet(node, nodes)
    if (children.length > 0) {
      const collapseKey = `${keyPrefix}/node-${node.productTypeId}`
      rawRows.push({
        kind: 'parent',
        node,
        depth: relDepth,
        collapseKey,
        ancestorCollapseKeys: ancestorKeys,
        childCount: children.length,
      })
      for (const child of children) {
        visit(child, relDepth + 1, [...ancestorKeys, collapseKey])
      }
      return
    }

    rawRows.push({
      kind: 'leaf',
      node,
      depth: relDepth,
      ancestorCollapseKeys: ancestorKeys,
    })
  }

  const roots = nodes.filter((n) => n.isRoot).sort((a, b) => a.name.localeCompare(b.name))
  for (const root of roots) visit(root, 0, [])
  for (const node of nodes) {
    if (!visited.has(node.productTypeId)) visit(node, 0, [])
  }

  const meta = computeTreeLineMeta(rawRows.map((row) => ({ depth: row.depth })))
  return rawRows.map((row, index) => {
    const line = meta[index]
    if (row.kind === 'parent') {
      return {
        kind: 'parent' as const,
        node: row.node,
        depth: row.depth,
        isLast: line.isLast,
        continues: line.continues,
        collapseKey: row.collapseKey!,
        ancestorCollapseKeys: row.ancestorCollapseKeys,
        childCount: row.childCount!,
      }
    }
    return {
      kind: 'leaf' as const,
      node: row.node,
      depth: row.depth,
      isLast: line.isLast,
      continues: line.continues,
      ancestorCollapseKeys: row.ancestorCollapseKeys,
    }
  })
}

export function isExpandableRowVisible(
  row: { ancestorCollapseKeys: string[] },
  collapsed: Set<string>,
): boolean {
  return !row.ancestorCollapseKeys.some((key) => collapsed.has(key))
}

export function expandableCollapseKeys(
  rows: Array<{ kind: 'parent' | 'leaf' | 'group'; collapseKey?: string }>,
): string[] {
  return rows.flatMap((row) => (row.kind === 'parent' && row.collapseKey ? [row.collapseKey] : []))
}

/** Depth-first buy nodes within a group (relative depth from group anchor). */
export function sortBuyGroupNodesDepthFirst(
  groupNodes: PlanNode[],
  parentProductTypeId: number | null,
): PlanTreeRow<PlanNode>[] {
  const groupIds = new Set(groupNodes.map((n) => n.productTypeId))
  const result: PlanTreeRow<PlanNode>[] = []
  const visited = new Set<number>()

  function visit(node: PlanNode, depth: number) {
    if (visited.has(node.productTypeId)) return
    visited.add(node.productTypeId)
    result.push({ item: node, depth })

    const children = groupNodes
      .filter(
        (n) =>
          n.parentProductTypeIds.includes(node.productTypeId) ||
          n.demandByParent.some((d) => d.parentProductTypeId === node.productTypeId),
      )
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const child of children) visit(child, depth + 1)
  }

  const roots = groupNodes
    .filter((n) => {
      if (parentProductTypeId != null) {
        return (
          n.parentProductTypeIds.includes(parentProductTypeId) ||
          n.demandByParent.some((d) => d.parentProductTypeId === parentProductTypeId)
        )
      }
      const parentInGroup =
        n.parentProductTypeIds.some((id) => groupIds.has(id)) ||
        n.demandByParent.some((d) => groupIds.has(d.parentProductTypeId))
      return !parentInGroup || n.demandByParent.length > 1
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const root of roots) visit(root, 0)
  for (const node of groupNodes) {
    if (!visited.has(node.productTypeId)) visit(node, 0)
  }

  return result
}
