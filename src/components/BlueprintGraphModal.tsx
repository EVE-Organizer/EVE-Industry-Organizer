import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
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
  resolveBuildSystem,
} from '@/services/data/sdeLoader'
import { buildSupplyChain } from '@/lib/supplyChain'
import { appRoute } from '@/lib/paths'
import { formatIsk, formatQuantity } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'

interface BlueprintGraphModalProps {
  blueprint: BlueprintInfo | null
  hub: GlobalSettings['primaryHub']
  settings: GlobalSettings
  onClose: () => void
}

const COLUMN_GAP = 64
const ROW_GAP = 18
const MAX_DEPTH_TIER = 4

type NodeRole = 'root' | 'blueprint' | 'build' | 'buy'

interface NodeSize {
  width: number
  height: number
}

/** Same depth = same box size; each level down is smaller. */
const DEPTH_SIZES: NodeSize[] = [
  { width: 210, height: 82 },
  { width: 182, height: 72 },
  { width: 160, height: 62 },
  { width: 142, height: 54 },
  { width: 128, height: 48 },
]

interface DepthVisual {
  iconSize: number
  nameClass: string
  metaClass: string
  badgeClass: string
  padding: string
  nameLines: 1 | 2
}

const DEPTH_VISUALS: DepthVisual[] = [
  {
    iconSize: 34,
    nameClass: 'text-sm font-bold',
    metaClass: 'text-[10px]',
    badgeClass: 'badge-sm',
    padding: 'px-2.5 py-2',
    nameLines: 2,
  },
  {
    iconSize: 28,
    nameClass: 'text-xs font-semibold',
    metaClass: 'text-[10px]',
    badgeClass: 'badge-sm',
    padding: 'px-2 py-1.5',
    nameLines: 2,
  },
  {
    iconSize: 24,
    nameClass: 'text-[11px] font-semibold',
    metaClass: 'text-[9px]',
    badgeClass: 'badge-xs',
    padding: 'px-2 py-1',
    nameLines: 1,
  },
  {
    iconSize: 20,
    nameClass: 'text-[10px] font-medium',
    metaClass: 'text-[9px]',
    badgeClass: 'badge-xs',
    padding: 'px-1.5 py-1',
    nameLines: 1,
  },
  {
    iconSize: 18,
    nameClass: 'text-[10px] font-medium',
    metaClass: 'text-[8px]',
    badgeClass: 'badge-xs',
    padding: 'px-1.5 py-0.5',
    nameLines: 1,
  },
]

function depthTier(depth: number): number {
  return Math.min(Math.max(depth, 0), MAX_DEPTH_TIER)
}

function depthSize(depth: number): NodeSize {
  return DEPTH_SIZES[depthTier(depth)]!
}

function depthVisual(depth: number): DepthVisual {
  return DEPTH_VISUALS[depthTier(depth)]!
}

function rowGapAtDepth(depth: number): number {
  if (depth >= 3) return 12
  if (depth >= 2) return 14
  return ROW_GAP
}

interface SupplyNodeData extends Record<string, unknown> {
  label: string
  typeId: number
  productTypeId?: number
  quantity: number
  unitPrice: number
  totalCost: number
  buildCost?: number
  buyCost?: number
  savings?: number
  mode: string
  role: NodeRole
  depth: number
}

const edgeDefaults: Partial<Edge> = {
  type: 'step',
  style: { strokeWidth: 1.5, stroke: '#94a3b8' },
}

function nodeRole(node: SupplyChainNode): NodeRole {
  if (node.depth === 0) return 'root'
  if (node.mode === 'blueprint') return 'blueprint'
  if (node.mode === 'build') return 'build'
  return 'buy'
}

function makeNode(node: SupplyChainNode, id: string, x: number, y: number, depth: number): Node {
  const size = depthSize(depth)
  return {
    id,
    position: { x, y },
    data: nodeData(node),
    type: 'supplyNode',
    width: size.width,
    height: size.height,
  }
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target, ...edgeDefaults }
}

function nodeId(node: SupplyChainNode): string {
  return node.graphId ?? String(node.typeId)
}

function nodeData(node: SupplyChainNode): SupplyNodeData {
  return {
    label: node.name,
    typeId: node.typeId,
    productTypeId: node.productTypeId,
    unitPrice: node.unitPrice,
    quantity: node.quantity,
    totalCost: node.totalCost,
    buildCost: node.buildCost,
    buyCost: node.buyCost,
    savings: node.savings,
    mode: node.mode,
    role: nodeRole(node),
    depth: node.depth,
  }
}

