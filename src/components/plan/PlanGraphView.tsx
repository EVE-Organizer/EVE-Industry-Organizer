import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type CSSProperties,
} from 'react'
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import { ScoreBar } from '@/components/ScoreBar'
import { inventoryAtPlanEnd } from '@/lib/planSimulator'
import {
  PLAN_GRAPH_LAYER_GAP,
  planNodeHeight,
  planNodesToFlow,
  type PlanFlowNodeData,
} from '@/lib/planGraphLayout'
import { planBuildVsBuyFootnote, planBuildVsBuySummary } from '@/lib/planBuildVsBuy'
import { formatDecimal, formatDuration, formatGraphQuantity } from '@/lib/profit'
import type { PlanNode, PlanNodeSimulation } from '@/types'

const PlanGraphActionsContext = createContext<{
  onToggleMode: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
  simulations: Map<number, PlanNodeSimulation>
  windowHours: number
} | null>(null)

const NODE_STYLES = {
  root: {
    border: 'border-primary/50',
    shell: 'bg-base-200/95 ring-1 ring-primary/10',
    accent: 'bg-primary',
  },
  build: {
    border: 'border-success/35',
    shell: 'bg-base-200/95',
    accent: 'bg-success',
  },
  buy: {
    border: 'border-eve-border',
    shell: 'bg-base-200/95',
    accent: 'bg-warning',
  },
} as const

function nodeStyleKey(node: PlanNode): keyof typeof NODE_STYLES {
  if (node.isRoot) return 'root'
  return node.mode === 'build' ? 'build' : 'buy'
}

function PlanBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`badge badge-sm inline-flex h-5 min-w-[2.75rem] items-center justify-center px-1.5 font-semibold ${className}`}
    >
      {label}
    </span>
  )
}

function PlanNodeBadges({ node }: { node: PlanNode }) {
  const shared = node.demandByParent.length > 1
  const modeLabel = node.isRoot
    ? 'Build'
    : !node.canToggle
      ? 'Market'
      : node.recipeKind === 'reaction' && node.mode === 'build'
        ? 'React'
        : node.mode === 'build'
          ? 'Build'
          : 'Buy'
  const modeClass = node.isRoot || node.mode === 'build'
    ? 'badge-success'
    : !node.canToggle
      ? 'badge-ghost border border-eve-border'
      : 'badge-warning'

  return (
    <div className="flex flex-wrap items-center gap-1 min-h-5 mt-1">
      <PlanBadge label={modeLabel} className={modeClass} />
      {node.isRoot ? <PlanBadge label="Root" className="badge-primary" /> : null}
      {shared ? <PlanBadge label="Shared" className="badge-outline border-eve-border" /> : null}
      {node.tier === 't2' ? <PlanBadge label="T2" className="badge-warning" /> : null}
      {node.recipeKind === 'reaction' && node.mode === 'build' ? (
        <PlanBadge label="Reaction" className="badge-accent" />
      ) : null}
      {node.canToggle && node.recommendedMode && node.mode !== node.recommendedMode ? (
        <PlanBadge
          label={node.recommendedMode === 'build' ? '→Build' : '→Buy'}
          className="badge-outline border-eve-border opacity-70"
        />
      ) : null}
    </div>
  )
}

