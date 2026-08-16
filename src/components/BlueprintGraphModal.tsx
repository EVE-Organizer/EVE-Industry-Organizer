import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BlueprintInfo, GlobalSettings, ManufacturingSettings, RankedBlueprintRow, SupplyChainNode, TimeRange } from '@/types'
import { DEFAULT_SETTINGS, HUBS } from '@/types'
import { hubDisplayName } from '@/lib/hubDisplay'
import { useSdeData } from '@/hooks/useSdeData'
import {
  buildPriceMap,
  buildBuyPriceMap,
  buildTypeMap,
  getAllBlueprints,
  getHubMarket,
  resolveBuildSystem,
} from '@/services/data/sdeLoader'
import { buildWindowPriceMap } from '@/lib/ranking'
import {
  revenueFromSale,
  applyTE,
  applyReactionTime,
  reactionTimePerRun,
  blueprintMeTe,
  runsForJobTime,
  clampGraphRuns,
} from '@/lib/cost'
import { resolveReactionModifiers, resolveManufacturingModifiers } from '@/lib/facilityModifiers'
import { isReactionRecipe } from '@/lib/recipes'
import { buildSupplyChain, findBuildTargetDetails, type BuildTargetDetail } from '@/lib/supplyChain'
import { tierLabel } from '@/lib/blueprintGroups'
import { tradingFeeRates } from '@/lib/tradingFees'
import { skillLevel } from '@/lib/skillFields'
import { appRoute, productionGraphRoute } from '@/lib/paths'
import { withAlignedEdgeHandles } from '@/lib/graphHandles'
import { FlowHandles } from '@/components/graph/FlowHandles'
import { textLinkClass } from '@/lib/textLink'
import { formatGraphQuantity, formatGraphUnitIsk, formatDuration, formatIsk, formatPercent, formatDecimal } from '@/lib/profit'
import { CopyNameButton } from '@/components/CopyNameButton'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'

interface BlueprintGraphModalProps {
  blueprint: BlueprintInfo | null
  rankedRow?: RankedBlueprintRow | null
  buyHub: GlobalSettings['primaryHub']
  sellHub?: GlobalSettings['primaryHub']
  priceWindow?: TimeRange
  settings: ManufacturingSettings
  onClose: () => void
  onProductChange?: (productTypeId: number) => void
  /** Query string for share links when not on the graph page URL. */
  shareSearch?: string
  onOpenPage?: (productTypeId: number) => void
  variant?: 'modal' | 'page' | 'inline'
  /** Runs from an active manufacturing plan (supply chain / roots). */
  getPlanRuns?: (productTypeId: number) => number | undefined
}

type GraphVariant = NonNullable<BlueprintGraphModalProps['variant']>

function graphShareHref(productTypeId: number, search: string): string {
  const route = productionGraphRoute(productTypeId).replace(/^\//, '')
  return appRoute(search ? `${route}?${search}` : route)
}

function CopyLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.25 5.75h5.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-5.5A1.25 1.25 0 0 1 5 12.5v-5.5a1.25 1.25 0 0 1 1.25-1.25Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 10.25V4.75A1.25 1.25 0 0 1 5 3.5h5.5"
      />
    </svg>
  )
}

function MarketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeWidth="1.5" d="M2.5 12.5h11" />
      <path strokeLinecap="round" strokeWidth="1.5" d="M4.5 12.5V8" />
      <path strokeLinecap="round" strokeWidth="1.5" d="M8 12.5V4.5" />
      <path strokeLinecap="round" strokeWidth="1.5" d="M11.5 12.5V6.5" />
    </svg>
  )
}

function GraphHeaderTitle({
  productName,
  productTypeId,
  search = '',
  variant,
  onOpenPage,
}: {
  productName: string
  productTypeId: number
  search?: string
  variant: GraphVariant
  onOpenPage?: (productTypeId: number) => void
}) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const shareHref = useMemo(() => graphShareHref(productTypeId, search), [productTypeId, search])
  const displayName = productName || 'Production graph'

  const copy = useCallback(async () => {
    try {
      const url = variant === 'page' ? window.location.href : shareHref
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [variant, shareHref])

  const titleClass =
    'font-bold text-base sm:text-lg leading-tight truncate min-w-0'

  return (
    <div className="min-w-0 flex-1 flex items-center gap-1">
      <CopyNameButton text={displayName} />
      {variant === 'modal' && onOpenPage ? (
        <button
          type="button"
          className={`${titleClass} text-left ${textLinkClass('text-primary')}`}
          title={`Open ${displayName} on full page`}
          onClick={() => onOpenPage(productTypeId)}
        >
          {displayName}
        </button>
      ) : (
        <h3 className={titleClass} title={productName || undefined}>
          {displayName}
        </h3>
      )}
      <button
        type="button"
        className="btn btn-xs btn-ghost btn-square shrink-0"
        onClick={() => void copy()}
        title={copied ? 'Link copied' : 'Copy link'}
        aria-label={copied ? 'Link copied' : 'Copy link'}
      >
        <CopyLinkIcon className="size-3.5" />
      </button>
      <button
        type="button"
        className="btn btn-xs btn-ghost btn-square shrink-0"
        onClick={() => navigate(`/item/${productTypeId}`)}
        title="Open market page"
        aria-label="Open market page"
      >
        <MarketIcon className="size-3.5" />
      </button>
    </div>
  )
}

const WINDOW_LABELS: Record<TimeRange, string> = {
  '1d': '1-day',
  '1w': '1-week',
  '1m': '1-month',
  '1y': '1-year',
  all: 'all-time',
}

interface GraphPriceLabels {
  buyHubName: string
  sellHubName: string
  materialPrice: string
  outputPrice: string
  buildSystemName: string
  materialUnitLabel: string
  outputUnitLabel: string
}

const GraphPriceContext = createContext<GraphPriceLabels | null>(null)

interface GraphNavContextValue {
  openGraphForType: (typeId: number) => void
}

const GraphNavContext = createContext<GraphNavContextValue | null>(null)

type NodeInteraction = 'drag' | 'graph' | 'item'

function buildGraphPriceLabels(
  buyHub: GlobalSettings['primaryHub'],
  sellHub: GlobalSettings['primaryHub'],
  window: TimeRange,
  priceMethod: ManufacturingSettings['priceMethod'],
  buildSystemName: string,
): GraphPriceLabels {
  const buyHubName = hubDisplayName(buyHub)
  const sellHubName = hubDisplayName(sellHub)
  const windowLabel = WINDOW_LABELS[window]
  const materialPrice = `${windowLabel} avg sell`
  const outputPrice = priceMethod === 'buy_orders' ? 'Buy order' : `${windowLabel} avg sell`

  return {
    buyHubName,
    sellHubName,
    materialPrice,
    outputPrice,
    buildSystemName,
    materialUnitLabel: `${materialPrice} @ ${buyHubName}`,
    outputUnitLabel: `${outputPrice} @ ${sellHubName}`,
  }
}

function SourceChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span className="text-[11px] opacity-50">{label}</span>
      <span className="badge badge-sm border border-eve-border bg-base-300 font-semibold whitespace-nowrap px-2">
        {value}
      </span>
    </span>
  )
}

