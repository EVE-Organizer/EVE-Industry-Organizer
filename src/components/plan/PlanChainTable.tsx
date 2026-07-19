import { useMemo, useState, type ReactNode } from 'react'
import { EveImage } from '@/components/EveImage'
import { Tooltip } from '@/components/Tooltip'
import { PlanChainSection, PlanSectionExpandActions } from '@/components/plan/PlanChainSection'
import { PlanModeLockedMarket, PlanModeToggle } from '@/components/plan/PlanModeToggle'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import { PlanExpandableLeading, PlanTreeLeading, PlanTreeLines, expandableRowProps, planTableRowClass, stopRowToggle } from '@/components/plan/PlanTreeLines'
import {
  expandableCollapseKeys,
  flattenPlanNodesExpandable,
  isExpandableRowVisible,
  type ExpandablePlanRow,
} from '@/lib/planTreeLines'
import { buildBuyGroups, buildBuyTableRows, buyTableCollapseKeys, isBuyTableRowVisible, type PlanBuyTableRow } from '@/lib/planBuyGroups'
import { packagedBuyNodesFromPlan } from '@/lib/planPackagedBuy'
import { planBuildVsBuyFootnote } from '@/lib/planBuildVsBuy'
import { SHARED_MATERIALS_ICON_TYPE_ID } from '@/lib/eveImages'
import { PlanBlueprintItemName } from '@/components/plan/PlanBlueprintItemName'
import { supplySlotsForComponent } from '@/lib/supplyChainSlots'
import { formatDecimal, formatDurationHms, formatGraphQuantity, formatIsk } from '@/lib/profit'
import type { ManufactureDisplayRow } from '@/lib/planManufactureDisplay'
import type { PlanNode, PlanRootEntry } from '@/types'

const ROW_ICON_SIZE = PLAN_ROW_ICON_SIZE
const UNIT_COL_CLASS = 'w-28 text-right'
const PRICE_COL_CLASS = 'w-32 text-right'
const SOURCE_COL_CLASS = 'w-28 text-right'
const DURATION_COL_CLASS = 'w-[6.5rem] text-right whitespace-nowrap'
const SLOTS_COL_CLASS = 'w-[3.5rem] min-w-[3rem] text-right'

function ConcurrentSlotsCell({
  isRoot,
  mode,
  bpcCount,
  activeSlots,
  skillSlots,
  totalRootRuns,
}: {
  isRoot: boolean
  mode: PlanNode['mode']
  bpcCount: number
  activeSlots: number
  skillSlots: number
  totalRootRuns: number
}) {
  if (mode !== 'build' || bpcCount <= 0 || totalRootRuns <= 0) {
    return <span className="text-sm opacity-40">—</span>
  }

  const supplySlots = isRoot ? 1 : supplySlotsForComponent(bpcCount, totalRootRuns)
  const overSkill = !isRoot && supplySlots > skillSlots

  const tooltip = isRoot
    ? `Root build uses one manufacturing line for this ${totalRootRuns}-run batch`
    : `Parallel BPC lines so this component keeps pace with ${totalRootRuns} root runs. Need ${supplySlots}; plan schedules ${activeSlots} on your ${skillSlots} industry slots.`

  return (
    <Tooltip text={tooltip} placement="top">
      <span
        className={`tabular-nums text-sm cursor-help border-b border-dotted border-current/40${overSkill ? ' text-warning' : ''}`}
      >
        {supplySlots}
      </span>
    </Tooltip>
  )
}

function PlanItemName({
  node,
  onOpenGraph,
  onOpenMeTe,
  showMeTeSettings,
}: {
  node: PlanNode
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  showMeTeSettings?: boolean
}) {
  return (
    <PlanBlueprintItemName
      node={node}
      onOpenGraph={onOpenGraph}
      onOpenMeTe={onOpenMeTe}
      showMeTeSettings={showMeTeSettings}
    />
  )
}

