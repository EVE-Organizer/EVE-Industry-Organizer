import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { Tooltip } from '@/components/Tooltip'
import { PlanOwnerPicker, type PlanOwnerOption } from '@/components/plan/PlanOwnerPicker'
import { stopRowToggle } from '@/components/plan/PlanTreeLines'
import { ScoreBar } from '@/pages/Plan/ScoreBar'
import {
  BposInput,
  DurationInput,
  FooterTotalsDurationInput,
  FooterTotalsReadyByInput,
  DuplicateIcon,
  GripIcon,
  ProductCell,
  PlanReadyByCell,
  PlanRunsCell,
  RootRunsInput,
  ReadOnlyJobsBposInput,
  ReadOnlyRootBposInput,
  ReadOnlyJobsRunsInput,
  ReadOnlyJobsTimeInput,
  RemoveIcon,
  VolumeCell,
} from '@/pages/Plan/planJobsTableCells'
import { rowDurationHours, type BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'
import {
  DEFAULT_PRODUCT_COLUMN_WIDTH,
  planJobsColumnAlign,
  planJobsDefaultColumnWidth,
  PLAN_JOBS_ACTIONS_COLUMN_WIDTH,
  PLAN_JOBS_ACTIONS_MAX_WIDTH,
  PLAN_JOBS_ACTIONS_MIN_WIDTH,
  PLAN_JOBS_COLUMN_SPECS,
  PLAN_PRODUCT_MAX_WIDTH,
  PLAN_PRODUCT_MIN_WIDTH,
  type PlanJobsColumnId,
  type PlanJobsTimeMode,
} from '@/pages/Plan/planJobsTableLayout'
import { nodeSetupCost, planBuildVsBuySummary } from '@/pages/Plan/planBuildVsBuy'
import { volumeM3 } from '@/pages/Plan/planHaulVolume'
import type { RootProfitRow } from '@/pages/Plan/planProfit'
import {
  formatDecimal,
  formatGraphQuantity,
  formatIsk,
  formatPercent,
  formatVolumeM3,
} from '@/lib/profit'
import { textLinkClass } from '@/lib/textLink'
import type { PlanCharacterKey, PlanDurationMode } from '@/types'

export type PlanJobsColumnsPreset = 'core' | 'full'

const COLUMN_META: Record<PlanJobsColumnId, { label: string; tooltip?: string }> = {
  runs: {
    label: 'Runs',
    tooltip:
      'Manufacturing runs. Editable on roots in Production mode only. Overall adjusts runs from Duration.',
  },
  duration: {
    label: 'Duration',
    tooltip: 'Job timer for this blueprint. Changing it recalculates runs.',
  },
  bpos: {
    label: 'BPOs',
    tooltip:
      'Blueprint originals running this job in parallel. Suggested counts are not applied until you accept them.',
  },
  owner: { label: 'Owner', tooltip: 'Who builds this job. Auto lets the planner choose.' },
  progress: {
    label: 'Progress',
    tooltip: 'Steps done from ESI jobs and stock since the plan started',
  },
  output: { label: 'Output' },
  volume: {
    label: 'Volume',
    tooltip: 'Packed cargo volume of scheduled output (SDE m³ × output units)',
  },
  setup: {
    label: 'Setup',
    tooltip: 'Build/buy chain cost for this job (roots include haul when enabled)',
  },
  profit: { label: 'Profit' },
  margin: { label: 'Margin' },
}

export interface PlanJobsFooterTotals {
  totalDurationHours: number | null
  /** Latest ready-by deadline, or scheduled finish when none set. */
  totalReadyByHours: number | null
  totalOutputQty: number
  totalSetupCost: number | null
  totalNetProfit: number | null
  totalMargin: number | null
}

export interface PlanJobsTableMeta {
  collapsed: Set<string>
  profitByRootId?: Map<string, RootProfitRow>
  typeVolumes: Map<number, number>
  readOnly: boolean
  canReorder: boolean
  ownerOptions: PlanOwnerOption[]
  totalRuns: number
  totalVolumeM3: number
  footerTotals: PlanJobsFooterTotals
  timeMode: PlanJobsTimeMode
  columnsPreset: PlanJobsColumnsPreset
  durationMode: PlanDurationMode
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  onOpenSetup?: (rootId: string) => void
  onOpenProfit?: (rootId: string) => void
  onChange?: (
    rootId: string | undefined,
    productTypeId: number,
    patch: { runs?: number; productionDurationHours?: number },
  ) => void
  onSetOwner?: (target: { rootId?: string; productTypeId: number }, key?: PlanCharacterKey) => void
  onSetBpos?: (productTypeId: number, copies: number) => void
  onSetCopyBpos?: (productTypeId: number, copies: number) => void
  onSetReadyBy?: (rootId: string, hours: number | undefined) => void
  onApplyDeadline?: (rootId: string) => void
  onDuplicate?: (rootId: string) => void
  onRemove?: (rootId: string) => void
  onToggleEnabled?: (rootId: string, enabled: boolean) => void
  onReorder?: (fromRootId: string, toRootId: string) => void
  draggingRootId: string | null
  setDraggingRootId: (id: string | null) => void
  dragOverRootId: string | null
  setDragOverRootId: (id: string | null) => void
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface TableMeta<TData> extends PlanJobsTableMeta {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    tooltip?: string
    align?: 'left' | 'right' | 'center'
  }
}

const columnHelper = createColumnHelper<BuildBlueprintRow>()

function tableMeta(table: { options: { meta?: PlanJobsTableMeta } }): PlanJobsTableMeta {
  return table.options.meta!
}

function dataColumn(id: PlanJobsColumnId, size: number): ColumnDef<BuildBlueprintRow, unknown> {
  const meta = COLUMN_META[id]
  const spec = PLAN_JOBS_COLUMN_SPECS[id]
  return columnHelper.display({
    id,
    header: meta.label,
    size,
    minSize: spec.minWidth,
    maxSize: spec.maxWidth,
    enablePinning: id === 'margin' ? true : false,
    enableResizing: true,
    enableSorting: false,
    meta: { tooltip: meta.tooltip, align: spec.align },
    cell: ({ row, table }) => renderDataCell(id, row.original, tableMeta(table), row.id),
    footer: ({ table }) => renderFooterCell(id, tableMeta(table)),
  })
}

function footerClass(id: PlanJobsColumnId): string {
  const align = planJobsColumnAlign(id)
  return align === 'right'
    ? 'tabular-nums text-sm whitespace-nowrap text-right'
    : align === 'center'
      ? 'tabular-nums text-sm whitespace-nowrap text-center'
      : 'tabular-nums text-sm whitespace-nowrap'
}

function renderFooterCell(id: PlanJobsColumnId, meta: PlanJobsTableMeta) {
  const cls = footerClass(id)
  const foot = meta.footerTotals

  if (id === 'runs') {
    return <span className={cls}>{formatDecimal(meta.totalRuns, 0)}</span>
  }
  if (id === 'duration') {
    if (meta.timeMode === 'readyBy') {
      return foot.totalReadyByHours != null
        ? wrapCell(<FooterTotalsReadyByInput hours={foot.totalReadyByHours} />)
        : null
    }
    return foot.totalDurationHours != null
      ? wrapCell(<FooterTotalsDurationInput hours={foot.totalDurationHours} />)
      : null
  }
  if (id === 'output') {
    return <span className={cls}>{formatGraphQuantity(foot.totalOutputQty)}</span>
  }
  if (id === 'volume') {
    return <span className={cls}>{formatVolumeM3(meta.totalVolumeM3)}</span>
  }
  if (id === 'setup') {
    return foot.totalSetupCost != null ? (
      <span className={cls}>{formatIsk(foot.totalSetupCost)}</span>
    ) : null
  }
  if (id === 'profit') {
    return foot.totalNetProfit != null ? (
      <span className={`${cls} font-medium`}>{formatIsk(foot.totalNetProfit)}</span>
    ) : null
  }
  if (id === 'margin') {
    return foot.totalMargin != null ? (
      <span className={`${cls} ${(foot.totalNetProfit ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
        {formatPercent(foot.totalMargin)}
      </span>
    ) : null
  }
  return null
}

function wrapCell(content: ReactNode) {
  return <div className="plan-jobs-table__cell-inner">{content}</div>
}

function renderDataCell(
  id: PlanJobsColumnId,
  row: BuildBlueprintRow,
  meta: PlanJobsTableMeta,
  rowKey: string,
) {
  const profit = row.rootId ? meta.profitByRootId?.get(row.rootId) : undefined
  const align = planJobsColumnAlign(id)
  const numClass =
    align === 'right' ? 'tabular-nums text-sm whitespace-nowrap' : 'tabular-nums text-sm'

  switch (id) {
    case 'runs': {
      const runsEditable =
        row.isRoot &&
        row.rootId &&
        !meta.readOnly &&
        meta.onChange &&
        meta.timeMode !== 'readyBy' &&
        meta.durationMode !== 'overall'
      const fromDuration =
        row.isRoot && row.runsFromDuration === true && meta.timeMode !== 'readyBy'

      return wrapCell(
        <div className="w-full min-w-0" onClick={stopRowToggle}>
          {runsEditable ? (
            <RootRunsInput
              key={`${rowKey}-runs`}
              runs={row.runs}
              ariaLabel={`Runs for ${row.name}`}
              onCommit={(runs) => meta.onChange!(row.rootId, row.productTypeId, { runs })}
            />
          ) : !row.isRoot && meta.timeMode !== 'readyBy' ? (
            <ReadOnlyJobsRunsInput runs={row.runs} ariaLabel={`Runs for ${row.name}`} />
          ) : row.isRoot && meta.timeMode !== 'readyBy' ? (
            <ReadOnlyJobsRunsInput
              runs={row.runs}
              ariaLabel={`Runs for ${row.name}`}
              fromDuration={fromDuration}
              durationMode={meta.durationMode}
            />
          ) : (
            <PlanRunsCell
              runs={row.runs}
              fromReadyBy={row.runsFromReadyBy && meta.timeMode === 'readyBy'}
              align={planJobsColumnAlign('runs')}
            />
          )}
        </div>,
      )
    }
    case 'duration':
      if (meta.timeMode === 'readyBy' && meta.columnsPreset !== 'core') {
        return wrapCell(
          <div className="w-full min-w-0" onClick={stopRowToggle}>
            {renderReadyBy(row, meta)}
          </div>,
        )
      }
      return wrapCell(
        <div className="w-full min-w-0" onClick={stopRowToggle}>
          {meta.readOnly || !meta.onChange || !row.isRoot ? (
            <ReadOnlyJobsTimeInput
              hours={rowDurationHours(row)}
              ariaLabel={`Duration for ${row.name}`}
            />
          ) : (
            <DurationInput
              key={`${rowKey}-duration`}
              hours={rowDurationHours(row)}
              onCommit={(hours) =>
                meta.onChange!(row.rootId, row.productTypeId, { productionDurationHours: hours })
              }
            />
          )}
        </div>,
      )
    case 'bpos':
      return wrapCell(
        <div className="w-full" onClick={stopRowToggle}>
          {renderBpos(row, rowKey, meta)}
        </div>,
      )
    case 'owner':
      return wrapCell(
        <div className="flex w-full justify-center" onClick={stopRowToggle}>
          <PlanOwnerPicker
            options={meta.ownerOptions}
            value={row.characterKey}
            disabled={meta.readOnly || !meta.onSetOwner}
            label={`Owner of ${row.name}`}
            onChange={(key) =>
              meta.onSetOwner?.({ rootId: row.rootId, productTypeId: row.productTypeId }, key)
            }
          />
        </div>,
      )
    case 'progress':
      return wrapCell(
        row.progress ? (
          <Tooltip
            text={`${row.progress.done} of ${row.progress.total} steps done`}
            placement="top"
          >
            <div className="min-w-0 w-full">
              <ScoreBar
                value={row.progress.percent}
                max={100}
                done={row.progress.done}
                total={row.progress.total}
                runningPercent={row.progress.runningPercent ?? 0}
                accent={row.progress.percent >= 100 ? 'bg-success' : 'bg-info'}
              />
            </div>
          </Tooltip>
        ) : (
          <span className="opacity-30">—</span>
        ),
      )
    case 'output':
      return wrapCell(
        <span className={`${numClass} opacity-80`}>{formatGraphQuantity(row.outputQty)}</span>,
      )
    case 'volume':
      return wrapCell(
        <VolumeCell
          volumeM3={volumeM3(row.productTypeId, row.outputQty, meta.typeVolumes)}
          unitVolumeM3={meta.typeVolumes.get(row.productTypeId) ?? 0}
        />,
      )
    case 'setup': {
      const childSetup = !row.isRoot ? nodeSetupCost(row.node) : null
      const childSetupTip =
        childSetup != null
          ? (planBuildVsBuySummary(row.node) ??
            (row.node.mode === 'buy'
              ? 'Market buy for this component'
              : 'Rolled-up build/buy chain for this job'))
          : null

      return wrapCell(
        <div className="w-full" onClick={stopRowToggle}>
          {row.isRoot && profit?.hasPrices && row.rootId && meta.onOpenSetup ? (
            <button
              type="button"
              className={textLinkClass('tabular-nums text-sm whitespace-nowrap')}
              onClick={() => meta.onOpenSetup!(row.rootId!)}
              aria-label={`Setup cost breakdown for ${row.name}`}
            >
              {formatIsk(profit.setupCost)}
            </button>
          ) : row.isRoot && profit?.hasPrices ? (
            <span className="tabular-nums text-sm whitespace-nowrap">
              {formatIsk(profit.setupCost)}
            </span>
          ) : childSetup != null ? (
            childSetupTip ? (
              <Tooltip text={childSetupTip} placement="top">
                <span className="tabular-nums text-sm whitespace-nowrap cursor-help">
                  {formatIsk(childSetup)}
                </span>
              </Tooltip>
            ) : (
              <span className="tabular-nums text-sm whitespace-nowrap">
                {formatIsk(childSetup)}
              </span>
            )
          ) : (
            <span className={row.isRoot ? 'opacity-40' : 'opacity-30'}>—</span>
          )}
        </div>,
      )
    }
    case 'profit':
      return wrapCell(
        <div className="w-full" onClick={stopRowToggle}>
          {profit?.hasPrices && row.rootId && meta.onOpenProfit ? (
            <button
              type="button"
              className={textLinkClass(
                'tabular-nums text-sm font-medium whitespace-nowrap',
                profit.netProfit >= 0 ? 'text-success' : 'text-error',
              )}
              onClick={() => meta.onOpenProfit!(row.rootId!)}
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
        </div>,
      )
    case 'margin':
      return wrapCell(
        profit?.hasPrices ? (
          <span className={`${numClass} ${profit.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
            {formatPercent(profit.margin)}
          </span>
        ) : (
          <span className={row.isRoot ? 'opacity-40' : 'opacity-30'}>—</span>
        ),
      )
  }
}

function renderReadyBy(row: BuildBlueprintRow, meta: PlanJobsTableMeta) {
  if (!row.isRoot || !row.rootId) {
    return (
      <ReadOnlyJobsTimeInput
        hours={row.finishesAtHours}
        ariaLabel={`Scheduled finish for ${row.name}`}
      />
    )
  }
  return (
    <PlanReadyByCell
      key={`${row.rootId}-ready`}
      readyByHours={row.readyByHours}
      finishesAtHours={row.finishesAtHours}
      jobTimerHours={row.jobTimeHours}
      componentBuildCount={row.componentBuildCount ?? 0}
      readOnly={meta.readOnly || !meta.onSetReadyBy}
      onCommit={meta.onSetReadyBy ? (hours) => meta.onSetReadyBy!(row.rootId!, hours) : undefined}
      onApplyDeadline={meta.onApplyDeadline ? () => meta.onApplyDeadline!(row.rootId!) : undefined}
    />
  )
}

function renderBpos(row: BuildBlueprintRow, rowKey: string, meta: PlanJobsTableMeta) {
  if (row.bpos == null) return <span className="opacity-30">—</span>
  const suggestion =
    row.suggestedBpos != null && row.suggestedBpos !== row.bpos ? row.suggestedBpos : null
  const copySuggestion =
    row.suggestedCopyBpos != null && row.suggestedCopyBpos !== (row.copyBpos ?? 1)
      ? row.suggestedCopyBpos
      : null
  const bposInput =
    !row.isRoot && !meta.readOnly && meta.onSetBpos ? (
      <BposInput
        key={`${rowKey}-bpos`}
        bpos={row.bpos}
        onCommit={(copies) => meta.onSetBpos!(row.productTypeId, copies)}
      />
    ) : row.isRoot ? (
      <ReadOnlyRootBposInput />
    ) : (
      <ReadOnlyJobsBposInput bpos={row.bpos} ariaLabel={`Parallel BPOs for ${row.name}`} />
    )

  return (
    <div className="flex flex-col gap-0.5">
      {row.isRoot ? (
        <Tooltip text="Duplicate this job to run it on more BPOs" placement="top">
          <span className="block w-full">{bposInput}</span>
        </Tooltip>
      ) : (
        bposInput
      )}
      {suggestion != null && !row.isRoot && !meta.readOnly && meta.onSetBpos ? (
        <button
          type="button"
          className="text-[10px] text-info hover:underline text-left"
          onClick={() => meta.onSetBpos!(row.productTypeId, suggestion)}
        >
          suggest {suggestion}
        </button>
      ) : null}
      {copySuggestion != null && !row.isRoot && !meta.readOnly && meta.onSetCopyBpos ? (
        <button
          type="button"
          className="text-[10px] text-info hover:underline text-left"
          onClick={() => meta.onSetCopyBpos!(row.productTypeId, copySuggestion)}
        >
          copy {copySuggestion}
        </button>
      ) : null}
      {row.bposHint ? (
        <span className="text-[10px] text-warning/90 leading-tight">{row.bposHint}</span>
      ) : null}
    </div>
  )
}

export function buildPlanJobsColumns(input: {
  scrollColumnIds: PlanJobsColumnId[]
  pinnedRightIds: PlanJobsColumnId[]
  productWidth: number
  columnSizes: Partial<Record<PlanJobsColumnId | 'product' | 'actions', number>>
}): ColumnDef<BuildBlueprintRow, unknown>[] {
  const cols: ColumnDef<BuildBlueprintRow, unknown>[] = [
    columnHelper.display({
      id: 'product',
      header: 'Product',
      size: input.productWidth,
      minSize: PLAN_PRODUCT_MIN_WIDTH,
      maxSize: PLAN_PRODUCT_MAX_WIDTH,
      enablePinning: true,
      enableResizing: true,
      enableSorting: false,
      cell: ({ row, table }) => {
        const meta = tableMeta(table)
        const expanded =
          row.original.kind === 'parent' ? !meta.collapsed.has(row.original.collapseKey) : true
        const rowEnabled = row.original.enabled !== false
        return (
          <div className="plan-jobs-table__cell-inner plan-jobs-table__product-row flex min-w-0 items-center gap-1">
            {meta.canReorder && row.original.isRoot && row.original.rootId ? (
              <span
                role="button"
                tabIndex={0}
                className="plan-jobs-table__product-grip inline-flex shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
                aria-label={`Reorder ${row.original.name}`}
                draggable
                onClick={stopRowToggle}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', row.original.rootId!)
                  const tr = e.currentTarget.closest('tr')
                  if (tr) e.dataTransfer.setDragImage(tr, 24, 16)
                  meta.setDraggingRootId(row.original.rootId!)
                }}
                onDragEnd={() => {
                  meta.setDraggingRootId(null)
                  meta.setDragOverRootId(null)
                }}
              >
                <GripIcon />
              </span>
            ) : null}
            {row.original.isRoot &&
            row.original.rootId &&
            meta.onToggleEnabled &&
            !meta.readOnly ? (
              <Tooltip
                text={rowEnabled ? 'Included in the plan' : 'Off: left out of the plan'}
                placement="top"
              >
                <span
                  className="plan-jobs-table__product-toggle inline-flex shrink-0 items-center"
                  onClick={stopRowToggle}
                >
                  <input
                    type="checkbox"
                    role="switch"
                    className="toggle toggle-sm toggle-primary plan-jobs-table__product-toggle-input"
                    checked={rowEnabled}
                    aria-label={`${rowEnabled ? 'Disable' : 'Enable'} ${row.original.name}`}
                    onChange={(e) => meta.onToggleEnabled!(row.original.rootId!, e.target.checked)}
                  />
                </span>
              </Tooltip>
            ) : null}
            <div className="min-w-0 flex-1">
              <ProductCell
                row={row.original}
                expanded={expanded}
                onOpenGraph={meta.onOpenGraph}
                onOpenMeTe={meta.onOpenMeTe}
              />
            </div>
          </div>
        )
      },
      footer: () => <span className="opacity-70">Total</span>,
    }),
  ]

  for (const id of input.scrollColumnIds) {
    cols.push(dataColumn(id, input.columnSizes[id] ?? planJobsDefaultColumnWidth(id)))
  }
  for (const id of input.pinnedRightIds) {
    cols.push(dataColumn(id, input.columnSizes[id] ?? planJobsDefaultColumnWidth(id)))
  }

  cols.push(
    columnHelper.display({
      id: 'actions',
      header: '',
      size: input.columnSizes.actions ?? PLAN_JOBS_ACTIONS_COLUMN_WIDTH,
      minSize: PLAN_JOBS_ACTIONS_MIN_WIDTH,
      maxSize: PLAN_JOBS_ACTIONS_MAX_WIDTH,
      enablePinning: true,
      enableResizing: true,
      enableSorting: false,
      cell: ({ row, table }) => {
        const meta = tableMeta(table)
        if (!row.original.isRoot || !row.original.rootId || meta.readOnly) return null
        if (!meta.onDuplicate && !meta.onRemove) return null
        return (
          <div className="plan-jobs-table__actions-cell" onClick={stopRowToggle}>
            <div
              className="plan-jobs-table__actions-toolbar"
              role="group"
              aria-label={`Actions for ${row.original.name}`}
            >
              {meta.onDuplicate ? (
                <Tooltip text="Duplicate job" placement="left">
                  <button
                    type="button"
                    className="plan-jobs-table__action-btn"
                    aria-label={`Duplicate ${row.original.name}`}
                    onClick={() => meta.onDuplicate!(row.original.rootId!)}
                  >
                    <DuplicateIcon />
                  </button>
                </Tooltip>
              ) : null}
              {meta.onRemove ? (
                <Tooltip text="Remove root" placement="left">
                  <button
                    type="button"
                    className="plan-jobs-table__action-btn plan-jobs-table__action-btn--danger"
                    aria-label={`Remove ${row.original.name}`}
                    onClick={() => meta.onRemove!(row.original.rootId!)}
                  >
                    <RemoveIcon />
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        )
      },
      footer: () => null,
    }),
  )

  return cols
}

export function planJobsDefaultColumnSize(id: PlanJobsColumnId | 'product' | 'actions'): number {
  if (id === 'product') return DEFAULT_PRODUCT_COLUMN_WIDTH
  if (id === 'actions') return PLAN_JOBS_ACTIONS_COLUMN_WIDTH
  return planJobsDefaultColumnWidth(id)
}

export function columnMetaLabel(header: { column: { id: string } }): string {
  const id = header.column.id as PlanJobsColumnId | 'product' | 'actions'
  if (id === 'product' || id === 'actions') return id === 'product' ? 'Product' : 'Actions'
  return COLUMN_META[id]?.label ?? id
}