function PlanFlowNode({ data }: { data: PlanFlowNodeData }) {
  const actions = useContext(PlanGraphActionsContext)
  const node = data.planNode
  const style = NODE_STYLES[nodeStyleKey(node)]
  const simulations = actions?.simulations ?? new Map<number, PlanNodeSimulation>()
  const windowHours = actions?.windowHours ?? 0
  const inventory = inventoryAtPlanEnd(simulations, node.productTypeId)
  const sim = simulations.get(node.productTypeId)

  const sparkProduce = useMemo(() => {
    if (!sim || sim.buckets.length === 0) return 0
    const max = Math.max(1, ...sim.buckets.map((b) => b.supply))
    const last = sim.buckets[sim.buckets.length - 1]!
    return (last.supply / max) * 100
  }, [sim])

  const sparkInv = Math.min(
    100,
    Math.max(0, 50 + (inventory / Math.max(1, node.totalDemandQty)) * 50),
  )

  const iconSize = node.isRoot ? 36 : node.depth <= 1 ? 28 : 24
  const blueprintTypeId = actions?.blueprintTypeIdByProduct.get(node.productTypeId)
  const padding = node.isRoot ? 'px-3 py-2.5' : 'px-2 py-1.5'
  const canToggle = node.canToggle
  const costSummary = planBuildVsBuySummary(node)
  const savingsFootnote = planBuildVsBuyFootnote(node)

  return (
    <div
      role={canToggle ? 'button' : undefined}
      tabIndex={canToggle ? 0 : undefined}
      className={`group relative h-full w-full overflow-hidden rounded-xl border shadow-sm ${canToggle ? 'cursor-pointer hover:shadow-lg hover:border-primary/50' : 'cursor-default'} ${style.border} ${style.shell} ${padding}`}
      onClick={canToggle ? () => actions?.onToggleMode(node.productTypeId) : undefined}
      onKeyDown={
        canToggle
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                actions?.onToggleMode(node.productTypeId)
              }
            }
          : undefined
      }
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />
      {canToggle ? (
        <span className="pointer-events-none absolute top-1 right-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-primary text-primary-content opacity-0 group-hover:opacity-100 shadow-sm">
          Toggle
        </span>
      ) : null}
      <div className={`absolute inset-y-0 left-0 w-0.5 ${style.accent}`} aria-hidden />
      <div className="relative h-full pl-0.5 flex flex-col gap-1.5 min-h-0 overflow-hidden">
        <div className="flex gap-2 min-h-0 shrink-0">
          <PlanProductIcon
            productTypeId={node.productTypeId}
            blueprintTypeId={blueprintTypeId}
            size={iconSize}
            alt=""
          />
          <div className="min-w-0 flex-1">
            <p
              className={`font-semibold leading-tight line-clamp-2 ${node.isRoot ? 'text-sm' : 'text-[11px]'}`}
              title={node.name}
            >
              {node.name}
            </p>
            <PlanNodeBadges node={node} />
          </div>
        </div>

        <div className="text-[10px] tabular-nums leading-snug opacity-70 shrink-0">
          <p>
            Need <span className="font-medium text-base-content">{formatGraphQuantity(node.totalDemandQty)}</span>
            {node.mode === 'build' ? (
              <>
                {' · '}
                <span className="font-medium text-base-content">{formatGraphQuantity(node.outputQty)}</span>
                <span className="opacity-70"> out</span>
              </>
            ) : null}
          </p>
          {node.mode === 'build' && (
            <p>
              {node.runs} runs · {node.bpcCount} BPC
              {node.jobTimeSeconds > 0 ? (
                <>
                  {' · '}
                  <span className="text-info font-medium">{formatDuration(node.jobTimeSeconds)}</span>
                </>
              ) : null}
            </p>
          )}
          {costSummary ? <p className="truncate" title={costSummary}>{costSummary}</p> : null}
          {savingsFootnote ? (
            <p className={`font-medium ${savingsFootnote.accent}`}>{savingsFootnote.text}</p>
          ) : null}
        </div>

        {node.mode === 'build' && (
          <div className="mt-auto space-y-1 min-h-0">
            <ScoreBar label="Output" value={sparkProduce} max={100} accent="bg-primary" />
            <ScoreBar
              label={`Stock @ ${formatDecimal(windowHours, 0)}h`}
              value={sparkInv}
              max={100}
              accent={inventory < 0 ? 'bg-error' : 'bg-success'}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  )
}

const nodeTypes = { planNode: PlanFlowNode }