function BuyMaterialLabel({
  node,
  subtitle,
  badgesBelow = true,
  rootInstance,
  rootInstanceTotal,
  onOpenGraph,
  onOpenMeTe,
  showMeTeSettings,
}: {
  node: PlanNode
  subtitle?: ReactNode
  badgesBelow?: boolean
  rootInstance?: number
  rootInstanceTotal?: number
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  showMeTeSettings?: boolean
}) {
  const footnote = planBuildVsBuyFootnote(node)
  const badges: { label: string; className: string }[] = []
  if (node.isRoot) badges.push({ label: 'Root', className: 'badge-primary' })
  if (node.tier === 't2') badges.push({ label: 'T2', className: 'badge-warning' })
  if (node.demandByParent.length > 1) {
    badges.push({ label: 'Shared', className: 'badge-outline border-eve-border' })
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        <PlanItemName
          node={node}
          onOpenGraph={onOpenGraph}
          onOpenMeTe={onOpenMeTe}
          showMeTeSettings={showMeTeSettings}
        />
        {!badgesBelow && badges.length > 0
          ? badges.map((b) => (
              <span key={b.label} className={`badge badge-xs shrink-0 ${b.className}`}>
                {b.label}
              </span>
            ))
          : null}
        {!badgesBelow &&
        rootInstance != null &&
        rootInstanceTotal != null &&
        rootInstanceTotal > 1 ? (
          <span className="badge badge-ghost badge-xs shrink-0 tabular-nums">#{rootInstance}</span>
        ) : null}
      </div>
      {badgesBelow && badges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          {badges.map((b) => (
            <span key={b.label} className={`badge badge-xs ${b.className}`}>
              {b.label}
            </span>
          ))}
        </div>
      ) : null}
      {node.canToggle && node.buyCost != null && node.buildCost != null ? (
        <p className="text-[10px] tabular-nums opacity-60 mt-0.5 leading-snug">
          Buy {formatIsk(node.buyCost)} · Build {formatIsk(node.buildCost)}
        </p>
      ) : null}
      {footnote ? (
        <p className={`text-[10px] tabular-nums mt-0.5 leading-snug ${footnote.accent}`}>{footnote.text}</p>
      ) : null}
      {subtitle ? (
        <p className="text-[11px] opacity-50 tabular-nums mt-0.5 leading-snug">{subtitle}</p>
      ) : null}
    </div>
  )
}

interface PlanChainTableProps {
  nodes: PlanNode[]
  manufactureRows?: ManufactureDisplayRow[]
  planRoots?: PlanRootEntry[]
  skillSlots: number
  onToggleMode?: (productTypeId: number) => void
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
  warnings?: { productTypeId: number; message: string }[]
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block text-[10px] opacity-50 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      ▸
    </span>
  )
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const CONSUMER_ICON_SIZE = 24

function SharedGroupIcon() {
  return (
    <EveImage
      id={SHARED_MATERIALS_ICON_TYPE_ID}
      size={ROW_ICON_SIZE}
      framed
      alt=""
      className="shrink-0"
    />
  )
}

function SharedConsumerIcons({
  productTypeIds,
  nodesById,
  blueprintTypeIdByProduct,
}: {
  productTypeIds: number[]
  nodesById: Map<number, PlanNode>
  blueprintTypeIdByProduct: Map<number, number>
}) {
  if (productTypeIds.length === 0) return null

  return (
    <span className="inline-flex items-center gap-0.5 flex-wrap">
      {productTypeIds.map((productTypeId) => {
        const name = nodesById.get(productTypeId)?.name ?? String(productTypeId)
        return (
          <Tooltip key={productTypeId} text={name} placement="top">
            <span className="inline-flex shrink-0">
              <PlanProductIcon
                productTypeId={productTypeId}
                blueprintTypeId={blueprintTypeIdByProduct.get(productTypeId)}
                size={CONSUMER_ICON_SIZE}
                alt={name}
              />
            </span>
          </Tooltip>
        )
      })}
    </span>
  )
}