function GraphPriceSourceBar({ source }: { source: GraphPriceLabels }) {
  return (
    <div className="flex flex-nowrap items-center gap-x-2 gap-y-0 text-xs mb-3 shrink-0 min-w-0 overflow-x-auto scrollbar-thin">
      <span className="shrink-0 font-medium opacity-60">Data from</span>
      {source.buyHubName === source.sellHubName ? (
        <SourceChip label="Hub" value={source.buyHubName} />
      ) : (
        <>
          <SourceChip label="Buy" value={source.buyHubName} />
          <SourceChip label="Sell" value={source.sellHubName} />
        </>
      )}
      <SourceChip label="Materials" value={source.materialPrice} />
      <SourceChip label="Revenue" value={source.outputPrice} />
      <SourceChip label="Job cost" value={source.buildSystemName} />
      <span className="shrink-0 opacity-30 ml-1" aria-hidden>
        ·
      </span>
      <span className="shrink-0 opacity-40 whitespace-nowrap">hover · drag · click</span>
    </div>
  )
}

const COLUMN_GAP = 64
const ROW_GAP = 24
const MAX_DEPTH_TIER = 4

type NodeRole = 'root' | 'blueprint' | 'build' | 'react' | 'buy'

interface NodeSize {
  width: number
  height: number
}

