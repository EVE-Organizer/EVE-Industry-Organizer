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
import { formatDecimal, formatGraphQuantity } from '@/lib/profit'

export type BuildBlueprintRow = ExpandablePlanRow & {
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
  onChange: (productTypeId: number, patch: { runs?: number; productionDurationHours?: number }) => void
  onRemove: (productTypeId: number) => void
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
  const display = draft ?? String(formatDecimal(hours, 2))

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
        <div className="min-w-0">
          <span className="text-sm font-medium truncate block" title={row.name}>
            {row.name}
          </span>
          <p className="text-[11px] opacity-50 tabular-nums mt-0.5 leading-snug">
            {row.childCount} sub-builds
          </p>
        </div>
        {row.isRoot ? (
          <span className="badge badge-primary badge-xs shrink-0">Root</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 min-w-0 py-0.5">
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
      {row.isRoot ? <span className="badge badge-primary badge-xs shrink-0">Root</span> : null}
    </div>
  )
}

export function PlanRootList({ rows, onChange, onRemove }: PlanRootListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const visibleRows = useMemo(
    () => rows.filter((row) => isExpandableRowVisible(row, collapsed)),
    [rows, collapsed],
  )

  const rootCount = useMemo(() => rows.filter((row) => row.isRoot).length, [rows])
  const summary = useMemo(() => {
    const totalRuns = rows.reduce((sum, row) => sum + row.runs, 0)
    const totalHours = rows.reduce((sum, row) => sum + row.jobTimeHours, 0)
    return `${formatDecimal(totalRuns, 0)} runs · ${formatDecimal(totalHours, 1)} h scheduled`
  }, [rows])

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
      count={rows.length}
      summary={rows.length > 0 ? summary : `${rootCount} roots`}
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
        <table className="table table-compact w-full plan-jobs-table">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide opacity-50">
              <th>Product</th>
              <th className="w-[5.5rem]">
                <Tooltip text="Manufacturing runs for this job" placement="top">
                  <span className="cursor-help border-b border-dotted border-current/40">Runs</span>
                </Tooltip>
              </th>
              <th className="w-[5.5rem]">
                <Tooltip
                  text="Wall-clock hours after industry slots are shared across the plan"
                  placement="top"
                >
                  <span className="cursor-help border-b border-dotted border-current/40">Job time</span>
                </Tooltip>
              </th>
              <th className="text-right w-[5rem]">Output</th>
              <th className="w-8" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isParentRow = row.kind === 'parent' || row.depth === 0
              const expanded = row.kind === 'parent' ? !collapsed.has(row.collapseKey) : true
              const rowToggle =
                row.kind === 'parent'
                  ? expandableRowProps(expanded, row.name, () => toggleCollapse(row.collapseKey))
                  : null
              return (
                <tr
                  key={row.productTypeId}
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
                      onChange={(e) => onChange(row.productTypeId, { runs: Number(e.target.value) })}
                    />
                  </td>
                  <td onClick={stopRowToggle}>
                    <div className="flex items-center gap-1 max-w-[5.5rem]">
                      <JobTimeInput
                        hours={row.jobTimeHours}
                        onCommit={(productionDurationHours) =>
                          onChange(row.productTypeId, { productionDurationHours })
                        }
                      />
                      <span className="text-[10px] opacity-50 shrink-0">h</span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums text-sm opacity-80">
                    {formatGraphQuantity(row.outputQty)}
                  </td>
                  <td onClick={stopRowToggle}>
                    {row.isRoot ? (
                      <Tooltip text="Remove root" placement="left">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square text-error"
                          aria-label={`Remove ${row.name}`}
                          onClick={() => onRemove(row.productTypeId)}
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
      )}
      <p className="text-[10px] text-base-content/40 px-4 pb-3 pt-2 sm:px-5">
        Job time follows the shared slot schedule. Editing hours converts to runs using this BPO&apos;s
        concurrent copies.
      </p>
    </PlanChainSection>
  )
}
