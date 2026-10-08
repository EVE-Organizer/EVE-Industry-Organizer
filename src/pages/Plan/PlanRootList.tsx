import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { Tooltip } from '@/components/Tooltip'
import { PlanSectionExpandActions } from '@/pages/Plan/PlanChainSection'
import { expandableCollapseKeys, isExpandableRowVisible } from '@/pages/Plan/planTreeLines'
import { formatDecimal, formatDurationHms, formatVolumeM3 } from '@/lib/profit'
import { volumeM3 } from '@/pages/Plan/planHaulVolume'
import { PlanJobsTable } from '@/pages/Plan/PlanJobsTable'
import { computePlanJobsFooterTotals } from '@/pages/Plan/planJobsFooterTotals'
import { SetAllDurationInput } from '@/pages/Plan/planJobsTableCells'
import type { BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'
import {
  filterLayoutToCoreColumns,
  loadPlanJobsCoreLayout,
  savePlanJobsLayout,
  type PlanJobsTableLayout,
} from '@/pages/Plan/planJobsTableLayout'
import type { PlanOwnerOption } from '@/components/plan/PlanOwnerPicker'
import type { RootProfitRow } from '@/pages/Plan/planProfit'
import type { PlanCharacterKey, PlanDurationMode, TypeInfo } from '@/types'

export type { BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'

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
    patch: { runs?: number; productionDurationHours?: number },
  ) => void
  onSetAllDuration?: (hours: number, mode: PlanDurationMode) => void
  durationMode?: PlanDurationMode
  onDurationModeChange?: (mode: PlanDurationMode) => void
  onDuplicate?: (rootId: string) => void
  onToggleEnabled?: (rootId: string, enabled: boolean) => void
  onRemove?: (rootId: string) => void
  onReorder?: (fromRootId: string, toRootId: string) => void
  onSetBpos?: (productTypeId: number, copies: number) => void
  onSetCopyBpos?: (productTypeId: number, copies: number) => void
  ownerOptions?: PlanOwnerOption[]
  onSetOwner?: (target: { rootId?: string; productTypeId: number }, key?: PlanCharacterKey) => void
  planWindowHours?: number
  typeMap: Map<number, TypeInfo>
  /** Search / price controls rendered above the jobs header in the same card. */
  compose?: ReactNode
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
  durationMode = 'production',
  onDurationModeChange,
  onDuplicate,
  onToggleEnabled,
  onRemove,
  onReorder,
  onSetBpos,
  onSetCopyBpos,
  ownerOptions = [],
  onSetOwner,
  planWindowHours,
  typeMap,
  compose,
}: PlanRootListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const overallMode = durationMode === 'overall'
  const [layout, setLayout] = useState<PlanJobsTableLayout>(() => loadPlanJobsCoreLayout())

  useEffect(() => {
    savePlanJobsLayout(layout)
  }, [layout])

  const setLayoutCore = useCallback((action: SetStateAction<PlanJobsTableLayout>) => {
    setLayout((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      return filterLayoutToCoreColumns(next)
    })
  }, [])

  const visibleRows = useMemo(
    () => rows.filter((row) => isExpandableRowVisible(row, collapsed)),
    [rows, collapsed],
  )

  const rootRows = useMemo(() => rows.filter((row) => row.isRoot), [rows])
  const rootCount = rootRows.length
  const enabledRoots = useMemo(() => rootRows.filter((row) => row.enabled !== false), [rootRows])
  const canReorder = !readOnly && !!onReorder && rootCount > 1
  const typeVolumes = useMemo(() => {
    const map = new Map<number, number>()
    for (const [id, type] of typeMap) map.set(id, type.volume)
    return map
  }, [typeMap])
  const totalRuns = useMemo(
    () => enabledRoots.reduce((sum, row) => sum + row.runs, 0),
    [enabledRoots],
  )
  const totalVolumeM3 = useMemo(
    () =>
      rows
        .filter((row) => row.enabled !== false)
        .reduce((sum, row) => sum + volumeM3(row.productTypeId, row.outputQty, typeVolumes), 0),
    [rows, typeVolumes],
  )
  const enabledRows = useMemo(() => rows.filter((row) => row.enabled !== false), [rows])
  const footerTotals = useMemo(
    () =>
      computePlanJobsFooterTotals({
        enabledRows,
        enabledRoots,
        profitByRootId,
      }),
    [enabledRows, enabledRoots, profitByRootId],
  )

  const summary = useMemo(() => {
    const off = rootCount - enabledRoots.length
    const timeHours = overallMode
      ? (planWindowHours ?? 0)
      : enabledRoots.reduce((sum, row) => sum + row.jobTimeHours, 0)
    const timeLabel = overallMode ? 'until last product' : 'scheduled'
    const scheduled = `${formatDecimal(totalRuns, 0)} runs · ${formatDurationHms(timeHours * 3600)} ${timeLabel} · ${formatVolumeM3(totalVolumeM3)}`
    return off > 0 ? `${scheduled} · ${off} off` : scheduled
  }, [enabledRoots, overallMode, planWindowHours, rootCount, totalRuns, totalVolumeM3])

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
    <section className="plan-build-card min-w-0 w-full">
      {compose}
      <div className="plan-build-card__header">
        <h2 className="plan-build-card__title">Production jobs</h2>
        <span className="plan-build-card__badge">{rootCount}</span>
        {rootCount > 0 ? (
          <p className="text-[11px] leading-none text-base-content/50 tabular-nums">{summary}</p>
        ) : null}
        {rows.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="join">
              <button
                type="button"
                className={`btn btn-ghost btn-xs join-item ${!overallMode ? 'btn-active' : ''}`}
                onClick={() => onDurationModeChange?.('production')}
              >
                Production
              </button>
              <button
                type="button"
                className={`btn btn-ghost btn-xs join-item ${overallMode ? 'btn-active' : ''}`}
                onClick={() => onDurationModeChange?.('overall')}
              >
                Overall
              </button>
            </div>
            {onSetAllDuration && !readOnly ? (
              <label className="flex items-center gap-1.5">
                <Tooltip
                  text={
                    overallMode
                      ? "Writes this duration as each root's ready-by deadline and shrinks runs if the chain would finish late. The number you type is kept."
                      : 'Writes this duration as the job timer for every blueprint. Runs update. The number you type is kept.'
                  }
                  placement="bottom"
                >
                  <span className="text-[11px] font-normal normal-case tracking-normal opacity-55 whitespace-nowrap cursor-help border-b border-dotted border-current/40">
                    Set all
                  </span>
                </Tooltip>
                <SetAllDurationInput
                  onCommit={(hours) =>
                    onSetAllDuration(hours, overallMode ? 'overall' : 'production')
                  }
                />
              </label>
            ) : null}
            <PlanSectionExpandActions onExpandAll={expandAll} onCollapseAll={collapseAll} />
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-base-content/50 px-4 py-8 text-center sm:px-5">
          No blueprints yet. Search above to add a root product.
        </p>
      ) : (
        <PlanJobsTable
          columnsPreset="core"
          durationMode={durationMode}
          visibleRows={visibleRows}
          layout={layout}
          setLayout={setLayoutCore}
          showOwner={!!onSetOwner}
          showProgress={false}
          typeVolumes={typeVolumes}
          totalRuns={totalRuns}
          totalVolumeM3={totalVolumeM3}
          footerTotals={footerTotals}
          readOnly={readOnly}
          canReorder={canReorder}
          profitByRootId={profitByRootId}
          ownerOptions={ownerOptions}
          collapsed={collapsed}
          onOpenGraph={onOpenGraph}
          onOpenMeTe={onOpenMeTe}
          onOpenSetup={onOpenSetup}
          onOpenProfit={onOpenProfit}
          onChange={onChange}
          onSetBpos={onSetBpos}
          onSetCopyBpos={onSetCopyBpos}
          onSetOwner={onSetOwner}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onToggleEnabled={onToggleEnabled}
          onReorder={onReorder}
          onToggleCollapse={toggleCollapse}
        />
      )}
      <p className="text-[10px] text-base-content/40 px-4 pb-3 pt-2 sm:px-5">
        {overallMode
          ? 'Overall uses your stored duration as the ready-by deadline and shrinks runs if the chain would finish late. The duration number stays put. Copy and invention are not counted.'
          : "Production uses your stored duration as this job's industry timer and sets runs from that. The duration number stays put."}
      </p>
    </section>
  )
}