/** Output node needs extra height for the financial summary block. */
const DEPTH_SIZES: NodeSize[] = [
  { width: 288, height: 244 },
  { width: 188, height: 76 },
  { width: 164, height: 66 },
  { width: 148, height: 60 },
  { width: 136, height: 54 },
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
    iconSize: 36,
    nameClass: 'text-sm font-semibold',
    metaClass: 'text-[11px]',
    badgeClass: 'badge-sm',
    padding: 'px-3 py-2.5',
    nameLines: 2,
  },
  {
    iconSize: 26,
    nameClass: 'text-[11px] font-semibold',
    metaClass: 'text-[9px]',
    badgeClass: 'badge-xs',
    padding: 'px-2 py-1.5',
    nameLines: 1,
  },
  {
    iconSize: 22,
    nameClass: 'text-[10px] font-medium',
    metaClass: 'text-[9px]',
    badgeClass: 'badge-xs',
    padding: 'px-1.5 py-1',
    nameLines: 1,
  },
  {
    iconSize: 20,
    nameClass: 'text-[10px] font-medium',
    metaClass: 'text-[8px]',
    badgeClass: 'badge-xs',
    padding: 'px-1.5 py-1',
    nameLines: 1,
  },
  {
    iconSize: 18,
    nameClass: 'text-[9px] font-medium',
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

const PADDING_Y_BY_TIER = [20, 12, 8, 8, 4]

function materialStatsLineCount(node: SupplyChainNode): number {
  const role = nodeRole(node)
  if (role === 'build' && node.savings != null && node.savings !== 0) return 3
  return 2
}

/** Size each node to fit name, total, qty line, and optional build footnote. */
function nodeContentHeight(node: SupplyChainNode, depth: number): number {
  const tier = depthTier(depth)
  if (tier === 0) return DEPTH_SIZES[0]!.height

  const visual = depthVisual(depth)
  const statsLines = materialStatsLineCount(node)
  const paddingY = PADDING_Y_BY_TIER[tier] ?? 8

  const nameLineH = tier === 1 ? 15 : 14
  const totalLineH = tier <= 1 ? 18 : 15
  const detailLineH = tier <= 1 ? 13 : 12
  const lineGap = 2

  let textH = nameLineH + totalLineH
  if (statsLines > 1) {
    textH += (statsLines - 1) * (detailLineH + lineGap)
  }

  const bodyH = Math.max(visual.iconSize, textH)
  return Math.max(depthSize(depth).height, paddingY + bodyH + 2)
}

function rowGapAtDepth(depth: number): number {
  if (depth >= 3) return 8
  if (depth >= 2) return 10
  if (depth >= 1) return 12
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
  outputSummary?: OutputSummary
  canOpenGraph?: boolean
  sourceHandles?: { id: string; top: string }[]
  targetHandles?: { id: string; top: string }[]
}

interface BuildTargetNodeData extends Record<string, unknown> {
  target: BuildTargetDetail
  sourceName: string
  sourceHandles?: { id: string; top: string }[]
  targetHandles?: { id: string; top: string }[]
}

const BUILD_TARGET_CARD_WIDTH = 208
const BUILD_TARGET_GAP = 12
const BUILD_TARGET_MAX = 15

function buildTargetCardHeight(): number {
  return 88
}

interface OutputSummary {
  runs: number
  productQuantity: number
  outputQty: number
  sellPrice: number
  grossRevenue: number
  netRevenue: number
  brokerFee: number
  salesTax: number
  setupCost: number
  materialCost: number
  bpoCost: number
  jobCost: number
  netProfit: number
  marginPercent: number
  buyFinishedCost: number
  jobTimeSeconds: number
}

function graphStructureTe(
  blueprint: BlueprintInfo,
  settings: ManufacturingSettings | GlobalSettings,
): number {
  const structure = isReactionRecipe(blueprint)
    ? resolveReactionModifiers(settings, blueprint)
    : resolveManufacturingModifiers(settings)
  return structure.teBonusPercent
}

function graphJobTimeSeconds(
  blueprint: BlueprintInfo,
  settings: ManufacturingSettings | GlobalSettings,
  runs: number,
): number {
  const structureTe = graphStructureTe(blueprint, settings)
  if (isReactionRecipe(blueprint)) {
    return applyReactionTime(
      blueprint.manufacturingTime,
      runs,
      skillLevel(settings.skills, 'reactions'),
      structureTe,
    )
  }
  const { te } = blueprintMeTe(blueprint.tier, settings, blueprint)
  return applyTE(
    blueprint.manufacturingTime,
    te,
    runs,
    skillLevel(settings.skills, 'industry'),
    skillLevel(settings.skills, 'advancedIndustry'),
    structureTe,
  )
}

function graphRunsFromJobTime(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  jobTimeSeconds: number,
): number {
  const structureTe = graphStructureTe(blueprint, settings)
  if (isReactionRecipe(blueprint)) {
    const perRun = reactionTimePerRun(
      blueprint.manufacturingTime,
      skillLevel(settings.skills, 'reactions'),
      structureTe,
    )
    if (perRun <= 0) return 1
    return Math.max(1, Math.floor(jobTimeSeconds / perRun))
  }
  const { te } = blueprintMeTe(blueprint.tier, settings, blueprint)
  return runsForJobTime(
    jobTimeSeconds,
    blueprint.manufacturingTime,
    te,
    skillLevel(settings.skills, 'industry'),
    skillLevel(settings.skills, 'advancedIndustry'),
    structureTe,
    { step: 1, maxRuns: null },
  )
}

function buildOutputSummary(
  root: SupplyChainNode,
  blueprint: BlueprintInfo,
  settings: ManufacturingSettings,
  sellPrices: Map<number, number>,
  buyPrices?: Map<number, number>,
): OutputSummary {
  const runs = settings.batchSize
  const productQuantity = blueprint.productQuantity
  const outputQty = root.quantity
  const sellPrice =
    settings.priceMethod === 'buy_orders'
      ? (buyPrices?.get(blueprint.productTypeId) ?? 0)
      : (sellPrices.get(blueprint.productTypeId) ?? root.unitPrice)

  const bpoChild = root.children?.find((c) => c.mode === 'blueprint')
  const materialChildren = root.children?.filter((c) => c.mode !== 'blueprint') ?? []
  const bpoCost = bpoChild?.totalCost ?? 0
  const materialCost = materialChildren.reduce((sum, child) => sum + child.totalCost, 0)
  const setupCost = root.totalCost
  const jobCost = Math.max(0, setupCost - bpoCost - materialCost)

  const feeRates = tradingFeeRates(
    skillLevel(settings.skills, 'accounting'),
    skillLevel(settings.skills, 'brokerRelations'),
  )
  const usesBuyOrders = settings.priceMethod === 'buy_orders'
  const { gross, net, brokerFee, salesTax } = revenueFromSale(sellPrice, outputQty, feeRates, {
    includeBrokerFee: !usesBuyOrders,
  })

  const netProfit = net - setupCost
  const marginPercent = setupCost > 0 ? (netProfit / setupCost) * 100 : 0
  const buyFinishedCost = root.buyCost ?? 0
  const jobTimeSeconds = graphJobTimeSeconds(blueprint, settings, runs)

  return {
    runs,
    productQuantity,
    outputQty,
    sellPrice,
    grossRevenue: gross,
    netRevenue: net,
    brokerFee,
    salesTax,
    setupCost,
    materialCost,
    bpoCost,
    jobCost,
    netProfit,
    marginPercent,
    buyFinishedCost,
    jobTimeSeconds,
  }
}

const edgeDefaults: Partial<Edge> = {
  type: 'step',
  style: { strokeWidth: 1.25, stroke: '#64748b', opacity: 0.65 },
}

function nodeRole(node: SupplyChainNode): NodeRole {
  if (node.depth === 0) return 'root'
  if (node.mode === 'blueprint') return 'blueprint'
  if (node.mode === 'react') return 'react'
  if (node.mode === 'build') return 'build'
  return 'buy'
}

function makeNode(node: SupplyChainNode, id: string, x: number, y: number, depth: number): Node {
  const height = nodeContentHeight(node, depth)
  const size = depthSize(depth)
  return {
    id,
    position: { x, y },
    data: nodeData(node),
    type: 'supplyNode',
    width: size.width,
    height,
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

    const ownHeight = nodeContentHeight(node, depth)
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
    const nodeHeight = nodeContentHeight(node, depth)
    const x = columnX.get(depth) ?? 0
    const band = measure(node, depth)

    nodes.push(makeNode(node, id, x, top + (band - nodeHeight) / 2, depth))

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

function attachBuildTargetNodes(
  nodes: Node[],
  edges: Edge[],
  targets: BuildTargetDetail[],
  sourceName: string,
): { nodes: Node[]; edges: Edge[] } {
  if (targets.length === 0) return { nodes, edges }

  const outputNode = nodes.find((n) => (n.data as SupplyNodeData).role === 'root')
  if (!outputNode) return { nodes, edges }

  const capped = targets.slice(0, BUILD_TARGET_MAX)
  const shift = BUILD_TARGET_CARD_WIDTH + COLUMN_GAP
  const shiftedNodes = nodes.map((n) => ({
    ...n,
    position: { x: n.position.x + shift, y: n.position.y },
  }))

  const shiftedOutput = shiftedNodes.find((n) => n.id === outputNode.id)!
  const outputHeight = shiftedOutput.height ?? depthSize(0).height
  const totalHeight =
    capped.length * buildTargetCardHeight() + BUILD_TARGET_GAP * Math.max(0, capped.length - 1)
  const outputCenterY = shiftedOutput.position.y + outputHeight / 2
  let cursorY = outputCenterY - totalHeight / 2

  const targetNodes: Node[] = []
  const targetEdges: Edge[] = []

  for (const target of capped) {
    const id = `build-target-${target.productTypeId}`
    const height = buildTargetCardHeight()
    targetNodes.push({
      id,
      type: 'buildTargetNode',
      position: { x: 0, y: cursorY },
      width: BUILD_TARGET_CARD_WIDTH,
      height,
      data: { target, sourceName },
      draggable: false,
      selectable: false,
    })
    targetEdges.push(makeEdge(id, outputNode.id))
    cursorY += height + BUILD_TARGET_GAP
  }

  return {
    nodes: [...shiftedNodes, ...targetNodes],
    edges: [...edges, ...targetEdges],
  }
}

function markNavigableNodes(
  nodes: Node[],
  blueprintByProduct: Map<number, BlueprintInfo>,
): Node[] {
  return nodes.map((node) => {
    if (node.type === 'buildTargetNode') return node

    const data = node.data as SupplyNodeData
    if (data.role === 'root' || data.role === 'blueprint') return node
    if (!blueprintByProduct.has(data.typeId)) return node

    return {
      ...node,
      draggable: false,
      selectable: false,
      data: { ...data, canOpenGraph: true },
    }
  })
}

const ROLE_STYLES: Record<NodeRole, { border: string; shell: string; accent: string }> = {
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
  react: {
    border: 'border-accent/35',
    shell: 'bg-base-200/95',
    accent: 'bg-accent',
  },
  blueprint: {
    border: 'border-info/35',
    shell: 'bg-base-200/95',
    accent: 'bg-info',
  },
  buy: {
    border: 'border-eve-border',
    shell: 'bg-base-200/95',
    accent: 'bg-warning',
  },
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
  react: {
    label: 'React',
    title: 'Run a reaction formula (cheaper than buying)',
    className: 'badge-accent font-semibold',
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

function graphQtyPriceLabels(data: SupplyNodeData): { qty: string; price: string } {
  const isBlueprint = data.role === 'blueprint'
  const qty = isBlueprint ? 'x1' : formatGraphQuantity(data.quantity)
  const price =
    data.unitPrice > 0 ? formatGraphUnitIsk(data.unitPrice) : formatGraphUnitIsk(data.totalCost)
  return { qty, price }
}

interface MaterialCardLines {
  qty: string
  unitPrice: string | null
  totalCost: string
  footnote: string | null
  footnoteAccent?: string
}

function materialCardLines(data: SupplyNodeData): MaterialCardLines {
  const isBlueprint = data.role === 'blueprint'
  const qty = isBlueprint ? 'x1' : formatGraphQuantity(data.quantity)
  const unitPrice = data.unitPrice > 0 ? formatGraphUnitIsk(data.unitPrice) : null
  const totalCost = formatIsk(data.totalCost)

  if (data.savings != null && data.savings !== 0) {
    const saving = data.savings > 0
    return {
      qty,
      unitPrice,
      totalCost,
      footnote: saving
        ? `save ${formatIsk(data.savings)} vs buy`
        : `+${formatIsk(Math.abs(data.savings))} vs buy`,
      footnoteAccent: saving ? 'text-success' : 'text-error',
    }
  }

  return { qty, unitPrice, totalCost, footnote: null }
}

function MaterialQtyLine({ lines, className = '' }: { lines: MaterialCardLines; className?: string }) {
  const unitPart = lines.unitPrice ? `@ ${lines.unitPrice}` : ''
  return (
    <p className={`tabular-nums opacity-55 leading-snug ${className}`}>
      {lines.qty}
      {unitPart ? ` ${unitPart}` : ''}
    </p>
  )
}

function OutputFinancials({
  summary,
  profitAccent,
  className = '',
}: {
  summary: OutputSummary
  profitAccent: string
  className?: string
}) {
  return (
    <div className={`shrink-0 rounded-md bg-base-300/50 px-2.5 py-2 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-wide font-semibold text-info leading-none">Job time</p>
          <p className="text-lg font-bold tabular-nums text-info leading-tight mt-1">
            {formatDuration(summary.jobTimeSeconds)}
          </p>
          <p className="text-[10px] tabular-nums opacity-50 mt-0.5 leading-tight">
            {summary.runs} runs × {summary.productQuantity}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] uppercase tracking-wide opacity-45 leading-none">Profit</p>
          <p className={`text-lg font-bold tabular-nums leading-tight mt-1 ${profitAccent}`}>
            {formatIsk(summary.netProfit)}
          </p>
          <p className={`text-[10px] tabular-nums mt-0.5 ${profitAccent} opacity-75`}>
            {formatPercent(summary.marginPercent)} margin
          </p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-base-content/10 flex items-baseline justify-between gap-2 text-[10px] tabular-nums opacity-60">
        <span>
          Rev <span className="font-medium text-base-content/75">{formatIsk(summary.netRevenue)}</span>
        </span>
        <span>
          Setup <span className="font-medium text-base-content/75">{formatIsk(summary.setupCost)}</span>
        </span>
      </div>
    </div>
  )
}

function MaterialCardStats({
  lines,
  compact = false,
  className = '',
}: {
  lines: MaterialCardLines
  compact?: boolean
  className?: string
}) {
  if (compact) {
    const unitPart = lines.unitPrice ? ` @ ${lines.unitPrice}` : ''
    return (
      <div className={`min-w-0 ${className}`}>
        <p className="tabular-nums font-bold text-sm text-base-content leading-tight">{lines.totalCost}</p>
        <p className="tabular-nums opacity-50 mt-0.5 leading-tight">
          {lines.qty}
          {unitPart}
        </p>
        {lines.footnote && (
          <p
            className={`tabular-nums mt-0.5 leading-tight ${lines.footnoteAccent ?? 'opacity-50'}`}
            title={lines.footnote}
          >
            {lines.footnote}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`min-w-0 mt-auto ${className}`}>
      <p className="tabular-nums leading-none font-bold text-sm text-base-content">{lines.totalCost}</p>
      <MaterialQtyLine lines={lines} className="mt-0.5 text-[10px]" />
      {lines.footnote && (
        <p className={`tabular-nums mt-0.5 text-[9px] ${lines.footnoteAccent ?? 'opacity-50'}`}>
          {lines.footnote}
        </p>
      )}
    </div>
  )
}

function GraphViewportSync({
  productTypeId,
  nodeCount,
}: {
  productTypeId: number
  nodeCount: number
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (nodeCount === 0) return

    const fit = () => {
      void fitView({ padding: 0.15, duration: 0 })
    }

    const frame = window.requestAnimationFrame(fit)
    return () => window.cancelAnimationFrame(frame)
  }, [productTypeId, nodeCount, fitView])

  return null
}

function BuildTargetDetailCard({
  data,
}: {
  data: BuildTargetNodeData
}) {
  const { target, sourceName } = data

  return (
    <div className="w-72 rounded-xl border border-eve-border bg-neutral text-neutral-content shadow-xl p-3.5 text-xs leading-relaxed">
      <div className="flex items-start gap-2 mb-2">
        <EveImage id={target.productTypeId} variant="icon" size={32} framed alt="" />
        <div className="min-w-0">
          <p className="font-semibold text-sm break-words">{target.productName}</p>
          <span className="badge badge-secondary badge-xs mt-1">{tierLabel(target.blueprint.tier)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <DetailRow
          label="Uses this item"
          value={`${formatGraphQuantity(target.sourceInputQty)} per run`}
        />
        <DetailRow
          label="Output"
          value={`${formatGraphQuantity(target.outputQty)} per run`}
        />
        <DetailRow label="Job time" value={formatDuration(target.jobTimeSeconds)} />
        <div className="border-t border-neutral-content/15 my-1" />
        <p className="text-[10px] uppercase tracking-wide opacity-50">Other materials per run</p>
        {target.otherMaterials.length === 0 ? (
          <p className="opacity-60">None</p>
        ) : (
          target.otherMaterials.map((mat) => (
            <DetailRow
              key={mat.typeId}
              label={mat.name}
              value={formatGraphQuantity(mat.quantity)}
            />
          ))
        )}
        <p className="opacity-50 text-[10px] mt-1">
          Recipe for one run. {formatGraphQuantity(target.sourceInputQty)} {sourceName} required.
        </p>
      </div>
    </div>
  )
}

function BuildTargetNode({ data }: { data: BuildTargetNodeData }) {
  const nav = useContext(GraphNavContext)
  const { ref, cardStyle, showCard, hideCard } = useHoverCard()
  const { target, sourceName } = data

  return (
    <>
      <GraphNodeShell
        shellRef={ref}
        borderClass="border-secondary/40"
        shellClass="bg-base-200/95"
        accentClass="bg-secondary"
        paddingClass="px-2 py-2"
        interaction="graph"
        onActivate={() => nav?.openGraphForType(target.productTypeId)}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        onMouseDown={hideCard}
      >
        <FlowHandles sourceHandles={data.sourceHandles} targetHandles={data.targetHandles} />
        <div className="flex gap-2 h-full min-h-0 overflow-hidden">
          <EveImage
            id={target.productTypeId}
            variant="icon"
            size={28}
            framed
            alt=""
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 flex flex-col gap-1 overflow-hidden">
            <div className="min-w-0 shrink-0 flex items-start gap-0.5">
              <CopyNameButton
                text={target.productName}
                className="h-5 w-5"
                iconClassName="size-2.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight line-clamp-2" title={target.productName}>
                  {target.productName}
                </p>
                <span className="badge badge-secondary badge-xs mt-0.5">{tierLabel(target.blueprint.tier)}</span>
              </div>
            </div>
            <div className="text-[10px] tabular-nums leading-snug opacity-70 min-h-0">
              <p>
                <span className="font-medium text-base-content">{formatGraphQuantity(target.sourceInputQty)}</span>
                {' × '}
                <span className="truncate">{sourceName}</span>
              </p>
              <p>
                → <span className="font-medium text-base-content">{formatGraphQuantity(target.outputQty)}</span>
                <span className="opacity-70"> per run</span>
              </p>
              <p className="text-info font-medium">{formatDuration(target.jobTimeSeconds)}</p>
            </div>
          </div>
        </div>
      </GraphNodeShell>
      {cardStyle &&
        createPortal(
          <div className="pointer-events-none fixed z-[9999]" style={cardStyle}>
            <BuildTargetDetailCard data={data} />
          </div>,
          document.body,
        )}
    </>
  )
}

function GraphQtyPriceLine({
  qty,
  price,
  className = '',
}: {
  qty: string
  price: string
  className?: string
}) {
  return (
    <p className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0 min-w-0 leading-snug ${className}`}>
      <span className="tabular-nums opacity-60">{qty}</span>
      <span className="tabular-nums font-medium text-base-content/85">{price}</span>
    </p>
  )
}

function GraphNodeShell({
  borderClass,
  shellClass,
  accentClass,
  paddingClass,
  className = '',
  interaction = 'drag',
  onActivate,
  children,
  shellRef,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
}: {
  borderClass: string
  shellClass: string
  accentClass: string
  paddingClass?: string
  className?: string
  interaction?: NodeInteraction
  onActivate?: () => void
  children: ReactNode
  shellRef?: Ref<HTMLDivElement>
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onMouseDown?: () => void
}) {
  const cursorClass =
    interaction === 'graph' || interaction === 'item'
      ? 'cursor-pointer'
      : 'cursor-grab active:cursor-grabbing'

  const baseClass = interaction === 'graph' ? 'ring-1 ring-secondary/25' : ''

  const hoverClass =
    interaction === 'graph'
      ? 'hover:ring-2 hover:ring-secondary/70 hover:shadow-lg hover:shadow-secondary/20 hover:border-secondary/55'
      : 'hover:shadow-lg hover:border-primary/50'

  const handleClick = (event: React.MouseEvent) => {
    if (interaction !== 'graph' && interaction !== 'item') return
    event.stopPropagation()
    onActivate?.()
  }

  return (
    <div
      ref={shellRef}
      role={interaction === 'graph' || interaction === 'item' ? 'button' : undefined}
      tabIndex={interaction === 'graph' || interaction === 'item' ? 0 : undefined}
      className={`group relative h-full w-full overflow-hidden rounded-xl border shadow-sm ${cursorClass} ${baseClass} ${hoverClass} ${borderClass} ${shellClass} ${paddingClass ?? ''} ${className}`}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (interaction !== 'graph' && interaction !== 'item') return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onActivate?.()
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      {interaction === 'graph' ? (
        <span className="pointer-events-none absolute top-1 right-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-secondary text-secondary-content opacity-0 group-hover:opacity-100 shadow-sm">
          View graph
        </span>
      ) : null}
      <div className={`absolute inset-y-0 left-0 w-0.5 ${accentClass}`} aria-hidden />
      <div className="relative h-full pl-0.5">{children}</div>
    </div>
  )
}

function OutputDetailCard({ data, summary }: { data: SupplyNodeData; summary: OutputSummary }) {
  const priceLabels = useContext(GraphPriceContext)
  const qty = formatGraphQuantity(summary.outputQty)
  const price = formatGraphUnitIsk(summary.sellPrice)
  const profitAccent = summary.netProfit >= 0 ? 'text-success' : 'text-error'

  return (
    <div className="w-72 rounded-xl border border-eve-border bg-neutral text-neutral-content shadow-xl p-3.5 text-xs leading-relaxed">
      <p className="font-semibold text-sm break-words">{data.label}</p>
      <GraphRoleBadge role="root" className="mt-1 mb-2" />
      <GraphQtyPriceLine
        qty={qty}
        price={price}
        className="text-sm mb-2 [&_span:last-child]:text-neutral-content"
      />
      {priceLabels ? (
        <p className="text-[10px] opacity-50 mb-2 leading-snug">{priceLabels.outputUnitLabel}</p>
      ) : null}
      <div className="flex flex-col gap-1">
        <DetailRow
          label="Batch"
          value={`${summary.runs} runs × ${summary.productQuantity}`}
        />
        <DetailRow label="Output" value={formatGraphQuantity(summary.outputQty)} />
        <DetailRow
          label="Job time"
          value={formatDuration(summary.jobTimeSeconds)}
          accent="text-info font-semibold"
        />
        <div className="border-t border-neutral-content/15 my-1" />
        <DetailRow label="Gross revenue" value={formatIsk(summary.grossRevenue)} />
        {summary.brokerFee > 0 && (
          <DetailRow label="Broker fee" value={`−${formatIsk(summary.brokerFee)}`} />
        )}
        <DetailRow label="Sales tax" value={`−${formatIsk(summary.salesTax)}`} />
        <DetailRow label="Net revenue" value={formatIsk(summary.netRevenue)} />
        <div className="border-t border-neutral-content/15 my-1" />
        <DetailRow label="Materials" value={formatIsk(summary.materialCost)} />
        <DetailRow label="BPO" value={formatIsk(summary.bpoCost)} />
        <DetailRow label="Job cost" value={formatIsk(summary.jobCost)} />
        <DetailRow label="Setup cost" value={formatIsk(summary.setupCost)} />
        <div className="border-t border-neutral-content/15 my-1" />
        <DetailRow
          label="Net profit"
          value={formatIsk(summary.netProfit)}
          accent={profitAccent}
        />
        <DetailRow
          label="Margin"
          value={formatPercent(summary.marginPercent)}
          accent={profitAccent}
        />
        <DetailRow label="Buy finished" value={formatIsk(summary.buyFinishedCost)} />
      </div>
      <p className="opacity-50 mt-2 text-[10px]">Click to open item detail</p>
    </div>
  )
}

function NodeDetailCard({ data }: { data: SupplyNodeData }) {
  const priceLabels = useContext(GraphPriceContext)
  const lines = materialCardLines(data)
  const hasComparison = data.buildCost != null && data.buyCost != null

  return (
    <div className="w-64 rounded-xl border border-eve-border bg-neutral text-neutral-content shadow-xl p-3.5 text-xs leading-relaxed">
      <p className="font-semibold text-sm break-words">{data.label}</p>
      <GraphRoleBadge role={data.role} className="mt-1 mb-2" />
      <div className="flex flex-col gap-1 mb-1">
        <DetailRow label="Quantity" value={lines.qty} />
        {lines.unitPrice && <DetailRow label="Unit price" value={lines.unitPrice} />}
        {lines.unitPrice && priceLabels ? (
          <p className="text-[10px] opacity-50 -mt-0.5 mb-1 leading-snug pl-0.5">
            {priceLabels.materialUnitLabel}
          </p>
        ) : null}
        <DetailRow label="Line total" value={lines.totalCost} />
      </div>
      {hasComparison && (
        <div className="flex flex-col gap-1">
          <div className="border-t border-neutral-content/15 my-1" />
          <DetailRow label="Buy from market" value={formatIsk(data.buyCost!)} />
          <DetailRow label="Build sub-chain" value={formatIsk(data.buildCost!)} />
          {data.savings != null && (
            <DetailRow
              label={data.savings >= 0 ? 'Build saves' : 'Build costs more'}
              value={formatIsk(Math.abs(data.savings))}
              accent={data.savings >= 0 ? 'text-success' : 'text-error'}
            />
          )}
        </div>
      )}
      <p className="opacity-50 mt-2 text-[10px]">
        {data.canOpenGraph ? 'Click to open production graph' : 'Click to open item detail'}
      </p>
    </div>
  )
}

function useHoverCard() {
  const ref = useRef<HTMLDivElement>(null)
  const [cardStyle, setCardStyle] = useState<CSSProperties | null>(null)

  const showCard = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const flipLeft = rect.right + 300 > window.innerWidth
    setCardStyle(
      flipLeft
        ? { top: rect.top, left: rect.left - 8, transform: 'translateX(-100%)' }
        : { top: rect.top, left: rect.right + 8 },
    )
  }, [])

  const hideCard = useCallback(() => setCardStyle(null), [])

  return { ref, cardStyle, showCard, hideCard }
}

function OutputNode({ data }: { data: SupplyNodeData }) {
  const priceLabels = useContext(GraphPriceContext)
  const summary = data.outputSummary
  const { ref, cardStyle, showCard, hideCard } = useHoverCard()
  const { qty, price } = summary
    ? {
        qty: formatGraphQuantity(summary.outputQty),
        price: formatGraphUnitIsk(summary.sellPrice),
      }
    : graphQtyPriceLabels(data)
  const roleStyle = ROLE_STYLES.root
  const profitAccent = summary && summary.netProfit >= 0 ? 'text-success' : 'text-error'

  return (
    <>
      <GraphNodeShell
        shellRef={ref}
        borderClass={roleStyle.border}
        shellClass={roleStyle.shell}
        accentClass={roleStyle.accent}
        paddingClass="px-3 py-2.5"
        interaction="drag"
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        onMouseDown={hideCard}
      >
        <FlowHandles sourceHandles={data.sourceHandles} targetHandles={data.targetHandles} />
        <div className="flex gap-2.5 h-full min-h-0 overflow-hidden">
          <EveImage
            id={data.typeId}
            variant="icon"
            size={36}
            framed
            alt=""
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 flex h-full min-h-0 flex-col gap-1.5 overflow-hidden">
            <div className="shrink-0 min-w-0">
              <p className="text-sm font-semibold leading-tight line-clamp-2" title={data.label}>
                {data.label}
              </p>
              <GraphRoleBadge role="root" sizeClass="badge-xs" className="mt-1" />
            </div>
            {summary && (
              <div className="shrink-0 text-[10px] tabular-nums opacity-50 leading-tight">
                <GraphQtyPriceLine qty={qty} price={price} />
                {priceLabels ? (
                  <p className="opacity-80 truncate" title={priceLabels.outputUnitLabel}>
                    {priceLabels.outputUnitLabel}
                  </p>
                ) : null}
              </div>
            )}
            {summary && (
              <OutputFinancials
                summary={summary}
                profitAccent={profitAccent ?? ''}
                className="mt-auto"
              />
            )}
          </div>
        </div>
      </GraphNodeShell>
      {cardStyle &&
        summary &&
        createPortal(
          <div className="pointer-events-none fixed z-[9999]" style={cardStyle}>
            <OutputDetailCard data={data} summary={summary} />
          </div>,
          document.body,
        )}
    </>
  )
}

function SupplyNode({ data }: { data: SupplyNodeData }) {
  const nav = useContext(GraphNavContext)
  const { ref, cardStyle, showCard, hideCard } = useHoverCard()
  const isBlueprint = data.role === 'blueprint'
  const roleStyle = ROLE_STYLES[data.role]
  const visual = depthVisual(data.depth)
  const lines = materialCardLines(data)
  const compactStats = data.depth >= 1

  return (
    <>
      <GraphNodeShell
        shellRef={ref}
        borderClass={roleStyle.border}
        shellClass={roleStyle.shell}
        accentClass={roleStyle.accent}
        paddingClass={visual.padding}
        interaction={data.canOpenGraph ? 'graph' : 'drag'}
        onActivate={data.canOpenGraph ? () => nav?.openGraphForType(data.typeId) : undefined}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        onMouseDown={hideCard}
      >
        <FlowHandles sourceHandles={data.sourceHandles} targetHandles={data.targetHandles} />
        <div className="flex gap-1.5 h-full items-start py-px">
          <EveImage
            id={data.typeId}
            variant={isBlueprint ? 'bp' : 'icon'}
            productTypeId={data.productTypeId}
            size={visual.iconSize}
            framed
            alt=""
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-0.5 min-w-0">
              {data.canOpenGraph ? (
                <CopyNameButton
                  text={data.label}
                  className="h-5 w-5"
                  iconClassName="size-2.5"
                />
              ) : null}
              <p
                className={`${visual.nameClass} leading-tight min-w-0 flex-1 truncate`}
                title={data.label}
              >
                {data.label}
              </p>
              <GraphRoleBadge
                role={data.role}
                sizeClass={visual.badgeClass}
                className="shrink-0 mt-0"
              />
            </div>
            <MaterialCardStats
              lines={lines}
              compact={compactStats}
              className={visual.metaClass}
            />
          </div>
        </div>
      </GraphNodeShell>
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

const nodeTypes = { supplyNode: SupplyNode, outputNode: OutputNode, buildTargetNode: BuildTargetNode }

function attachOutputSummary(
  nodes: Node[],
  root: SupplyChainNode,
  blueprint: BlueprintInfo,
  settings: ManufacturingSettings,
  sellPrices: Map<number, number>,
  buyPrices?: Map<number, number>,
): Node[] {
  const summary = buildOutputSummary(root, blueprint, settings, sellPrices, buyPrices)
  return nodes.map((node) => {
    if ((node.data as SupplyNodeData).role !== 'root') return node
    return {
      ...node,
      type: 'outputNode',
      data: { ...(node.data as SupplyNodeData), outputSummary: summary },
    }
  })
}

function GraphFlowCanvas({
  flowNodes,
  flowEdges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  productTypeId,
}: {
  flowNodes: Node[]
  flowEdges: Edge[]
  onNodesChange: OnNodesChange<Node>
  onEdgesChange: OnEdgesChange<Edge>
  onNodeClick: (_: React.MouseEvent, node: Node) => void
  productTypeId: number
}) {
  return (
    <div className="absolute inset-0">
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
        zoomOnPinch
        zoomOnScroll={false}
        selectionOnDrag={false}
        defaultEdgeOptions={edgeDefaults}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
      >
        <GraphViewportSync productTypeId={productTypeId} nodeCount={flowNodes.length} />
        <Background />
      </ReactFlow>
    </div>
  )
}

function GraphNumberField({
  label,
  tooltip,
  displayValue,
  onCommit,
  min,
  step,
  adornment,
}: {
  label: string
  tooltip: string
  displayValue: string
  onCommit: (parsed: number) => void
  min?: number
  step?: number
  adornment?: ReactNode
}) {
  const [text, setText] = useState(displayValue)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(displayValue)
  }, [displayValue, editing])

  const commit = useCallback(() => {
    const trimmed = text.trim()
    if (trimmed === '') {
      setText(displayValue)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setText(displayValue)
      return
    }
    onCommit(parsed)
  }, [text, displayValue, onCommit])

  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold opacity-50">
        {label}
        <InfoTooltip text={tooltip} placement="top" />
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <input
          type="number"
          min={min}
          step={step}
          className="input input-bordered input-sm h-9 sm:h-8 w-full min-w-0 max-w-[5.5rem] tabular-nums px-2.5"
          value={text}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false)
            commit()
          }}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          aria-label={label}
        />
        {adornment}
      </div>
    </label>
  )
}

