import type { Edge, Node } from '@xyflow/react'

export interface FlowHandleSlot {
  id: string
  top: string
}

export interface FlowHandleData extends Record<string, unknown> {
  sourceHandles?: FlowHandleSlot[]
  targetHandles?: FlowHandleSlot[]
}

function nodeCenterY(node: Node): number {
  return node.position.y + (node.height ?? 0) / 2
}

function clampPercent(value: number): string {
  return `${Math.min(100, Math.max(0, value))}%`
}

function relativeTop(node: Node, centerY: number): string {
  const height = node.height ?? 0
  if (height <= 0) return '50%'
  return clampPercent(((centerY - node.position.y) / height) * 100)
}

/** Route each edge to its own handle so step paths do not share one vertical trunk. */
export function withAlignedEdgeHandles(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const sourceHandlesByNode = new Map<string, Map<string, string>>()
  const targetHandlesByNode = new Map<string, Map<string, string>>()

  const nextEdges = edges.map((edge) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) return edge

    const sourceCenterY = nodeCenterY(source)
    const targetCenterY = nodeCenterY(target)

    if (source.position.x < target.position.x) {
      const sourceHandleId = `out-${edge.target}`
      const sourceTops = sourceHandlesByNode.get(edge.source) ?? new Map<string, string>()
      sourceTops.set(sourceHandleId, relativeTop(source, targetCenterY))
      sourceHandlesByNode.set(edge.source, sourceTops)

      const targetHandleId = `in-${edge.source}`
      const targetTops = targetHandlesByNode.get(edge.target) ?? new Map<string, string>()
      targetTops.set(targetHandleId, relativeTop(target, sourceCenterY))
      targetHandlesByNode.set(edge.target, targetTops)

      return { ...edge, sourceHandle: sourceHandleId, targetHandle: targetHandleId }
    }

    // Right-to-left (recipe graph): keep source at mid-card; align target to source row.
    const handleId = `in-${edge.source}`
    const targetTops = targetHandlesByNode.get(edge.target) ?? new Map<string, string>()
    targetTops.set(handleId, relativeTop(target, sourceCenterY))
    targetHandlesByNode.set(edge.target, targetTops)

    const sourceHandleId = `out-${edge.target}`
    const sourceTops = sourceHandlesByNode.get(edge.source) ?? new Map<string, string>()
    sourceTops.set(sourceHandleId, '50%')
    sourceHandlesByNode.set(edge.source, sourceTops)

    return { ...edge, sourceHandle: sourceHandleId, targetHandle: handleId }
  })

  const nextNodes = nodes.map((node) => {
    const sourceHandles = sourceHandlesByNode.get(node.id)
    const targetHandles = targetHandlesByNode.get(node.id)
    if (!sourceHandles && !targetHandles) return node

    const data = { ...(node.data as Record<string, unknown>) } as FlowHandleData
    if (sourceHandles) {
      data.sourceHandles = [...sourceHandles.entries()].map(([id, top]) => ({ id, top }))
    }
    if (targetHandles) {
      data.targetHandles = [...targetHandles.entries()].map(([id, top]) => ({ id, top }))
    }

    return { ...node, data }
  })

  return { nodes: nextNodes, edges: nextEdges }
}