function PlanRowIcon({
  productTypeId,
  blueprintTypeIdByProduct,
}: {
  productTypeId: number
  blueprintTypeIdByProduct: Map<number, number>
}) {
  return (
    <PlanProductIcon
      productTypeId={productTypeId}
      blueprintTypeId={blueprintTypeIdByProduct.get(productTypeId)}
      size={ROW_ICON_SIZE}
      alt=""
    />
  )
}

function ItemCell({
  node,
  onOpenGraph,
  blueprintTypeIdByProduct,
  treeDepth,
  isLast,
  continues,
}: {
  node: PlanNode
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
  treeDepth: number
  isLast: boolean
  continues: boolean[]
}) {
  return (
    <div className="flex items-start gap-2 min-w-0 py-0.5">
      <PlanTreeLines depth={treeDepth} isLast={isLast} continues={continues} />
      <PlanRowIcon productTypeId={node.productTypeId} blueprintTypeIdByProduct={blueprintTypeIdByProduct} />
      <BuyMaterialLabel
        node={node}
        badgesBelow={false}
        onOpenGraph={onOpenGraph}
        subtitle={node.packagedInput ? 'Packaged input from market' : undefined}
      />
    </div>
  )
}

function ModeCell({
  node,
  onToggleMode,
}: {
  node: PlanNode
  onToggleMode?: (productTypeId: number) => void
}) {
  if (!node.canToggle) {
    if (node.mode === 'build') {
      return null
    }

    return (
      <Tooltip text="No blueprint or raw mineral. Always purchased from market." placement="left">
        <span className="inline-flex justify-end w-[6rem]">
          <PlanModeLockedMarket lockIcon={<LockIcon />} />
        </span>
      </Tooltip>
    )
  }

  if (!onToggleMode) {
    return (
      <div className="inline-flex justify-end w-[6rem]">
        <span className="text-xs font-semibold uppercase opacity-70">{node.mode}</span>
      </div>
    )
  }

  return (
    <div className="inline-flex justify-end w-[6rem]" onClick={stopRowToggle}>
      <PlanModeToggle mode={node.mode} onClick={() => onToggleMode(node.productTypeId)} />
    </div>
  )
}