function GraphProductionControls({
  blueprint,
  settings,
  runs,
  jobTimeSeconds,
  onRunsChange,
  onJobTimeChange,
}: {
  blueprint: BlueprintInfo
  settings: ManufacturingSettings
  runs: number
  jobTimeSeconds: number
  onRunsChange: (runs: number) => void
  onJobTimeChange: (jobTimeSeconds: number) => void
}) {
  const perRunSeconds = graphJobTimeSeconds(blueprint, settings, 1)
  const jobHours = jobTimeSeconds / 3600
  const outputQty = blueprint.productQuantity * runs

  return (
    <section
      className="rounded-lg border border-eve-border bg-base-200/50 px-3 py-2.5 mb-3 shrink-0 min-w-0"
      aria-label="Production batch controls"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:items-end sm:gap-4">
        <GraphNumberField
          label="Runs"
          tooltip="Manufacturing runs. Materials, setup cost, and profit scale with runs."
          displayValue={String(runs)}
          min={10}
          step={1}
          onCommit={(value) => onRunsChange(clampGraphRuns(value))}
        />
        <GraphNumberField
          label="Job time (hr)"
          tooltip={
            isReactionRecipe(blueprint)
              ? 'Total reaction duration. Reactions skill and structure TE set time per run.'
              : 'Total job duration. TE, structure rigs, and Advanced Industry set time per run.'
          }
          displayValue={formatDecimal(jobHours, 2)}
          min={0}
          step={0.01}
          onCommit={(hours) => {
            if (hours < 0) return
            onJobTimeChange(hours * 3600)
          }}
          adornment={
            <span className="hidden sm:inline-flex badge badge-sm border border-primary/30 bg-primary/10 text-primary font-semibold tabular-nums whitespace-nowrap shrink-0">
              {formatDuration(jobTimeSeconds)}
            </span>
          }
        />
        <div className="col-span-2 sm:col-span-1 sm:ml-auto sm:max-w-[14rem] min-w-0 border-t border-eve-border/50 pt-2.5 sm:border-t-0 sm:pt-0 sm:text-right">
          <p className="text-[11px] tabular-nums leading-snug sm:hidden text-primary font-medium mb-1">
            {formatDuration(jobTimeSeconds)} total
          </p>
          <p className="text-[11px] tabular-nums leading-snug">
            <span className="font-medium text-base-content/85">
              {runs} × {blueprint.productQuantity}
            </span>
            <span className="opacity-50"> = {formatGraphQuantity(outputQty)}</span>
          </p>
          <p className="text-[10px] tabular-nums opacity-50 mt-0.5">
            {formatDuration(perRunSeconds)} per run
          </p>
        </div>
      </div>
    </section>
  )
}

