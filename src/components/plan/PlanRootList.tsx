import { useMemo, useState } from 'react'
import { Tooltip } from '@/components/Tooltip'
import { PlanChainSection, PlanSectionExpandActions } from '@/components/plan/PlanChainSection'
import { PlanBlueprintItemName } from '@/components/plan/PlanBlueprintItemName'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import {
  PlanExpandableLeading,
  PlanTreeLines,
  expandableRowProps,
  planTableRowClass,
  stopRowToggle,
} from '@/components/plan/PlanTreeLines'
import { expandableCollapseKeys, isExpandableRowVisible, type ExpandablePlanRow } from '@/lib/planTreeLines'
import { formatDecimal, formatDurationHms, formatGraphQuantity, formatIsk, formatPercent, parseDurationHms } from '@/lib/profit'
import type { RootProfitRow } from '@/lib/planProfit'
import { textLinkClass } from '@/lib/textLink'

export type BuildBlueprintRow = ExpandablePlanRow & {
  rootId?: string
  rootInstance?: number
  rootInstanceTotal?: number
  productTypeId: number
  blueprintTypeId?: number
  name: string
  runs: number
  jobTimeHours: number
  outputQty: number
  isRoot: boolean
  enabled?: boolean
}

interface PlanRootListProps {
  rows: BuildBlueprintRow[]
  profitByRootId?: Map<string, RootProfitRow>
  onOpenSetup?: (rootId: string) => void
  onOpenProfit?: (rootId: string) => void
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  readOnly?: boolean
  onChange?: (
    rootId: string | undefined,
    productTypeId: number,
    patch: { runs?: number; productionDurationHours?: number; overallDurationHours?: number },
  ) => void
  onSetAllDuration?: (hours: number, mode: 'production' | 'overall') => void
  onFitRunsToOverall?: (
    targets: Array<{
      rootId?: string
      productTypeId: number
      targetReadyHours: number
      jobHours: number
      currentRuns: number
    }>,
  ) => void
  onDuplicate?: (rootId: string) => void
  onToggleEnabled?: (rootId: string, enabled: boolean) => void
  onRemove?: (rootId: string) => void
  onReorder?: (fromRootId: string, toRootId: string) => void
  /** Clock time until each product is ready (timeline finish). */
  readyHoursByProductId?: Map<number, number>
  planWindowHours?: number
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

function RemoveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm8-12a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  )
}

const ROOT_DRAG_TYPE = 'text/plain'

