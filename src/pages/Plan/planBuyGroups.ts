import type { PlanNode } from '@/types'
import {
  computeTreeLineMeta,
} from '@/pages/Plan/planTreeLines'

export interface PlanBuyGroup {
  key: string
  parentProductTypeId: number | null
  parentName: string
  parentDepth: number
  nodes: PlanNode[]
}

export interface PlanBuyGroupRow {
  kind: 'group'
  key: string
  parentProductTypeId: number | null
  parentName: string
  itemCount: number
  totalQty: number
  totalCost: number
  /** Build/buy parents that consume materials in the shared group. */
  consumerProductTypeIds?: number[]
}

export interface PlanBuyParentRow {
  kind: 'parent'
  groupKey: string
  collapseKey: string
  ancestorCollapseKeys: string[]
  node: PlanNode
  depth: number
  isLast: boolean
  continues: boolean[]
  childCount: number
}

export interface PlanBuyItemRow {
  kind: 'item'
  groupKey: string
  ancestorCollapseKeys: string[]
  node: PlanNode
  depth: number
  isLast: boolean
  continues: boolean[]
}

export type PlanBuyTableRow = PlanBuyGroupRow | PlanBuyParentRow | PlanBuyItemRow

function nearestBuildParentId(
  node: PlanNode,
  byId: Map<number, PlanNode>,
  visited: Set<number> = new Set(),
): number | null {
  if (visited.has(node.productTypeId)) return null
  visited.add(node.productTypeId)

  for (const parentId of node.parentProductTypeIds) {
    const parent = byId.get(parentId)
    if (!parent) continue
    if (parent.mode === 'build') return parentId
    const up = nearestBuildParentId(parent, byId, visited)
    if (up != null) return up
  }
  for (const demand of node.demandByParent) {
    const parent = byId.get(demand.parentProductTypeId)
    if (parent?.mode === 'build') return demand.parentProductTypeId
  }
  return null
}

function buyChildrenInGroup(node: PlanNode, groupNodes: PlanNode[]): PlanNode[] {
  return groupNodes
    .filter(
      (n) =>
        n.productTypeId !== node.productTypeId &&
        (n.parentProductTypeIds.includes(node.productTypeId) ||
          n.demandByParent.some((d) => d.parentProductTypeId === node.productTypeId)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

function buyGroupRoots(group: PlanBuyGroup): PlanNode[] {
  const { nodes, parentProductTypeId } = group
  const groupIds = new Set(nodes.map((n) => n.productTypeId))

  return nodes
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
}

function flattenBuyGroupRows(group: PlanBuyGroup): Array<PlanBuyParentRow | PlanBuyItemRow> {
  const rawRows: Array<{
    kind: 'parent' | 'item'
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

    const children = buyChildrenInGroup(node, group.nodes)
    const displayDepth = relDepth + 1

    if (children.length > 0) {
      const collapseKey = `${group.key}/buy-${node.productTypeId}`
      rawRows.push({
        kind: 'parent',
        node,
        depth: displayDepth,
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
      kind: 'item',
      node,
      depth: displayDepth,
      ancestorCollapseKeys: ancestorKeys,
    })
  }

  for (const root of buyGroupRoots(group)) visit(root, 0, [])
  for (const node of group.nodes) {
    if (!visited.has(node.productTypeId)) visit(node, 0, [])
  }

  const meta = computeTreeLineMeta(rawRows.map((row) => ({ depth: row.depth })))

  return rawRows.map((row, index) => {
    const line = meta[index]
    if (row.kind === 'parent') {
      return {
        kind: 'parent' as const,
        groupKey: group.key,
        collapseKey: row.collapseKey!,
        ancestorCollapseKeys: row.ancestorCollapseKeys,
        node: row.node,
        depth: row.depth,
        isLast: line.isLast,
        continues: line.continues,
        childCount: row.childCount!,
      }
    }
    return {
      kind: 'item' as const,
      groupKey: group.key,
      ancestorCollapseKeys: row.ancestorCollapseKeys,
      node: row.node,
      depth: row.depth,
      isLast: line.isLast,
      continues: line.continues,
    }
  })
}

export function buildBuyGroups(allNodes: PlanNode[], buyNodes: PlanNode[]): PlanBuyGroup[] {
  const byId = new Map(allNodes.map((n) => [n.productTypeId, n]))
  const shared: PlanNode[] = []
  const byParent = new Map<number, PlanNode[]>()

  for (const node of buyNodes) {
    if (node.demandByParent.length > 1) {
      shared.push(node)
      continue
    }
    const parentId = nearestBuildParentId(node, byId)
    if (parentId == null) {
      shared.push(node)
      continue
    }
    const list = byParent.get(parentId) ?? []
    list.push(node)
    byParent.set(parentId, list)
  }

  const groups: PlanBuyGroup[] = []
  const parentIds = [...byParent.keys()].sort((a, b) => {
    const pa = byId.get(a)
    const pb = byId.get(b)
    return (pa?.depth ?? 0) - (pb?.depth ?? 0) || (pa?.name ?? '').localeCompare(pb?.name ?? '')
  })

  for (const parentId of parentIds) {
    const parent = byId.get(parentId)
    const children = byParent.get(parentId) ?? []
    children.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
    groups.push({
      key: `parent-${parentId}`,
      parentProductTypeId: parentId,
      parentName: parent?.name ?? String(parentId),
      parentDepth: parent?.depth ?? 0,
      nodes: children,
    })
  }

  if (shared.length > 0) {
    shared.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
    groups.push({
      key: 'shared',
      parentProductTypeId: null,
      parentName: 'Shared materials',
      parentDepth: 0,
      nodes: shared,
    })
  }

  return groups
}

function sharedGroupConsumerIds(group: PlanBuyGroup, allNodes: PlanNode[]): number[] {
  const byId = new Map(allNodes.map((n) => [n.productTypeId, n]))
  const ids = new Set<number>()
  for (const node of group.nodes) {
    for (const d of node.demandByParent) {
      ids.add(d.parentProductTypeId)
    }
  }
  return [...ids].sort((a, b) => {
    const na = byId.get(a)?.name ?? String(a)
    const nb = byId.get(b)?.name ?? String(b)
    return na.localeCompare(nb)
  })
}

export function buildBuyTableRows(groups: PlanBuyGroup[], allNodes: PlanNode[]): PlanBuyTableRow[] {
  const rows: PlanBuyTableRow[] = []

  for (const group of groups) {
    const totalQty = group.nodes.reduce((sum, n) => sum + n.totalDemandQty, 0)
    const totalCost = group.nodes.reduce((sum, n) => sum + (n.buyCost ?? 0), 0)
    rows.push({
      kind: 'group',
      key: group.key,
      parentProductTypeId: group.parentProductTypeId,
      parentName: group.parentName,
      itemCount: group.nodes.length,
      totalQty,
      totalCost,
      consumerProductTypeIds:
        group.key === 'shared' ? sharedGroupConsumerIds(group, allNodes) : undefined,
    })

    rows.push(...flattenBuyGroupRows(group))
  }

  return rows
}

export function isBuyTableRowVisible(row: PlanBuyTableRow, collapsed: Set<string>): boolean {
  if (row.kind === 'group') return true
  if (collapsed.has(row.groupKey)) return false
  if (row.ancestorCollapseKeys.some((key) => collapsed.has(key))) return false
  return true
}

export function buyTableCollapseKeys(rows: PlanBuyTableRow[]): string[] {
  return rows.flatMap((row) => {
    if (row.kind === 'group') return [row.key]
    if (row.kind === 'parent') return [row.collapseKey]
    return []
  })
}