function PlanGraphViewportSync({
  nodeCount,
  layoutKey,
}: {
  nodeCount: number
  layoutKey?: string
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (nodeCount === 0) return
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.12, duration: 200 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [nodeCount, layoutKey, fitView])

  return null
}

function PlanGraphCanvas({
  nodes,
  onToggleMode,
  blueprintTypeIdByProduct,
  simulations,
  windowHours,
  layoutKey,
}: {
  nodes: PlanNode[]
  onToggleMode: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
  simulations: Map<number, PlanNodeSimulation>
  windowHours: number
  layoutKey?: string
}) {
  const layout = useMemo(() => planNodesToFlow(nodes), [nodes])
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(layout.nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    setFlowNodes(layout.nodes)
    setFlowEdges(layout.edges)
  }, [layout, setFlowNodes, setFlowEdges])

  const actions = useMemo(
    () => ({ onToggleMode, blueprintTypeIdByProduct, simulations, windowHours }),
    [onToggleMode, blueprintTypeIdByProduct, simulations, windowHours],
  )

  if (nodes.length === 0) {
    return <p className="text-sm opacity-60 p-4">Add root blueprints to see the production chain.</p>
  }

  return (
    <PlanGraphActionsContext.Provider value={actions}>
      <div className="absolute inset-0">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnPinch
          zoomOnScroll={false}
          selectionOnDrag={false}
          proOptions={{ hideAttribution: true }}
          className="h-full w-full"
        >
          <PlanGraphViewportSync nodeCount={flowNodes.length} layoutKey={layoutKey} />
          <Background gap={16} size={1} />
        </ReactFlow>
      </div>
    </PlanGraphActionsContext.Provider>
  )
}

function estimateGraphHeight(nodes: PlanNode[]): string {
  const byDepth = new Map<number, PlanNode[]>()
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? []
    list.push(node)
    byDepth.set(node.depth, list)
  }

  const layers = [...byDepth.values()]
  const totalHeight =
    layers.reduce((sum, layer) => {
      const rowHeight = Math.max(...layer.map((n) => planNodeHeight(n)))
      return sum + rowHeight
    }, 0) + PLAN_GRAPH_LAYER_GAP * Math.max(0, layers.length - 1)

  const minH = Math.max(320, totalHeight + 48)
  return `min(${Math.min(minH, 720)}px, 75vh)`
}

export function PlanGraphView({
  nodes,
  onToggleMode,
  blueprintTypeIdByProduct,
  simulations,
  windowHours,
  layout = 'embedded',
}: {
  nodes: PlanNode[]
  onToggleMode: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
  simulations: Map<number, PlanNodeSimulation>
  windowHours: number
  layout?: 'embedded' | 'expanded'
}) {
  const expanded = layout === 'expanded'
  const graphHeight = useMemo((): CSSProperties['height'] => {
    if (expanded || nodes.length === 0) return undefined
    return estimateGraphHeight(nodes)
  }, [expanded, nodes])

  return (
    <div className={`flex flex-col min-h-0${expanded ? ' flex-1' : ''}`}>
      <p className="text-xs opacity-50 mb-2 shrink-0">
        Top to bottom: finished products → inputs. Drag to pan · scroll to zoom. Click buildable
        items to switch Build / Buy (costs match the production graph). Stock bars show inventory
        when the plan finishes.
      </p>
      <div
        className={`relative rounded-lg border border-eve-border bg-base-300/30 overflow-hidden min-h-0${expanded ? ' flex-1' : ' shrink-0'}`}
        style={{
          height: graphHeight,
          minHeight: nodes.length === 0 ? undefined : expanded ? '16rem' : '20rem',
        }}
      >
        <ReactFlowProvider>
          <PlanGraphCanvas
            nodes={nodes}
            onToggleMode={onToggleMode}
            blueprintTypeIdByProduct={blueprintTypeIdByProduct}
            simulations={simulations}
            windowHours={windowHours}
            layoutKey={layout}
          />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