function RunsInput({
  runs,
  onCommit,
}: {
  runs: number
  onCommit: (runs: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? String(runs)

  function commit() {
    const parsed = parseInt(draft ?? String(runs), 10)
    setDraft(null)
    if (!Number.isFinite(parsed) || parsed < 1) return
    if (parsed !== runs) onCommit(parsed)
  }

  return (
    <input
      type="number"
      className="input input-bordered input-xs w-full max-w-[5.5rem] tabular-nums"
      step={1}
      min={1}
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function DurationInput({
  hours,
  onCommit,
}: {
  hours: number
  onCommit: (hours: number) => void
}) {
  const seconds = Math.max(0, Math.round(hours * 3600))
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? formatDurationHms(seconds)

  function commit() {
    const parsedSeconds = parseDurationHms(draft ?? formatDurationHms(seconds))
    setDraft(null)
    if (parsedSeconds == null) return
    const nextHours = parsedSeconds / 3600
    if (!Number.isFinite(nextHours) || nextHours <= 0) return
    if (Math.abs(nextHours - hours) > 1 / 3600) onCommit(nextHours)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className="input input-bordered input-xs w-full tabular-nums text-info"
      placeholder="H:MM:SS"
      aria-label="Duration"
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setDraft(formatDurationHms(seconds))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function SetAllDurationInput({ onCommit }: { onCommit: (hours: number) => void }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const parsedSeconds = parseDurationHms(draft)
    setDraft('')
    if (parsedSeconds == null || parsedSeconds <= 0) return
    onCommit(parsedSeconds / 3600)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className="input input-bordered input-xs w-[6.25rem] tabular-nums text-info"
      placeholder="H:MM:SS"
      aria-label="Set duration for all jobs"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') {
          setDraft('')
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function ProductCell({
  row,
  expanded,
  onOpenGraph,
  onOpenMeTe,
}: {
  row: BuildBlueprintRow
  expanded: boolean
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
}) {
  if (row.kind === 'parent') {
    return (
      <div className="flex items-start gap-2 min-w-0 py-0.5">
        <PlanExpandableLeading
          treeDepth={row.depth}
          isLast={row.isLast}
          continues={row.continues}
          chevron={<ChevronIcon open={expanded} />}
        />
        <PlanProductIcon
          productTypeId={row.productTypeId}
          blueprintTypeId={row.blueprintTypeId}
          size={PLAN_ROW_ICON_SIZE}
          alt={row.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <PlanBlueprintItemName
              node={row.node}
              onOpenGraph={onOpenGraph}
              onOpenMeTe={onOpenMeTe}
              showMeTeSettings
            />
            {row.isRoot ? (
              <span className="badge badge-primary badge-sm shrink-0">Root</span>
            ) : null}
            {row.isRoot && row.node.tier === 't2' ? (
              <span className="badge badge-warning badge-sm shrink-0">T2</span>
            ) : null}
          </div>
          <p className="text-[11px] opacity-50 tabular-nums mt-0.5 leading-snug">
            {row.childCount} sub-builds
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 min-w-0 py-0.5">
      <PlanTreeLines depth={row.depth} isLast={row.isLast} continues={row.continues} />
      <PlanProductIcon
        productTypeId={row.productTypeId}
        blueprintTypeId={row.blueprintTypeId}
        size={PLAN_ROW_ICON_SIZE}
        alt={row.name}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <PlanBlueprintItemName
            node={row.node}
            onOpenGraph={onOpenGraph}
            onOpenMeTe={onOpenMeTe}
            showMeTeSettings
          />
          {row.rootInstance != null && row.rootInstanceTotal != null && row.rootInstanceTotal > 1 ? (
            <span className="badge badge-ghost badge-xs shrink-0 tabular-nums">#{row.rootInstance}</span>
          ) : null}
          {row.isRoot ? <span className="badge badge-primary badge-sm shrink-0">Root</span> : null}
          {row.isRoot && row.node.tier === 't2' ? (
            <span className="badge badge-warning badge-sm shrink-0">T2</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function PlanRootList({
  rows,
  profitByRootId,
  onOpenSetup,
  onOpenProfit,
  onOpenGraph,
  onOpenMeTe,
  readOnly = false,
  onChange,
  onSetAllDuration,
  onFitRunsToOverall,
  onDuplicate,
  onToggleEnabled,
  onRemove,
  onReorder,
  readyHoursByProductId,
  planWindowHours,
}: PlanRootListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [durationMode, setDurationMode] = useState<'production' | 'overall'>('production')
  const overallMode = durationMode === 'overall'
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const visibleRows = useMemo(
    () => rows.filter((row) => isExpandableRowVisible(row, collapsed)),
    [rows, collapsed],
  )

  const rootRows = useMemo(() => rows.filter((row) => row.isRoot), [rows])
  const rootCount = rootRows.length
  const enabledRoots = useMemo(
    () => rootRows.filter((row) => row.enabled !== false),
    [rootRows],
  )
  const canReorder = !readOnly && !!onReorder && rootCount > 1
  const summary = useMemo(() => {
    const totalRuns = enabledRoots.reduce((sum, row) => sum + row.runs, 0)
    const off = rootCount - enabledRoots.length
    const timeHours = overallMode
      ? (planWindowHours ?? 0)
      : enabledRoots.reduce((sum, row) => sum + row.jobTimeHours, 0)
    const timeLabel = overallMode ? 'until last product' : 'scheduled'
    const scheduled = `${formatDecimal(totalRuns, 0)} runs · ${formatDurationHms(timeHours * 3600)} ${timeLabel}`
    return off > 0 ? `${scheduled} · ${off} off` : scheduled
  }, [enabledRoots, overallMode, planWindowHours, rootCount])

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
    setCollapsed(new Set(expandableCollapseKeys(rows)))
  }

  return (
    <PlanChainSection
      tone="info"
      title="Production jobs"
      count={rootCount}
      summary={rootCount > 0 ? summary : undefined}
      embedded
      actions={
        rows.length > 0 ? (
          <>
            <div className="join mr-1">
              <button
                type="button"
                className={`btn btn-ghost btn-xs join-item ${!overallMode ? 'btn-active' : ''}`}
                onClick={() => setDurationMode('production')}
              >
                Production
              </button>
              <button
                type="button"
                className={`btn btn-ghost btn-xs join-item ${overallMode ? 'btn-active' : ''}`}
                onClick={() => {
                  if (!readOnly && onFitRunsToOverall) {
                    onFitRunsToOverall(
                      rows
                        .filter((row) => row.enabled !== false)
                        .map((row) => ({
                          rootId: row.rootId,
                          productTypeId: row.productTypeId,
                          targetReadyHours: row.jobTimeHours,
                          jobHours: row.jobTimeHours,
                          currentRuns: row.runs,
                        })),
                    )
                  }
                  setDurationMode('overall')
                }}
              >
                Overall
              </button>
            </div>
            {onSetAllDuration && !readOnly ? (
              <label className="flex items-center gap-1.5 mr-1">
                <Tooltip
                  text={
                    overallMode
                      ? 'Fits every job so the product is ready by this time. Runs shrink to cover chain wait; they do not treat this as a longer job timer.'
                      : 'Applies this job timer to every blueprint. Runs update to match.'
                  }
                  placement="bottom"
                >
                  <span className="text-[11px] font-normal normal-case tracking-normal opacity-55 whitespace-nowrap cursor-help border-b border-dotted border-current/40">
                    Set all
                  </span>
                </Tooltip>
                <SetAllDurationInput
                  onCommit={(hours) => onSetAllDuration(hours, overallMode ? 'overall' : 'production')}
                />
              </label>
            ) : null}
            <PlanSectionExpandActions onExpandAll={expandAll} onCollapseAll={collapseAll} />
          </>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-base-content/50 px-4 py-8 text-center sm:px-5">
          No blueprints yet. Search above to add a root product.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="table table-compact w-full plan-jobs-table">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide opacity-50">
              <th className="min-w-[10rem]">Product</th>
              <th className="w-[5.5rem]">
                <Tooltip text="Manufacturing runs for this job" placement="top">
                  <span className="cursor-help border-b border-dotted border-current/40">Runs</span>
                </Tooltip>
              </th>
              <th className="plan-jobs-table__duration-col">
                <Tooltip
                  text={
                    overallMode
                      ? 'Ready-by time for this product. Runs are sized so the chain finishes by then, not so this job alone lasts that long.'
                      : 'This job\'s industry timer (hours:minutes:seconds)'
                  }
                  placement="top"
                >
                  <span className="cursor-help border-b border-dotted border-current/40">Duration</span>
                </Tooltip>
              </th>
              <th className="plan-jobs-table__money-col">Output</th>
              <th className="plan-jobs-table__money-col">
                <Tooltip text="Rolled-up build/buy chain cost for this root" placement="top">
                  <span className="cursor-help border-b border-dotted border-current/40">Setup</span>
                </Tooltip>
              </th>
              <th className="plan-jobs-table__money-col">Profit</th>
              <th className="plan-jobs-table__money-col plan-jobs-table__money-col--narrow">Margin</th>
              <th className="w-16" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => {
              const isParentRow = row.kind === 'parent' || row.depth === 0
              const expanded = row.kind === 'parent' ? !collapsed.has(row.collapseKey) : true
              const rowToggle =
                row.kind === 'parent'
                  ? expandableRowProps(expanded, row.name, () => toggleCollapse(row.collapseKey))
                  : null
              const rowKey = row.rootId ?? `job-${row.productTypeId}-${row.depth}-${rowIndex}`
              const profit = row.rootId ? profitByRootId?.get(row.rootId) : undefined
              const isDropTarget = !!row.rootId && dragOverId === row.rootId && draggingId !== row.rootId
              const rowEnabled = row.enabled !== false
              return (
                <tr
                  key={rowKey}
                  className={`${planTableRowClass(isParentRow)}${row.kind === 'parent' ? ' cursor-pointer' : ''}${
                    draggingId && row.rootId === draggingId ? ' opacity-50' : ''
                  }${isDropTarget ? ' plan-jobs-table__drop-target' : ''}${
                    row.isRoot && !rowEnabled ? ' opacity-40' : ''
                  }`}
                  {...rowToggle}
                  onDragOver={
                    canReorder && row.isRoot && row.rootId
                      ? (e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          if (dragOverId !== row.rootId) setDragOverId(row.rootId!)
                        }
                      : undefined
                  }
                  onDragLeave={
                    canReorder && row.isRoot && row.rootId
                      ? (e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverId((id) => (id === row.rootId ? null : id))
                          }
                        }
                      : undefined
                  }
                  onDrop={
                    canReorder && row.isRoot && row.rootId
                      ? (e) => {
                          e.preventDefault()
                          const fromId = e.dataTransfer.getData(ROOT_DRAG_TYPE)
                          setDraggingId(null)
                          setDragOverId(null)
                          if (fromId && fromId !== row.rootId) onReorder?.(fromId, row.rootId!)
                        }
                      : undefined
                  }
                >
                  <td className="align-top py-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {canReorder && row.isRoot && row.rootId ? (
                        <span
                          role="button"
                          tabIndex={0}
                          className="inline-flex items-center justify-center size-8 shrink-0 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80"
                          aria-label={`Reorder ${row.name}`}
                          draggable
                          onClick={stopRowToggle}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData(ROOT_DRAG_TYPE, row.rootId!)
                            const tr = e.currentTarget.closest('tr')
                            if (tr) e.dataTransfer.setDragImage(tr, 24, 16)
                            setDraggingId(row.rootId!)
                          }}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setDragOverId(null)
                          }}
                        >
                          <GripIcon />
                        </span>
                      ) : null}
                      {row.isRoot && row.rootId && onToggleEnabled && !readOnly ? (
                        <Tooltip text={rowEnabled ? 'Included in the plan' : 'Off: left out of the plan'} placement="top">
                          <input
                            type="checkbox"
                            role="switch"
                            className="toggle toggle-sm toggle-primary shrink-0"
                            checked={rowEnabled}
                            aria-label={`${rowEnabled ? 'Disable' : 'Enable'} ${row.name}`}
                            onClick={stopRowToggle}
                            onChange={(e) => onToggleEnabled(row.rootId!, e.target.checked)}
                          />
                        </Tooltip>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <ProductCell
                          row={row}
                          expanded={expanded}
                          onOpenGraph={onOpenGraph}
                          onOpenMeTe={onOpenMeTe}
                        />
                      </div>
                    </div>
                  </td>
                  <td onClick={stopRowToggle}>
                    {readOnly || !onChange ? (
                      <span className="tabular-nums text-sm">{formatDecimal(row.runs, 0)}</span>
                    ) : (
                      <RunsInput
                        key={`${rowKey}-runs`}
                        runs={row.runs}
                        onCommit={(nextRuns) =>
                          onChange(row.rootId, row.productTypeId, { runs: nextRuns })
                        }
                      />
                    )}
                  </td>
                  <td className="plan-jobs-table__duration-col" onClick={stopRowToggle}>
                    {readOnly || !onChange ? (
                      <span className="tabular-nums text-sm whitespace-nowrap">
                        {formatDurationHms(
                          (overallMode
                            ? (readyHoursByProductId?.get(row.productTypeId) ?? row.jobTimeHours)
                            : row.jobTimeHours) * 3600,
                        )}
                      </span>
                    ) : (
                      <DurationInput
                        key={`${rowKey}-${durationMode}`}
                        hours={
                          overallMode
                            ? (readyHoursByProductId?.get(row.productTypeId) ?? row.jobTimeHours)
                            : row.jobTimeHours
                        }
                        onCommit={(hours) =>
                          onChange(
                            row.rootId,
                            row.productTypeId,
                            overallMode
                              ? { overallDurationHours: hours }
                              : { productionDurationHours: hours },
                          )
                        }
                      />
                    )}
                  </td>
                  <td className="plan-jobs-table__money-col tabular-nums text-sm opacity-80">
                    {formatGraphQuantity(row.outputQty)}
                  </td>
                  <td className="plan-jobs-table__money-col" onClick={stopRowToggle}>
                    {profit?.hasPrices && row.rootId && onOpenSetup ? (
                      <button
                        type="button"
                        className={textLinkClass('tabular-nums text-sm whitespace-nowrap')}
                        onClick={() => onOpenSetup(row.rootId!)}
                        aria-label={`Setup cost breakdown for ${row.name}`}
                      >
                        {formatIsk(profit.setupCost)}
                      </button>
                    ) : profit?.hasPrices ? (
                      <span className="tabular-nums text-sm whitespace-nowrap">
                        {formatIsk(profit.setupCost)}
                      </span>
                    ) : row.isRoot ? (
                      <span className="opacity-40">—</span>
                    ) : (
                      <Tooltip text="Setup and profit are rolled up on the root row only" placement="top">
                        <span className="opacity-30 cursor-help">—</span>
                      </Tooltip>
                    )}
                  </td>
                  <td className="plan-jobs-table__money-col" onClick={stopRowToggle}>
                    {profit?.hasPrices && row.rootId && onOpenProfit ? (
                      <button
                        type="button"
                        className={textLinkClass(
                          'tabular-nums text-sm font-medium whitespace-nowrap',
                          profit.netProfit >= 0 ? 'text-success' : 'text-error',
                        )}
                        onClick={() => onOpenProfit(row.rootId!)}
                        aria-label={`Profit breakdown for ${row.name}`}
                      >
                        {formatIsk(profit.netProfit)}
                      </button>
                    ) : profit?.hasPrices ? (
                      <span
                        className={`tabular-nums text-sm font-medium whitespace-nowrap ${
                          profit.netProfit >= 0 ? 'text-success' : 'text-error'
                        }`}
                      >
                        {formatIsk(profit.netProfit)}
                      </span>
                    ) : row.isRoot ? (
                      <span className="opacity-40">—</span>
                    ) : (
                      <Tooltip text="Setup and profit are rolled up on the root row only" placement="top">
                        <span className="opacity-30 cursor-help">—</span>
                      </Tooltip>
                    )}
                  </td>
                  <td className="plan-jobs-table__money-col plan-jobs-table__money-col--narrow tabular-nums text-sm whitespace-nowrap">
                    {profit?.hasPrices ? (
                      <span className={profit.netProfit >= 0 ? 'text-success' : 'text-error'}>
                        {formatPercent(profit.margin)}
                      </span>
                    ) : row.isRoot ? (
                      <span className="opacity-40">—</span>
                    ) : (
                      <span className="opacity-30">—</span>
                    )}
                  </td>
                  <td onClick={stopRowToggle}>
                    {row.isRoot && row.rootId && !readOnly ? (
                      <div className="flex items-center justify-end gap-0.5">
                        {onDuplicate ? (
                          <Tooltip text="Duplicate job" placement="left">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-square"
                              aria-label={`Duplicate ${row.name}`}
                              onClick={() => onDuplicate(row.rootId!)}
                            >
                              <DuplicateIcon />
                            </button>
                          </Tooltip>
                        ) : null}
                        {onRemove ? (
                          <Tooltip text="Remove root" placement="left">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-square text-error"
                              aria-label={`Remove ${row.name}`}
                              onClick={() => onRemove(row.rootId!)}
                            >
                              <RemoveIcon />
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
      <p className="text-[10px] text-base-content/40 px-4 pb-3 pt-2 sm:px-5">
        {overallMode
          ? 'Overall is the ready-by time. Runs shrink to fit copy, invention, and sub-builds inside that clock. They do not grow as if this were one long industry job.'
          : 'Production is this job\'s industry timer. Editing duration or runs keeps the other field in sync. Set all applies the same timer to every job.'}
      </p>
    </PlanChainSection>
  )
}