function chainToFlow(root: SupplyChainNode): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Align every node at the same depth into a shared column so the hierarchy
  // reads as clean left-to-right levels.
  const maxWidthByDepth = new Map<number, number>()
  function scanWidths(node: SupplyChainNode, depth: number) {
    const width = depthSize(depth).width
    maxWidthByDepth.set(depth, Math.max(maxWidthByDepth.get(depth) ?? 0, width))
    node.children?.forEach((child) => scanWidths(child, depth + 1))
  }
  scanWidths(root, 0)

  const columnX = new Map<number, number>()
  let accX = 0
  const maxDepth = Math.max(...maxWidthByDepth.keys())
  for (let depth = 0; depth <= maxDepth; depth++) {
    columnX.set(depth, accX)
    accX += (maxWidthByDepth.get(depth) ?? 0) + COLUMN_GAP
  }

  // Pass 1: reserve the exact vertical space each subtree needs. A subtree is
  // as tall as its stacked children, but never shorter than the node itself.
  const subtreeHeight = new Map<SupplyChainNode, number>()
  function measure(node: SupplyChainNode, depth: number): number {
    const cached = subtreeHeight.get(node)
    if (cached != null) return cached

    const ownHeight = depthSize(depth).height
    const children = node.children ?? []
    let height = ownHeight
    if (children.length > 0) {
      const gap = rowGapAtDepth(depth)
      const block =
        children.reduce((sum, child) => sum + measure(child, depth + 1), 0) +
        gap * (children.length - 1)
      height = Math.max(block, ownHeight)
    }
    subtreeHeight.set(node, height)
    return height
  }
  measure(root, 0)

  // Pass 2: place each node centered inside the band reserved for its subtree.
  // Because bands never overlap, nodes never overlap regardless of tree size.
  function place(node: SupplyChainNode, depth: number, top: number, id: string) {
    const size = depthSize(depth)
    const x = columnX.get(depth) ?? 0
    const band = measure(node, depth)

    nodes.push(makeNode(node, id, x, top + (band - size.height) / 2, depth))

    const children = node.children ?? []
    if (children.length === 0) return

    const gap = rowGapAtDepth(depth)
    const block =
      children.reduce((sum, child) => sum + measure(child, depth + 1), 0) +
      gap * (children.length - 1)

    let cursorY = top + (band - block) / 2
    children.forEach((child, index) => {
      const childId = `${id}.${index}`
      edges.push(makeEdge(id, childId))
      place(child, depth + 1, cursorY, childId)
      cursorY += measure(child, depth + 1) + gap
    })
  }

  place(root, 0, 0, nodeId(root))
  return { nodes, edges }
}

const ROLE_STYLES: Record<NodeRole, { border: string }> = {
  root: { border: 'border-primary/70 ring-1 ring-primary/20' },
  build: { border: 'border-success/50' },
  blueprint: { border: 'border-info/50' },
  buy: { border: 'border-eve-border' },
}

const ROLE_BADGE: Record<NodeRole, { label: string; title: string; className: string }> = {
  root: {
    label: 'Output',
    title: 'Final product you manufacture',
    className: 'badge-primary font-semibold',
  },
  build: {
    label: 'Build',
    title: 'Manufacture from sub-materials (cheaper than buying)',
    className: 'badge-success font-semibold',
  },
  blueprint: {
    label: 'BPO',
    title: 'Blueprint original required for the job',
    className: 'badge-info font-semibold',
  },
  buy: {
    label: 'Buy',
    title: 'Purchase from market',
    className: 'badge-warning font-semibold',
  },
}

function GraphRoleBadge({
  role,
  sizeClass = 'badge-sm',
  className = 'mt-0.5',
}: {
  role: NodeRole
  sizeClass?: string
  className?: string
}) {
  const badge = ROLE_BADGE[role]
  return (
    <span className={`badge ${sizeClass} ${badge.className} ${className}`} title={badge.title}>
      {badge.label}
    </span>
  )
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="opacity-60">{label}</span>
      <span className={`tabular-nums font-medium ${accent ?? ''}`}>{value}</span>
    </div>
  )
}