function ManufactureItemCell({
  row,
  expanded,
  onOpenGraph,
  onOpenMeTe,
  blueprintTypeIdByProduct,
}: {
  row: ManufactureDisplayRow | ExpandablePlanRow
  expanded: boolean
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
}) {
  const node = row.node
  const rootInstance = 'rootInstance' in row ? row.rootInstance : undefined
  const rootInstanceTotal = 'rootInstanceTotal' in row ? row.rootInstanceTotal : undefined

  if (row.kind === 'parent') {
    return (
      <div className="flex items-start gap-2 min-w-0 py-0.5">
        <PlanExpandableLeading
          treeDepth={row.depth}
          isLast={row.isLast}
          continues={row.continues}
          chevron={<ChevronIcon open={expanded} />}
        />
        <PlanRowIcon productTypeId={node.productTypeId} blueprintTypeIdByProduct={blueprintTypeIdByProduct} />
        <BuyMaterialLabel
          node={node}
          badgesBelow={false}
          rootInstance={rootInstance}
          rootInstanceTotal={rootInstanceTotal}
          onOpenGraph={onOpenGraph}
          onOpenMeTe={onOpenMeTe}
          showMeTeSettings
        />
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 min-w-0 py-0.5">
      <PlanTreeLines depth={row.depth} isLast={row.isLast} continues={row.continues} />
      <PlanRowIcon productTypeId={node.productTypeId} blueprintTypeIdByProduct={blueprintTypeIdByProduct} />
      <BuyMaterialLabel
        node={node}
        badgesBelow={false}
        rootInstance={rootInstance}
        rootInstanceTotal={rootInstanceTotal}
        onOpenGraph={onOpenGraph}
        onOpenMeTe={onOpenMeTe}
        showMeTeSettings
      />
    </div>
  )
}

function BuildSection({
  nodes,
  manufactureRows,
  planRoots,
  skillSlots,
  onToggleMode,
  onOpenGraph,
  onOpenMeTe,
  blueprintTypeIdByProduct,
}: {
  nodes: PlanNode[]
  manufactureRows?: ManufactureDisplayRow[]
  planRoots?: PlanRootEntry[]
  skillSlots: number
  onToggleMode?: (productTypeId: number) => void
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
}) {
  const tableRows = useMemo(
    () => manufactureRows ?? flattenPlanNodesExpandable(nodes, 'manufacture'),
    [manufactureRows, nodes],
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  if (nodes.length === 0) return null

  const rootCount = planRoots?.length ?? nodes.filter((n) => n.isRoot).length
  const totalRuns =
    planRoots?.reduce((sum, r) => sum + r.runs, 0) ??
    nodes.filter((n) => n.isRoot).reduce((sum, n) => sum + n.runs, 0)

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll() {
    setCollapsed(new Set())
  }

  function collapseAll() {
    setCollapsed(new Set(expandableCollapseKeys(tableRows)))
  }

  const visibleRows = tableRows.filter((row) => isExpandableRowVisible(row, collapsed))

  return (
    <PlanChainSection
      tone="manufacture"
      title="Manufacture"
      count={rootCount}
      summary={`${formatDecimal(totalRuns, 0)} total runs`}
      actions={
        <PlanSectionExpandActions onExpandAll={expandAll} onCollapseAll={collapseAll} />
      }
    >
      <table className="table table-compact w-full">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide opacity-50">
            <th>Item</th>
            <th className="text-right w-[4.5rem]">
              <Tooltip text="Units required by parent jobs in the chain" placement="top">
                <span className="cursor-help border-b border-dotted border-current/40">Need</span>
              </Tooltip>
            </th>
            <th className="text-right w-[4.5rem]">
              <Tooltip text="Units produced by the scheduled runs" placement="top">
                <span className="cursor-help border-b border-dotted border-current/40">Output</span>
              </Tooltip>
            </th>
            <th className="text-right w-[3.5rem]">Runs</th>
            <th className="text-right w-[3.5rem]">
              <Tooltip text="Blueprint copies needed for the run count" placement="top">
                <span className="cursor-help border-b border-dotted border-current/40">BPC</span>
              </Tooltip>
            </th>
            <th className={SLOTS_COL_CLASS}>
              <Tooltip
                text="Parallel BPC lines so this component keeps pace with the root run count"
                placement="top"
              >
                <span className="cursor-help border-b border-dotted border-current/40">Slots</span>
              </Tooltip>
            </th>
            <th className={DURATION_COL_CLASS}>
              <Tooltip text="Total job duration (hours:minutes:seconds)" placement="top">
                <span className="cursor-help border-b border-dotted border-current/40">Duration</span>
              </Tooltip>
            </th>
            <th className="w-[6.5rem] text-right">Source</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const node = row.node
            const isParentRow = row.kind === 'parent' || row.depth === 0
            const expanded = row.kind === 'parent' ? !collapsed.has(row.collapseKey) : true
            const rowToggle =
              row.kind === 'parent'
                ? expandableRowProps(expanded, node.name, () => toggleCollapse(row.collapseKey))
                : null
            const rowKey =
              'rowKey' in row && typeof row.rowKey === 'string'
                ? row.rowKey
                : `manufacture/${node.productTypeId}`

            return (
              <tr
                key={rowKey}
                className={`${planTableRowClass(isParentRow)}${row.kind === 'parent' ? ' cursor-pointer' : ''}`}
                {...rowToggle}
              >
                <td className="align-top py-2 min-w-0">
                  <ManufactureItemCell
                    row={row}
                    expanded={expanded}
                    onOpenGraph={onOpenGraph}
                    onOpenMeTe={onOpenMeTe}
                    blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                  />
                </td>
              <td className="text-right tabular-nums text-sm align-top py-2">
                {formatGraphQuantity(node.totalDemandQty)}
              </td>
              <td className="text-right tabular-nums text-sm align-top py-2">
                {formatGraphQuantity(node.outputQty)}
                {node.outputQty > node.totalDemandQty ? (
                  <span className="block text-[10px] text-success opacity-80">
                    +{formatGraphQuantity(node.outputQty - node.totalDemandQty)} spare
                  </span>
                ) : null}
              </td>
              <td className="text-right tabular-nums text-sm align-top py-2">{node.runs}</td>
              <td className="text-right tabular-nums text-sm align-top py-2">{node.bpcCount}</td>
              <td className={`${SLOTS_COL_CLASS} align-top py-2`}>
                <ConcurrentSlotsCell
                  isRoot={node.isRoot}
                  mode={node.mode}
                  bpcCount={node.bpcCount}
                  activeSlots={node.concurrentCopies}
                  skillSlots={skillSlots}
                  totalRootRuns={totalRuns}
                />
              </td>
              <td className={`${DURATION_COL_CLASS} tabular-nums text-sm text-info align-top py-2`}>
                {node.jobTimeSeconds > 0 ? formatDurationHms(node.jobTimeSeconds) : '—'}
              </td>
              <td className="text-right align-top py-2">
                <ModeCell node={node} onToggleMode={onToggleMode} />
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </PlanChainSection>
  )
}

function PriceCell({ node }: { node: PlanNode }) {
  if (node.unitPrice == null || node.unitPrice <= 0) {
    return <span className="text-sm opacity-40">—</span>
  }

  return (
    <div className="tabular-nums text-sm leading-snug">
      <span>{formatIsk(node.unitPrice)}</span>
      {node.buyCost != null && node.buyCost > 0 ? (
        <span className="block text-[10px] opacity-60">{formatIsk(node.buyCost)} total</span>
      ) : null}
    </div>
  )
}

function BuyTableRow({
  row,
  expanded,
  onToggleCollapse,
  onToggleMode,
  onOpenGraph,
  blueprintTypeIdByProduct,
  nodesById,
}: {
  row: PlanBuyTableRow
  expanded: boolean
  onToggleCollapse: (key: string) => void
  onToggleMode?: (productTypeId: number) => void
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
  nodesById: Map<number, PlanNode>
}) {
  if (row.kind === 'group') {
    return (
      <tr
        className={`${planTableRowClass(true)} cursor-pointer`}
        {...expandableRowProps(expanded, row.parentName, () => onToggleCollapse(row.key))}
      >
        <td className="align-top py-2 min-w-0" colSpan={1}>
          <div className="flex items-start gap-2 min-w-0 py-0.5">
            <PlanTreeLeading>
              <span className="flex items-center justify-center w-full h-8" aria-hidden>
                <ChevronIcon open={expanded} />
              </span>
            </PlanTreeLeading>
            {row.key === 'shared' ? (
              <SharedGroupIcon />
            ) : row.parentProductTypeId != null ? (
              <PlanRowIcon
                productTypeId={row.parentProductTypeId}
                blueprintTypeIdByProduct={blueprintTypeIdByProduct}
              />
            ) : null}
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <p className="text-sm font-medium leading-snug shrink-0">{row.parentName}</p>
                {row.key === 'shared' && row.consumerProductTypeIds ? (
                  <SharedConsumerIcons
                    productTypeIds={row.consumerProductTypeIds}
                    nodesById={nodesById}
                    blueprintTypeIdByProduct={blueprintTypeIdByProduct}
                  />
                ) : null}
              </div>
              <p className="text-[11px] opacity-50 tabular-nums mt-0.5 leading-snug">
                {row.itemCount} materials
              </p>
            </div>
          </div>
        </td>
        <td className={`${UNIT_COL_CLASS} tabular-nums text-sm align-top py-2`}>
          {formatGraphQuantity(row.totalQty)}
        </td>
        <td className={`${PRICE_COL_CLASS} tabular-nums text-sm align-top py-2 pr-1`}>
          {row.totalCost > 0 ? formatIsk(row.totalCost) : <span className="opacity-40">—</span>}
        </td>
        <td className={`${SOURCE_COL_CLASS} align-top py-2 pr-2`} />
      </tr>
    )
  }

  if (row.kind === 'parent') {
    return (
      <tr
        className={`${planTableRowClass(true)} cursor-pointer`}
        {...expandableRowProps(expanded, row.node.name, () => onToggleCollapse(row.collapseKey))}
      >
        <td className="align-top py-2 min-w-0">
          <div className="flex items-start gap-2 min-w-0 py-0.5">
            <PlanExpandableLeading
              treeDepth={row.depth}
              isLast={row.isLast}
              continues={row.continues}
              chevron={<ChevronIcon open={expanded} />}
            />
            <PlanRowIcon
              productTypeId={row.node.productTypeId}
              blueprintTypeIdByProduct={blueprintTypeIdByProduct}
            />
            <BuyMaterialLabel node={row.node} badgesBelow={false} onOpenGraph={onOpenGraph} />
          </div>
        </td>
        <td className={`${UNIT_COL_CLASS} tabular-nums text-sm align-top py-2`}>
          {formatGraphQuantity(row.node.totalDemandQty)}
        </td>
        <td className={`${PRICE_COL_CLASS} align-top py-2 pr-1`}>
          <PriceCell node={row.node} />
        </td>
        <td className={`${SOURCE_COL_CLASS} align-top py-2 pr-2`}>
          <ModeCell node={row.node} onToggleMode={onToggleMode} />
        </td>
      </tr>
    )
  }

  return (
    <tr className={planTableRowClass(false)}>
      <td className="align-top py-2 min-w-0">
        <ItemCell
          node={row.node}
          onOpenGraph={onOpenGraph}
          blueprintTypeIdByProduct={blueprintTypeIdByProduct}
          treeDepth={row.depth}
          isLast={row.isLast}
          continues={row.continues}
        />
      </td>
      <td className={`${UNIT_COL_CLASS} tabular-nums text-sm align-top py-2`}>
        {formatGraphQuantity(row.node.totalDemandQty)}
      </td>
      <td className={`${PRICE_COL_CLASS} align-top py-2 pr-1`}>
        <PriceCell node={row.node} />
      </td>
      <td className={`${SOURCE_COL_CLASS} align-top py-2 pr-2`}>
        <ModeCell node={row.node} onToggleMode={onToggleMode} />
      </td>
    </tr>
  )
}

function BuySection({
  allNodes,
  buyNodes,
  onToggleMode,
  onOpenGraph,
  blueprintTypeIdByProduct,
}: {
  allNodes: PlanNode[]
  buyNodes: PlanNode[]
  onToggleMode?: (productTypeId: number) => void
  onOpenGraph: (productTypeId: number) => void
  blueprintTypeIdByProduct: Map<number, number>
}) {
  const tableRows = useMemo(() => {
    const groups = buildBuyGroups(allNodes, buyNodes)
    return buildBuyTableRows(groups, allNodes)
  }, [allNodes, buyNodes])

  const nodesById = useMemo(() => new Map(allNodes.map((n) => [n.productTypeId, n])), [allNodes])

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  if (buyNodes.length === 0) return null

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll() {
    setCollapsed(new Set())
  }

  function collapseAll() {
    setCollapsed(new Set(buyTableCollapseKeys(tableRows)))
  }

  const visibleRows = tableRows.filter((row) => isBuyTableRowVisible(row, collapsed))

  const buyTotal = useMemo(
    () => buyNodes.reduce((sum, n) => sum + (n.buyCost ?? 0), 0),
    [buyNodes],
  )

  const totalUnits = useMemo(
    () => buyNodes.reduce((sum, n) => sum + n.totalDemandQty, 0),
    [buyNodes],
  )

  function rowExpanded(row: PlanBuyTableRow): boolean {
    if (row.kind === 'group') return !collapsed.has(row.key)
    if (row.kind === 'parent') return !collapsed.has(row.collapseKey)
    return !collapsed.has(row.groupKey)
  }

  function rowKey(row: PlanBuyTableRow): string {
    if (row.kind === 'group') return `g-${row.key}`
    if (row.kind === 'parent') return `p-${row.collapseKey}`
    return `i-${row.groupKey}-${row.node.productTypeId}`
  }

  return (
    <PlanChainSection
      tone="buy"
      title="Buy from market"
      count={buyNodes.length}
      summary={`${formatGraphQuantity(totalUnits)} units · ${formatIsk(buyTotal)} total`}
      actions={
        <PlanSectionExpandActions onExpandAll={expandAll} onCollapseAll={collapseAll} />
      }
    >
      <table className="table table-compact w-full">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide opacity-50">
            <th>Item</th>
            <th className={UNIT_COL_CLASS}>
              <Tooltip text="Units required by parent jobs in the chain" placement="top">
                <span className="cursor-help border-b border-dotted border-current/40">Need</span>
              </Tooltip>
            </th>
            <th className={`${PRICE_COL_CLASS} pr-1`}>
              <Tooltip text="Hub sell price per unit and line total (price × qty)" placement="top">
                <span className="cursor-help border-b border-dotted border-current/40">Price</span>
              </Tooltip>
            </th>
            <th className={`${SOURCE_COL_CLASS} pr-2`}>Source</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <BuyTableRow
              key={rowKey(row)}
              row={row}
              expanded={rowExpanded(row)}
              onToggleCollapse={toggleCollapse}
              onToggleMode={onToggleMode}
              onOpenGraph={onOpenGraph}
              blueprintTypeIdByProduct={blueprintTypeIdByProduct}
              nodesById={nodesById}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-eve-border text-sm font-medium">
            <td className="py-2 opacity-70">Total</td>
            <td className={`${UNIT_COL_CLASS} tabular-nums py-2`}>
              {formatGraphQuantity(totalUnits)}
            </td>
            <td className={`${PRICE_COL_CLASS} tabular-nums py-2 pr-1`}>{formatIsk(buyTotal)}</td>
            <td className={SOURCE_COL_CLASS} />
          </tr>
        </tfoot>
      </table>
    </PlanChainSection>
  )
}

export function PlanChainTable({
  nodes,
  manufactureRows,
  planRoots,
  skillSlots,
  onToggleMode,
  onOpenGraph,
  onOpenMeTe,
  blueprintTypeIdByProduct,
  warnings = [],
}: PlanChainTableProps) {
  const buildNodes = useMemo(() => nodes.filter((n) => n.mode === 'build'), [nodes])
  const buyNodes = useMemo(() => nodes.filter((n) => n.mode === 'buy'), [nodes])
  const packagedBuyNodes = useMemo(() => packagedBuyNodesFromPlan(nodes), [nodes])
  const allBuyNodes = useMemo(
    () => [...buyNodes, ...packagedBuyNodes],
    [buyNodes, packagedBuyNodes],
  )

  if (nodes.length === 0) {
    return <p className="text-sm opacity-60">Add roots to expand the chain.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs opacity-60">
        Buildable items show buy vs build costs. Source buttons switch between build and buy where a
        blueprint exists; minerals stay on Market.
      </p>

      {buildNodes.length > 0 ? (
        <BuildSection
          nodes={buildNodes}
          manufactureRows={manufactureRows}
          planRoots={planRoots}
          skillSlots={skillSlots}
          onToggleMode={onToggleMode}
          onOpenGraph={onOpenGraph}
          onOpenMeTe={onOpenMeTe}
          blueprintTypeIdByProduct={blueprintTypeIdByProduct}
        />
      ) : null}

      {allBuyNodes.length > 0 ? (
        <BuySection
          allNodes={nodes}
          buyNodes={allBuyNodes}
          onToggleMode={onToggleMode}
          onOpenGraph={onOpenGraph}
          blueprintTypeIdByProduct={blueprintTypeIdByProduct}
        />
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-3 text-xs text-warning space-y-1">
          {warnings.map((w) => (
            <li key={w.productTypeId}>{w.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
