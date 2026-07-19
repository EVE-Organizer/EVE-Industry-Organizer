import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BlueprintInfo, TypeInfo } from '@/types'
import { formatDuration, formatGraphQuantity } from '@/lib/profit'
import {
  estimateRecipeGraphHeight,
  recipeToFlow,
  type RecipeBlueprintData,
  type RecipeInputData,
  type RecipeOutputData,
} from '@/lib/recipeGraphLayout'
import { RecipeFlowHandles } from '@/components/graph/RecipeFlowHandles'
import { EveImage } from '@/components/EveImage'

function RecipeBlueprintNode({ data }: { data: RecipeBlueprintData }) {
  return (
    <div className="item-recipe-graph__node item-recipe-graph__node--blueprint relative h-full">
      <RecipeFlowHandles sourceHandles={data.sourceHandles} targetHandles={data.targetHandles} />
      <EveImage
        id={data.blueprintTypeId}
        variant="bp"
        productTypeId={data.productTypeId}
        size={28}
        framed
        alt=""
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-[11px] font-semibold leading-tight truncate flex-1" title={data.name}>
            {data.name}
          </p>
          <span className="badge badge-info badge-xs shrink-0 font-semibold">
            {data.isReaction ? 'Formula' : 'BPO'}
          </span>
        </div>
        <p className="text-xs tabular-nums font-medium text-base-content/75 mt-0.5">
          {formatGraphQuantity(1)}
        </p>
      </div>
    </div>
  )
}

function RecipeInputNode({ data }: { data: RecipeInputData }) {
  return (
    <div className="item-recipe-graph__node item-recipe-graph__node--input relative h-full">
      <RecipeFlowHandles sourceHandles={data.sourceHandles} targetHandles={data.targetHandles} />
      <EveImage id={data.typeId} variant="icon" size={28} framed alt="" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-tight truncate" title={data.name}>
          {data.name}
        </p>
        <p className="text-xs tabular-nums font-medium text-base-content/75 mt-0.5">
          {formatGraphQuantity(data.quantity)}
        </p>
      </div>
    </div>
  )
}

function RecipeOutputNode({ data }: { data: RecipeOutputData }) {
  return (
    <div className="item-recipe-graph__node item-recipe-graph__node--output relative h-full">
      <RecipeFlowHandles sourceHandles={data.sourceHandles} targetHandles={data.targetHandles} />
      <EveImage id={data.typeId} variant="icon" size={36} framed alt="" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight line-clamp-2" title={data.name}>
          {data.name}
        </p>
        <p className="text-[11px] tabular-nums text-base-content/70 mt-1">
          Produces {formatGraphQuantity(data.productQuantity)}
        </p>
        <p className="text-[11px] tabular-nums text-info/80 mt-0.5">
          {formatDuration(data.jobTimeSeconds)}
        </p>
      </div>
    </div>
  )
}

const nodeTypes = {
  recipeBlueprint: RecipeBlueprintNode,
  recipeInput: RecipeInputNode,
  recipeOutput: RecipeOutputNode,
}

const edgeDefaults: Partial<Edge> = {
  type: 'step',
  style: { strokeWidth: 1.25, stroke: '#64748b', opacity: 0.55 },
}

function RecipeGraphViewport({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!layoutKey) return

    let cancelled = false
    let frame2 = 0

    const fit = () => {
      if (!cancelled) {
        void fitView({ padding: 0.2, duration: 200 })
      }
    }

    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(fit)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame1)
      window.cancelAnimationFrame(frame2)
    }
  }, [layoutKey, fitView])

  return null
}

interface ItemRecipeGraphProps {
  blueprint: BlueprintInfo
  typeMap: Map<number, TypeInfo>
  productName: string
  className?: string
}

function ItemRecipeGraphCanvas({
  blueprint,
  typeMap,
  productName,
}: ItemRecipeGraphProps) {
  const navigate = useNavigate()
  const layout = useMemo(
    () => recipeToFlow(blueprint, typeMap, productName),
    [blueprint, typeMap, productName],
  )

  const graphHeight = useMemo(
    () => estimateRecipeGraphHeight(blueprint.materials.length),
    [blueprint.materials.length],
  )

  const layoutKey = useMemo(() => {
    const materialKey = blueprint.materials.map((mat) => `${mat.typeId}:${mat.quantity}`).join('|')
    return `${blueprint.productTypeId}:${materialKey}:${graphHeight}`
  }, [blueprint.productTypeId, blueprint.materials, graphHeight])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'recipeBlueprint') {
        const blueprintTypeId = (node.data as RecipeBlueprintData).blueprintTypeId
        navigate(`/item/${blueprintTypeId}`)
        return
      }
      if (node.type !== 'recipeInput') return
      const typeId = (node.data as RecipeInputData).typeId
      navigate(`/item/${typeId}`)
    },
    [navigate],
  )

  return (
    <div className="item-recipe-graph__shell">
      <p className="item-recipe-graph__hint">
        Drag to pan · scroll or pinch to zoom · click blueprint or inputs to open item
      </p>
      <div className="item-recipe-graph__canvas" style={{ height: graphHeight, minHeight: '15rem' }}>
        <ReactFlow
          key={layoutKey}
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          minZoom={0.35}
          maxZoom={1.75}
          defaultEdgeOptions={edgeDefaults}
          proOptions={{ hideAttribution: true }}
          className="h-full w-full"
        >
          <RecipeGraphViewport layoutKey={layoutKey} />
          <Background gap={20} size={1} color="rgba(148, 163, 184, 0.08)" />
        </ReactFlow>
      </div>
    </div>
  )
}

export function ItemRecipeGraph(props: ItemRecipeGraphProps) {
  return (
    <div className={props.className ? `item-recipe-graph ${props.className}` : 'item-recipe-graph'}>
      <ReactFlowProvider key={props.blueprint.productTypeId}>
        <ItemRecipeGraphCanvas {...props} />
      </ReactFlowProvider>
    </div>
  )
}