export function BlueprintGraphModal({
  blueprint,
  rankedRow: _rankedRow,
  buyHub,
  sellHub: sellHubProp,
  priceWindow = DEFAULT_SETTINGS.priceWindow,
  settings,
  onClose,
  onProductChange,
  shareSearch = '',
  onOpenPage,
  variant = 'modal',
  getPlanRuns,
}: BlueprintGraphModalProps) {
  const sellHub = sellHubProp ?? buyHub
  const { data: sde } = useSdeData()
  const [activeBlueprint, setActiveBlueprint] = useState(blueprint)
  const entryProductTypeIdRef = useRef(blueprint?.productTypeId)

  useEffect(() => {
    if (blueprint) {
      setActiveBlueprint(blueprint)
    }
  }, [blueprint?.productTypeId, blueprint])

  const resolveGraphRuns = useCallback(
    (productTypeId: number | undefined): number => {
      if (productTypeId != null) {
        const planRuns = getPlanRuns?.(productTypeId)
        if (planRuns != null && planRuns > 0) return planRuns
      }
      return settings.batchSize
    },
    [getPlanRuns, settings.batchSize],
  )

  const [graphRuns, setGraphRuns] = useState(() => resolveGraphRuns(blueprint?.productTypeId))

  useEffect(() => {
    setGraphRuns(resolveGraphRuns(activeBlueprint?.productTypeId))
  }, [activeBlueprint?.productTypeId, resolveGraphRuns])

  const graphSettings = useMemo(
    (): ManufacturingSettings => ({
      ...settings,
      batchSize: graphRuns,
    }),
    [settings, graphRuns],
  )

  const graphJobTiming = useMemo(() => {
    if (!activeBlueprint) return { jobTimeSeconds: 0 }
    return { jobTimeSeconds: graphJobTimeSeconds(activeBlueprint, settings, graphRuns) }
  }, [activeBlueprint, settings, graphRuns])

  const handleRunsChange = useCallback((runs: number) => {
    setGraphRuns(clampGraphRuns(runs))
  }, [])

  const handleJobTimeChange = useCallback(
    (jobTimeSeconds: number) => {
      if (!activeBlueprint) return
      setGraphRuns(clampGraphRuns(graphRunsFromJobTime(activeBlueprint, settings, jobTimeSeconds)))
    },
    [activeBlueprint, settings],
  )

  const activeProductName = useMemo(() => {
    if (!sde || !activeBlueprint) return ''
    return buildTypeMap(sde.types).get(activeBlueprint.productTypeId)?.name ?? ''
  }, [sde, activeBlueprint])

  const canGoBack =
    Boolean(activeBlueprint) &&
    entryProductTypeIdRef.current != null &&
    activeBlueprint!.productTypeId !== entryProductTypeIdRef.current

  const navigateToBlueprint = useCallback(
    (bp: BlueprintInfo) => {
      if (bp.productTypeId === activeBlueprint?.productTypeId) return
      setActiveBlueprint(bp)
      onProductChange?.(bp.productTypeId)
    },
    [activeBlueprint?.productTypeId, onProductChange],
  )

  const blueprintByProduct = useMemo(() => {
    if (!sde) return new Map<number, BlueprintInfo>()
    const map = new Map<number, BlueprintInfo>()
    for (const bp of getAllBlueprints(sde.registry)) {
      map.set(bp.productTypeId, bp)
    }
    return map
  }, [sde])

  const goBack = useCallback(() => {
    if (!canGoBack) return
    const entryId = entryProductTypeIdRef.current
    const entry = entryId != null ? blueprintByProduct.get(entryId) : undefined
    if (entry) navigateToBlueprint(entry)
  }, [canGoBack, blueprintByProduct, navigateToBlueprint])

  const openGraphForType = useCallback(
    (typeId: number) => {
      const bp = blueprintByProduct.get(typeId)
      if (bp) navigateToBlueprint(bp)
    },
    [blueprintByProduct, navigateToBlueprint],
  )

  const graphNav = useMemo(
    (): GraphNavContextValue => ({ openGraphForType }),
    [openGraphForType],
  )

  const priceLabels = useMemo(() => {
    if (!sde) return null
    const buyHubMarket = getHubMarket(sde.market, buyHub)
    if (!buyHubMarket) return null
    const { buildSystemId } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      buyHubMarket,
      settings.manufacturingSystemId,
    )
    const hubConfig = HUBS.find((h) => h.id === buyHub)
    const buildSystemName =
      sde.systems.find((s) => s.systemId === buildSystemId)?.name ??
      hubConfig?.buildSystemName ??
      'hub default'
    return buildGraphPriceLabels(
      buyHub,
      sellHub,
      priceWindow,
      settings.priceMethod,
      buildSystemName,
    )
  }, [sde, buyHub, sellHub, priceWindow, settings.manufacturingSystemId, settings.priceMethod])

  const layout = useMemo(() => {
    if (!sde || !activeBlueprint) return { nodes: [], edges: [] }
    const buyHubMarket = getHubMarket(sde.market, buyHub)
    if (!buyHubMarket) return { nodes: [], edges: [] }
    const sellHubMarket = getHubMarket(sde.market, sellHub) ?? buyHubMarket

    const reactionSystemId =
      settings.reactionFacility?.reactionSystemId ?? settings.manufacturingSystemId
    const { costIndex } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      buyHubMarket,
      settings.manufacturingSystemId,
    )
    const { reactionCostIndex: reactionIndexForSystem } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      buyHubMarket,
      reactionSystemId,
    )

    const typeMap = buildTypeMap(sde.types)
    const spotPrices = buildPriceMap(buyHubMarket)
    const buyPrices = buildBuyPriceMap(sellHubMarket)
    const prices = buildWindowPriceMap(buyHubMarket, priceWindow, spotPrices)
    const sellSpotPrices = buildPriceMap(sellHubMarket)
    const sellPrices = buildWindowPriceMap(sellHubMarket, priceWindow, sellSpotPrices)
    const allBlueprints = getAllBlueprints(sde.registry)
    const buildTargets = findBuildTargetDetails(
      allBlueprints,
      activeBlueprint.productTypeId,
      typeMap,
    )
    const sourceName = typeMap.get(activeBlueprint.productTypeId)?.name ?? 'this item'
    const { me } = blueprintMeTe(activeBlueprint.tier, settings, activeBlueprint)
    const chain = buildSupplyChain(
      activeBlueprint,
      allBlueprints,
      typeMap,
      prices,
      graphSettings,
      me,
      costIndex,
      0,
      10,
      new Map(),
      reactionIndexForSystem,
    )
    const flow = chainToFlow(chain)
    const withSummary = attachOutputSummary(
      flow.nodes,
      chain,
      activeBlueprint,
      graphSettings,
      sellPrices,
      buyPrices,
    )
    const withTargets = attachBuildTargetNodes(withSummary, flow.edges, buildTargets, sourceName)
    const aligned = withAlignedEdgeHandles(withTargets.nodes, withTargets.edges)
    return {
      nodes: markNavigableNodes(aligned.nodes, blueprintByProduct),
      edges: aligned.edges,
    }
  }, [sde, activeBlueprint, buyHub, sellHub, priceWindow, graphSettings, settings, blueprintByProduct])

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(layout.nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    setFlowNodes(layout.nodes)
    setFlowEdges(layout.edges)
  }, [layout, setFlowNodes, setFlowEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'buildTargetNode') return
    const data = node.data as SupplyNodeData
    if (data.canOpenGraph) return
    if (!data.typeId) return
    window.open(appRoute(`item/${data.typeId}`), '_blank', 'noopener,noreferrer')
  }, [])

  if (!activeBlueprint) return null

  const shellClassName =
    variant === 'page'
      ? 'flex flex-col flex-1 w-full min-h-[calc(100dvh-11rem)] lg:min-h-0'
      : variant === 'inline'
        ? 'flex flex-col w-full min-h-0'
        : 'flex flex-col h-full min-h-0'

  const graphCanvasClassName =
    variant === 'inline'
      ? 'relative h-[min(28rem,50vh)] min-h-[18rem] sm:min-h-[22rem] border border-eve-border rounded-lg overflow-hidden bg-base-300/20'
      : 'relative flex-1 min-h-0 min-h-[16rem] sm:min-h-[20rem] border border-eve-border rounded-lg overflow-hidden bg-base-300/20'

  const graphPanel = (
    <div className={shellClassName}>
      {variant === 'inline' ? (
        canGoBack ? (
          <header className="flex items-center gap-2 mb-2 shrink-0 min-w-0">
            <button type="button" className="btn btn-xs btn-ghost shrink-0" onClick={goBack}>
              ← Back
            </button>
            <p className="text-sm font-semibold truncate min-w-0" title={activeProductName}>
              {activeProductName}
            </p>
          </header>
        ) : null
      ) : (
        <header className="flex items-start justify-between gap-2 mb-2 shrink-0 min-w-0">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {canGoBack ? (
              <button type="button" className="btn btn-xs btn-ghost shrink-0 mt-0.5" onClick={goBack}>
                ← Back
              </button>
            ) : null}
            <GraphHeaderTitle
              productName={activeProductName}
              productTypeId={activeBlueprint.productTypeId}
              search={shareSearch}
              variant={variant}
              onOpenPage={onOpenPage}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              onClick={onClose}
              aria-label="Close production graph"
            >
              ✕
            </button>
          </div>
        </header>
      )}
      {priceLabels ? <GraphPriceSourceBar source={priceLabels} /> : null}
      <GraphProductionControls
        blueprint={activeBlueprint}
        settings={settings}
        runs={graphRuns}
        jobTimeSeconds={graphJobTiming.jobTimeSeconds}
        onRunsChange={handleRunsChange}
        onJobTimeChange={handleJobTimeChange}
      />
      <div className={graphCanvasClassName}>
        {flowNodes.length > 0 ? (
          <GraphPriceContext.Provider value={priceLabels}>
            <GraphNavContext.Provider value={graphNav}>
              <ReactFlowProvider>
                <GraphFlowCanvas
                  flowNodes={flowNodes}
                  flowEdges={flowEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  productTypeId={activeBlueprint.productTypeId}
                />
              </ReactFlowProvider>
            </GraphNavContext.Provider>
          </GraphPriceContext.Provider>
        ) : (
          <div className="flex items-center justify-center h-full text-sm opacity-60">
            No supply chain data available.
          </div>
        )}
      </div>
    </div>
  )

  if (variant === 'page' || variant === 'inline') {
    return graphPanel
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-5xl h-[100dvh] max-h-[100dvh] sm:h-[80vh] sm:max-h-[calc(100dvh-2rem)] rounded-none sm:rounded-2xl p-3 sm:p-6 m-0 sm:m-auto flex flex-col">
        {graphPanel}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}
