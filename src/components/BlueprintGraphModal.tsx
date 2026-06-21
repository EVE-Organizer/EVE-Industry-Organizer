import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BlueprintInfo, GlobalSettings, SupplyChainNode } from '@/types'
import { useSdeData } from '@/hooks/useSdeData'
import {
  buildPriceMap,
  buildTypeMap,
  getAllBlueprints,
  getHubMarket,
} from '@/services/data/sdeLoader'
import { buildSupplyChain } from '@/lib/supplyChain'
import { appRoute } from '@/lib/paths'
import { formatIsk } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'

interface BlueprintGraphModalProps {
  blueprint: BlueprintInfo | null
  hub: GlobalSettings['primaryHub']
  settings: GlobalSettings
  onClose: () => void
}

function chainToFlow(root: SupplyChainNode): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const H_SPACING = 180
  const V_SPACING = 100

  function countLeaves(node: SupplyChainNode): number {
    if (node.isLeaf || !node.children?.length) return 1
    return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
  }

  function layout(node: SupplyChainNode, depth: number, xOffset: number): number {
    const leafCount = countLeaves(node)
    const x = xOffset + ((leafCount - 1) * H_SPACING) / 2
    const y = depth * V_SPACING
    const nodeId = node.graphId ?? String(node.typeId)

    nodes.push({
      id: nodeId,
      position: { x, y },
      data: {
        label: node.name,
        typeId: node.typeId,
        productTypeId: node.productTypeId,
        unitPrice: node.unitPrice,
        quantity: node.quantity,
        totalCost: node.totalCost,
        mode: node.mode,
      },
      type: 'supplyNode',
    })

    if (node.children?.length) {
      let childOffset = xOffset
      for (const child of node.children) {
        const childLeaves = countLeaves(child)
        layout(child, depth + 1, childOffset)
        const childId = child.graphId ?? String(child.typeId)
        edges.push({
          id: `${nodeId}-${childId}`,
          source: nodeId,
          target: childId,
        })
        childOffset += childLeaves * H_SPACING
      }
    }

    return leafCount * H_SPACING
  }

  layout(root, 0, 0)
  return { nodes, edges }
}

function SupplyNode({
  data,
}: {
  data: {
    label: string
    typeId: number
    productTypeId?: number
    quantity: number
    unitPrice: number
    totalCost: number
    mode: string
  }
}) {
  const isBlueprint = data.mode === 'blueprint'
  const qtyLabel = isBlueprint ? '1 BPO' : data.quantity.toLocaleString()
  const costLabel =
    data.unitPrice > 0 ? formatIsk(data.unitPrice) : isBlueprint ? '—' : formatIsk(data.totalCost)

  return (
    <div className="bg-base-200 border border-eve-border rounded-lg px-3 py-2 min-w-[140px] shadow-md cursor-pointer hover:border-primary">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-center gap-2">
        <EveImage
          id={data.typeId}
          variant={isBlueprint ? 'bp' : 'icon'}
          productTypeId={data.productTypeId}
          size={28}
          framed
          alt=""
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate max-w-[120px]">{data.label}</p>
          <p className="text-[10px] opacity-60">
            {qtyLabel} · {costLabel}
          </p>
          <span className="badge badge-xs badge-ghost">{isBlueprint ? 'blueprint' : data.mode}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
}

const nodeTypes = { supplyNode: SupplyNode }

export function BlueprintGraphModal({ blueprint, hub, settings, onClose }: BlueprintGraphModalProps) {
  const { data: sde } = useSdeData()

  const { nodes, edges } = useMemo(() => {
    if (!sde || !blueprint) return { nodes: [], edges: [] }
    const hubMarket = getHubMarket(sde.market, hub)
    if (!hubMarket) return { nodes: [], edges: [] }

    const region =
      sde.regions.regions.find((r) => r.regionId === settings.manufacturingRegionId) ??
      sde.regions.regions.find((r) => r.regionId === hubMarket.regionId)
    const costIndex = region?.costIndex ?? hubMarket.costIndex

    const typeMap = buildTypeMap(sde.types)
    const prices = buildPriceMap(hubMarket)
    const allBlueprints = getAllBlueprints(sde.registry)
    const chain = buildSupplyChain(
      blueprint,
      allBlueprints,
      typeMap,
      prices,
      settings,
      settings.meDefault,
      costIndex,
    )
    return chainToFlow(chain)
  }, [sde, blueprint, hub, settings])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const typeId = (node.data as { typeId: number }).typeId
    window.open(appRoute(`item/${typeId}`), '_blank', 'noopener,noreferrer')
  }, [])

  if (!blueprint) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-5xl w-full h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="font-bold text-lg">Production graph</h3>
          <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="text-xs opacity-60 mb-3 shrink-0">
          Click a node to open item detail in a new tab. Prices from static market data.
        </p>
        <div className="flex-1 min-h-0 border border-eve-border rounded-lg overflow-hidden">
          {nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          ) : (
            <div className="flex items-center justify-center h-full text-sm opacity-60">
              No supply chain data available.
            </div>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}