function NodeDetailCard({ data }: { data: SupplyNodeData }) {
  const isBlueprint = data.role === 'blueprint'
  const hasComparison =
    data.role === 'build' && data.buildCost != null && data.buyCost != null

  return (
    <div className="w-60 rounded-lg border border-eve-border bg-neutral text-neutral-content shadow-xl p-3 text-xs leading-snug">
      <p className="font-semibold text-sm break-words">{data.label}</p>
      <GraphRoleBadge role={data.role} className="mt-1 mb-2" />
      <div className="flex flex-col gap-1">
        <DetailRow label="Quantity" value={isBlueprint ? '1 BPO' : formatQuantity(data.quantity)} />
        {data.unitPrice > 0 && <DetailRow label="Unit price" value={formatIsk(data.unitPrice)} />}
        {!isBlueprint && <DetailRow label="Total cost" value={formatIsk(data.totalCost)} />}
        {hasComparison && (
          <>
            <div className="border-t border-neutral-content/15 my-1" />
            <DetailRow label="Buy" value={formatIsk(data.buyCost!)} />
            <DetailRow label="Build" value={formatIsk(data.buildCost!)} />
            {data.savings != null && (
              <DetailRow
                label={data.savings >= 0 ? 'Savings (build)' : 'Extra cost'}
                value={formatIsk(Math.abs(data.savings))}
                accent={data.savings >= 0 ? 'text-success' : 'text-error'}
              />
            )}
          </>
        )}
      </div>
      <p className="opacity-50 mt-2 text-[10px]">Click to open item detail</p>
    </div>
  )
}

function SupplyNode({ data }: { data: SupplyNodeData }) {
  const ref = useRef<HTMLDivElement>(null)
  const [cardStyle, setCardStyle] = useState<CSSProperties | null>(null)

  const isBlueprint = data.role === 'blueprint'
  const roleStyle = ROLE_STYLES[data.role]
  const visual = depthVisual(data.depth)
  const qtyLabel = isBlueprint ? '1 BPO' : formatQuantity(data.quantity)
  const costLabel =
    data.unitPrice > 0 ? formatIsk(data.unitPrice) : isBlueprint ? '—' : formatIsk(data.totalCost)

  const showCard = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const flipLeft = rect.right + 256 > window.innerWidth
    setCardStyle(
      flipLeft
        ? { top: rect.top, left: rect.left - 8, transform: 'translateX(-100%)' }
        : { top: rect.top, left: rect.right + 8 },
    )
  }, [])

  const hideCard = useCallback(() => setCardStyle(null), [])

  return (
    <>
      <div
        ref={ref}
        className={`h-full w-full overflow-hidden bg-base-200 border ${roleStyle.border} rounded-lg ${visual.padding} shadow-md cursor-grab active:cursor-grabbing transition-colors hover:border-primary`}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        onMouseDown={hideCard}
      >
        <Handle type="target" position={Position.Left} className="opacity-0" />
        <div className="flex items-center gap-1.5 h-full min-h-0">
          <EveImage
            id={data.typeId}
            variant={isBlueprint ? 'bp' : 'icon'}
            productTypeId={data.productTypeId}
            size={visual.iconSize}
            framed
            alt=""
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 overflow-hidden">
            <p
              className={`${visual.nameClass} leading-tight ${visual.nameLines === 1 ? 'truncate' : 'line-clamp-2'}`}
              title={data.label}
            >
              {data.label}
            </p>
            <p className={`${visual.metaClass} opacity-60 leading-tight truncate`}>
              {qtyLabel} · {costLabel}
            </p>
            <GraphRoleBadge role={data.role} sizeClass={visual.badgeClass} className="self-start" />
          </div>
        </div>
        <Handle type="source" position={Position.Right} className="opacity-0" />
      </div>
      {cardStyle &&
        createPortal(
          <div className="pointer-events-none fixed z-[9999]" style={cardStyle}>
            <NodeDetailCard data={data} />
          </div>,
          document.body,
        )}
    </>
  )
}

const nodeTypes = { supplyNode: SupplyNode }

export function BlueprintGraphModal({ blueprint, hub, settings, onClose }: BlueprintGraphModalProps) {
  const { data: sde } = useSdeData()

  const layout = useMemo(() => {
    if (!sde || !blueprint) return { nodes: [], edges: [] }
    const hubMarket = getHubMarket(sde.market, hub)
    if (!hubMarket) return { nodes: [], edges: [] }

    const { costIndex } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      hubMarket,
      settings.manufacturingSystemId,
    )

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

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(layout.nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    setFlowNodes(layout.nodes)
    setFlowEdges(layout.edges)
  }, [layout, setFlowNodes, setFlowEdges])

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
          Hover a node for details, drag to rearrange, click to open item detail in a new tab. Prices from static market data.
        </p>
        <div className="flex-1 min-h-0 border border-eve-border rounded-lg overflow-hidden">
          {flowNodes.length > 0 ? (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              selectionOnDrag={false}
              defaultEdgeOptions={edgeDefaults}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
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
