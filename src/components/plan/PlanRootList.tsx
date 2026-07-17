import { useMemo, useState } from 'react'
import { Tooltip } from '@/components/Tooltip'
import { PlanChainSection, PlanSectionExpandActions } from '@/components/plan/PlanChainSection'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import {
  PlanExpandableLeading,
  PlanTreeLines,
  expandableRowProps,
  planTableRowClass,
  stopRowToggle,
} from '@/components/plan/PlanTreeLines'
import { expandableCollapseKeys, isExpandableRowVisible, type ExpandablePlanRow } from '@/lib/planTreeLines'
import { formatDecimal, formatGraphQuantity, formatInputDecimal, formatIsk, formatPercent } from '@/lib/profit'
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
}

interface PlanRootListProps {
  rows: BuildBlueprintRow[]
  profitByRootId?: Map<string, RootProfitRow>
  onOpenSetup?: (rootId: string) => void
  onOpenProfit?: (rootId: string) => void
  onChange: (
    rootId: string | undefined,
    productTypeId: number,
    patch: { runs?: number; productionDurationHours?: number },
  ) => void
  onRemove: (rootId: string) => void
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

function JobTimeInput({
  hours,
  onCommit,
}: {
  hours: number
  onCommit: (hours: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? formatInputDecimal(hours, 2)

  function commit() {
    const parsed = parseFloat(draft ?? String(hours))
    setDraft(null)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onCommit(parsed)
  }

  return (
    <input
      type="number"
      className="input input-bordered input-xs w-full tabular-nums"
      min={0.01}
      step={0.01}
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

function ProductCell({
  row,
  expanded,
}: {
  row: BuildBlueprintRow
  expanded: boolean
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
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            <span className="text-sm font-medium truncate" title={row.name}>
              {row.name}
            </span>
            {row.isRoot ? (
              <span className="badge badge-primary badge-xs shrink-0">Root</span>
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
      <span className="text-sm font-medium truncate" title={row.name}>
        {row.name}
      </span>
      {row.rootInstance != null && row.rootInstanceTotal != null && row.rootInstanceTotal > 1 ? (
        <span className="badge badge-ghost badge-xs shrink-0 tabular-nums">#{row.rootInstance}</span>
      ) : null}
      {row.isRoot ? <span className="badge badge-primary badge-xs shrink-0">Root</span> : null}
    </div>
  )
}

export function PlanRootList({
  rows,
  profitByRootId,
  onOpenSetup,
  onOpenProfit,
  onChange,
  onRemove,
}: PlanRootListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const visibleRows = useMemo(
    () => rows.filter((row) => isExpandableRowVisible(row, collapsed)),
    [rows, collapsed],
  )

  const rootRows = useMemo(() => rows.filter((row) => row.isRoot), [rows])
  const rootCount = rootRows.length
  const summary = useMemo(() => {
    const totalRuns = rootRows.reduce((sum, row) => sum + row.runs, 0)
    const totalHours = rootRows.reduce((sum, row) => sum + row.jobTimeHours, 0)
    return `${formatDecimal(totalRuns, 0)} runs · ${formatDecimal(totalHours, 1)} h scheduled`
  }, [rootRows])

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
          <PlanSectionExpandActions onExpandAll={expandAll} onCollapseAll={collapseAll} />
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
              <th className="plan-jobs-table__hours-col">
                <Tooltip
                  text="Wall-clock hours after industry slots are shared across the plan"
                  placement="top"
                >
                  <span className="cursor-help border-b border-dotted border-current/40">Job time</span>
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
              <th className="w-8" aria-label="Actions" />
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
              return (
                <tr
                  key={rowKey}
                  className={`${planTableRowClass(isParentRow)}${row.kind === 'parent' ? ' cursor-pointer' : ''}`}
                  {...rowToggle}
                >
                  <td className="align-top py-2 min-w-0">
                    <ProductCell row={row} expanded={expanded} />
                  </td>
                  <td onClick={stopRowToggle}>
                    <input
                      type="number"
                      className="input input-bordered input-xs w-full max-w-[5.5rem] tabular-nums"
                      step={10}
                      min={10}
                      value={row.runs}
                      onChange={(e) =>
                        onChange(row.rootId, row.productTypeId, { runs: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="plan-jobs-table__hours-col" onClick={stopRowToggle}>
                    <div className="flex items-center gap-1">
                      <JobTimeInput
                        key={rowKey}
                        hours={row.jobTimeHours}
                        onCommit={(productionDurationHours) =>
                          onChange(row.rootId, row.productTypeId, { productionDurationHours })
                        }
                      />
                      <span className="text-[10px] opacity-50 shrink-0">h</span>
                    </div>
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
                    ) : (
                      <span className="opacity-40">—</span>
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
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                  <td className="plan-jobs-table__money-col plan-jobs-table__money-col--narrow tabular-nums text-sm whitespace-nowrap">
                    {profit?.hasPrices ? (
                      <span className={profit.netProfit >= 0 ? 'text-success' : 'text-error'}>
                        {formatPercent(profit.margin)}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                  <td onClick={stopRowToggle}>
                    {row.isRoot && row.rootId ? (
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
      <p className="text-[10px] text-base-content/40 px-4 pb-3 pt-2 sm:px-5">
        Job time follows the shared slot schedule. Editing hours converts to runs using this BPO&apos;s
        concurrent copies.
      </p>
    </PlanChainSection>
  )
}
