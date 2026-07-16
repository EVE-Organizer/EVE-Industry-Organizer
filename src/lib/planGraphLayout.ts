import type { PlanNode } from '@/types'
import type { Edge, Node } from '@xyflow/react'

/** Vertical gap between depth layers (top → bottom). */
export const PLAN_GRAPH_LAYER_GAP = 64
/** Horizontal gap between nodes on the same layer. */
export const PLAN_GRAPH_NODE_GAP = 24

export interface PlanFlowNodeData {
  planNode: PlanNode
  [key: string]: unknown
}

export function planNodeWidth(depth: number, isRoot: boolean): number {
  if (isRoot) return 288
  if (depth <= 1) return 204
  return 180
}

export function planNodeHeight(node: PlanNode): number {
  let base: number
  if (node.isRoot) base = 212
  else if (node.mode === 'build') base = 172
  else base = 76
  if (node.canToggle && node.buyCost != null) base += 28
  return base
}

function layerRowWidth(layer: PlanNode[], depth: number): number {
  if (layer.length === 0) return 0
  const widths = layer.map((n) => planNodeWidth(depth, n.isRoot))
  return widths.reduce((sum, w) => sum + w, 0) + PLAN_GRAPH_NODE_GAP * (layer.length - 1)
}

export function planNodesToFlow(nodes: PlanNode[]): {
  nodes: Node<PlanFlowNodeData>[]
  edges: Edge[]
} {
  const byId = new Map(nodes.map((n) => [n.productTypeId, n]))
  const edges: Edge[] = []

  for (const node of nodes) {
    for (const childId of node.childProductTypeIds) {
      if (!byId.has(childId)) continue
      edges.push({
        id: `${node.productTypeId}-${childId}`,
        source: String(node.productTypeId),
        target: String(childId),
        type: 'step',
        style: { strokeWidth: 1.25, stroke: '#64748b', opacity: 0.65 },
      })
    }
  }

  const byDepth = new Map<number, PlanNode[]>()
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? []
    list.push(node)
    byDepth.set(node.depth, list)
  }

  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth))
  const layersByDepth: { depth: number; layer: PlanNode[] }[] = []
  for (let depth = 0; depth <= maxDepth; depth++) {
    const layer = (byDepth.get(depth) ?? []).sort((a, b) => a.name.localeCompare(b.name))
    if (layer.length > 0) layersByDepth.push({ depth, layer })
  }

  const maxRowWidth = Math.max(
    0,
    ...layersByDepth.map(({ depth, layer }) => layerRowWidth(layer, depth)),
  )

  const flowNodes: Node<PlanFlowNodeData>[] = []
  let rowY = 0

  for (const { depth, layer } of layersByDepth) {
    const rowWidth = layerRowWidth(layer, depth)
    let x = (maxRowWidth - rowWidth) / 2
    let rowMaxHeight = 0

    for (const planNode of layer) {
      const width = planNodeWidth(depth, planNode.isRoot)
      const height = planNodeHeight(planNode)
      flowNodes.push({
        id: String(planNode.productTypeId),
        type: 'planNode',
        position: { x, y: rowY },
        width,
        height,
        data: { planNode },
      })
      x += width + PLAN_GRAPH_NODE_GAP
      rowMaxHeight = Math.max(rowMaxHeight, height)
    }

    rowY += rowMaxHeight + PLAN_GRAPH_LAYER_GAP
  }

  return { nodes: flowNodes, edges }
}
