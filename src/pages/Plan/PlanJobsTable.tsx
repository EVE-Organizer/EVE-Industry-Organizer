import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  useReactTable,
  type ColumnOrderState,
  type ColumnSizingState,
  type Updater,
} from '@tanstack/react-table'
import { Tooltip, useAnchorTooltip } from '@/components/Tooltip'
import {
  expandableRowProps,
  planTableRowClass,
  stopRowToggle,
} from '@/components/plan/PlanTreeLines'
import type { PlanOwnerOption } from '@/components/plan/PlanOwnerPicker'
import {
  buildPlanJobsColumns,
  type PlanJobsFooterTotals,
  type PlanJobsTableMeta,
} from '@/pages/Plan/planJobsTableColumns'
import { planJobsPinningStyles } from '@/pages/Plan/planJobsTablePinning'
import type { BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'
import {
  CORE_PLAN_JOBS_SCROLL_ORDER,
  DEFAULT_PRODUCT_COLUMN_WIDTH,
  isPinnedPlanJobsColumn,
  PLAN_JOBS_ACTIONS_COLUMN_WIDTH,
  PLAN_JOBS_PINNED_RIGHT,
  resizePlanActionsColumn,
  resizePlanJobsColumn,
  resizePlanProductColumn,
  planJobsDefaultColumnWidth,
  planJobsTableColumnClass,
  type PlanJobsColumnId,
  type PlanJobsTableLayout,
  type PlanJobsTimeMode,
} from '@/pages/Plan/planJobsTableLayout'
import type { PlanJobsColumnsPreset } from '@/pages/Plan/planJobsTableColumns'
import type { RootProfitRow } from '@/pages/Plan/planProfit'
import type { PlanDurationMode } from '@/types'

const CORE_DURATION_HEADER_TOOLTIP = {
  production:
    "Your target duration. Production uses it as this job's industry timer. Switching modes does not change this number.",
  overall:
    'Your target duration. Overall uses it as the ready-by deadline. Switching modes does not change this number.',
} as const
const TIME_MODE_OPTIONS: { id: PlanJobsTimeMode; label: string; tooltip: string }[] = [
  {
    id: 'duration',
    label: 'Duration',
    tooltip: 'Job timer for this blueprint. Changing it recalculates how many runs fit.',
  },
  {
    id: 'readyBy',
    label: 'Ready by',
    tooltip:
      'When this product should be finished. Setting it rescales runs so the chain meets that time. Fill uses spare time; Fix catches up when the chain is late.',
  },
]

function TimeModeHeader({
  mode,
  onChange,
}: {
  mode: PlanJobsTimeMode
  onChange: (mode: PlanJobsTimeMode) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const current = TIME_MODE_OPTIONS.find((option) => option.id === mode) ?? TIME_MODE_OPTIONS[0]
  const { ref: tooltipRef, triggerProps, TooltipPortal } = useAnchorTooltip('top')

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      zIndex: 120,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      anchorRef.current = node
      tooltipRef(node)
    },
    [tooltipRef],
  )

  return (
    <>
      <button
        ref={setTriggerRef}
        type="button"
        tabIndex={0}
        {...triggerProps}
        className="plan-jobs-table__time-mode-btn relative z-[2] inline-flex max-w-full cursor-pointer items-center gap-0.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Time column: ${current.label}. Click to switch Duration or Ready by.`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
      >
        <span className="truncate border-b border-dotted border-current/40">{current.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="size-3 shrink-0 opacity-70"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <TooltipPortal content={current.tooltip} />
      {open
        ? createPortal(
            <ul
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="menu w-40 rounded-lg border border-eve-border bg-base-200 p-1 shadow-lg"
              onClick={stopRowToggle}
            >
              {TIME_MODE_OPTIONS.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className={option.id === mode ? 'active' : ''}
                    onClick={(event) => {
                      event.stopPropagation()
                      onChange(option.id)
                      setOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  )
}

function pinningCellClass(columnId: string, isHead: boolean): string {
  const pinned = columnId === 'product' || columnId === 'margin' || columnId === 'actions'
  if (!pinned) return ''
  return [
    'plan-jobs-table__pinned',
    isHead ? 'plan-jobs-table__pinned--head' : '',
    columnId === 'product'
      ? 'plan-jobs-table__sticky-left'
      : columnId === 'margin'
        ? 'plan-jobs-table__sticky-right-edge'
        : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function layoutToSizing(layout: PlanJobsTableLayout): ColumnSizingState {
  const sizing: ColumnSizingState = {
    product: layout.productWidth ?? DEFAULT_PRODUCT_COLUMN_WIDTH,
    actions: layout.actionsWidth ?? PLAN_JOBS_ACTIONS_COLUMN_WIDTH,
  }
  const ids: PlanJobsColumnId[] = [
    'runs',
    'duration',
    'bpos',
    'owner',
    'progress',
    'output',
    'volume',
    'setup',
    'profit',
    'margin',
  ]
  for (const id of ids) {
    sizing[id] = layout.widths[id] ?? planJobsDefaultColumnWidth(id)
  }
  return sizing
}

function sizingToLayout(prev: PlanJobsTableLayout, sizing: ColumnSizingState): PlanJobsTableLayout {
  let next = prev
  if (sizing.product != null) {
    next = resizePlanProductColumn(next, sizing.product)
  }
  if (sizing.actions != null) {
    next = resizePlanActionsColumn(next, sizing.actions)
  }
  for (const [key, width] of Object.entries(sizing)) {
    if (key === 'product' || key === 'actions' || width == null) continue
    next = resizePlanJobsColumn(next, key as PlanJobsColumnId, width)
  }
  return next
}

export interface PlanJobsTableProps {
  visibleRows: BuildBlueprintRow[]
  layout: PlanJobsTableLayout
  setLayout: React.Dispatch<React.SetStateAction<PlanJobsTableLayout>>
  columnsPreset?: PlanJobsColumnsPreset
  durationMode?: PlanDurationMode
  showOwner: boolean
  showProgress: boolean
  typeVolumes: Map<number, number>
  totalRuns: number
  totalVolumeM3: number
  footerTotals: PlanJobsFooterTotals
  readOnly: boolean
  canReorder: boolean
  profitByRootId?: Map<string, RootProfitRow>
  ownerOptions: PlanOwnerOption[]
  collapsed: Set<string>
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  onOpenSetup?: (rootId: string) => void
  onOpenProfit?: (rootId: string) => void
  onChange?: PlanJobsTableMeta['onChange']
  onSetOwner?: PlanJobsTableMeta['onSetOwner']
  onSetBpos?: PlanJobsTableMeta['onSetBpos']
  onSetCopyBpos?: PlanJobsTableMeta['onSetCopyBpos']
  onSetReadyBy?: PlanJobsTableMeta['onSetReadyBy']
  onApplyDeadline?: PlanJobsTableMeta['onApplyDeadline']
  onDuplicate?: (rootId: string) => void
  onRemove?: (rootId: string) => void
  onToggleEnabled?: (rootId: string, enabled: boolean) => void
  onReorder?: (fromRootId: string, toRootId: string) => void
  onToggleCollapse: (key: string) => void
}

export function PlanJobsTable({
  visibleRows,
  layout,
  setLayout,
  columnsPreset = 'full',
  durationMode = 'production',
  showOwner,
  showProgress,
  typeVolumes,
  totalRuns,
  totalVolumeM3,
  footerTotals,
  readOnly,
  canReorder,
  profitByRootId,
  ownerOptions,
  collapsed,
  onOpenGraph,
  onOpenMeTe,
  onOpenSetup,
  onOpenProfit,
  onChange,
  onSetOwner,
  onSetBpos,
  onSetCopyBpos,
  onSetReadyBy,
  onApplyDeadline,
  onDuplicate,
  onRemove,
  onToggleEnabled,
  onReorder,
  onToggleCollapse,
}: PlanJobsTableProps) {
  const [draggingRootId, setDraggingRootId] = useState<string | null>(null)
  const [dragOverRootId, setDragOverRootId] = useState<string | null>(null)
  const timeMode: PlanJobsTimeMode =
    columnsPreset === 'core' ? 'duration' : layout.timeMode === 'readyBy' ? 'readyBy' : 'duration'

  const scrollColumnIds = useMemo(() => {
    if (columnsPreset === 'core') return [...CORE_PLAN_JOBS_SCROLL_ORDER]
    return layout.order.filter(
      (id) =>
        !isPinnedPlanJobsColumn(id) &&
        (id !== 'owner' || showOwner) &&
        (id !== 'progress' || showProgress),
    )
  }, [columnsPreset, layout.order, showOwner, showProgress])

  const pinnedRightIds = useMemo(
    () =>
      PLAN_JOBS_PINNED_RIGHT.filter(
        (id) => (id !== 'owner' || showOwner) && (id !== 'progress' || showProgress),
      ),
    [showOwner, showProgress],
  )

  const columnOrder = useMemo(
    (): ColumnOrderState => ['product', ...scrollColumnIds, ...pinnedRightIds, 'actions'],
    [scrollColumnIds, pinnedRightIds],
  )

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => layoutToSizing(layout))

  useEffect(() => {
    setColumnSizing(layoutToSizing(layout))
  }, [layout])

  const columns = useMemo(
    () =>
      buildPlanJobsColumns({
        scrollColumnIds,
        pinnedRightIds,
        productWidth: layout.productWidth ?? DEFAULT_PRODUCT_COLUMN_WIDTH,
        columnSizes: {
          ...layout.widths,
          product: layout.productWidth,
          actions: layout.actionsWidth ?? PLAN_JOBS_ACTIONS_COLUMN_WIDTH,
        },
      }),
    [scrollColumnIds, pinnedRightIds, layout],
  )

  const tableMeta = useMemo(
    (): PlanJobsTableMeta => ({
      collapsed,
      profitByRootId,
      typeVolumes,
      readOnly,
      canReorder,
      ownerOptions,
      totalRuns,
      totalVolumeM3,
      footerTotals,
      timeMode,
      columnsPreset,
      durationMode,
      onOpenGraph,
      onOpenMeTe,
      onOpenSetup,
      onOpenProfit,
      onChange,
      onSetOwner,
      onSetBpos,
      onSetCopyBpos,
      onSetReadyBy,
      onApplyDeadline,
      onDuplicate,
      onRemove,
      onToggleEnabled,
      onReorder,
      draggingRootId,
      setDraggingRootId,
      dragOverRootId,
      setDragOverRootId,
    }),
    [
      collapsed,
      profitByRootId,
      typeVolumes,
      readOnly,
      canReorder,
      ownerOptions,
      totalRuns,
      totalVolumeM3,
      footerTotals,
      timeMode,
      columnsPreset,
      durationMode,
      onOpenGraph,
      onOpenMeTe,
      onOpenSetup,
      onOpenProfit,
      onChange,
      onSetOwner,
      onSetBpos,
      onSetCopyBpos,
      onSetReadyBy,
      onApplyDeadline,
      onDuplicate,
      onRemove,
      onToggleEnabled,
      onReorder,
      draggingRootId,
      dragOverRootId,
    ],
  )

  const onColumnSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((prev) => {
        const next = functionalUpdate(updater, prev)
        setLayout((layoutPrev) => sizingToLayout(layoutPrev, next))
        return next
      })
    },
    [setLayout],
  )

  const table = useReactTable<BuildBlueprintRow>({
    data: visibleRows,
    columns,
    state: {
      columnOrder,
      columnSizing,
      columnPinning: { left: ['product'], right: [...pinnedRightIds, 'actions'] },
    },
    onColumnSizingChange,
    columnResizeMode: 'onChange',
    enableColumnPinning: true,
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    meta: tableMeta,
  })

  const tableWidth = table.getTotalSize()

  return (
    <div className="plan-jobs-table-scroll w-full min-w-0 max-w-full overflow-x-auto">
      <table
        className="table table-compact plan-jobs-table w-full"
        style={{ width: '100%', minWidth: tableWidth }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="text-[11px] uppercase tracking-wide">
              {headerGroup.headers.map((header) => {
                const colId = header.column.id
                const meta = header.column.columnDef.meta as
                  | { tooltip?: string; align?: 'left' | 'right' | 'center' }
                  | undefined
                const label = flexRender(header.column.columnDef.header, header.getContext())

                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={planJobsPinningStyles(header.column, 'head')}
                    className={`plan-jobs-table__col-header relative select-none text-base-content/50 ${colId === 'duration' || colId === 'margin' ? 'overflow-visible' : 'overflow-hidden'} ${pinningCellClass(colId, true)} ${planJobsTableColumnClass(colId, timeMode)}${
                      colId === 'duration' ? ' plan-jobs-table__col-header--time' : ''
                    }${colId === 'margin' ? ' plan-jobs-table__col-header--margin' : ''}${pinningCellClass(colId, true).includes('plan-jobs-table__pinned') ? ' !text-base-content/70' : ''}`}
                    aria-label={colId === 'actions' ? 'Actions' : undefined}
                  >
                    <span
                      className={
                        colId === 'duration'
                          ? 'block min-w-0 overflow-visible pr-3'
                          : colId === 'margin' || colId === 'actions'
                            ? 'block whitespace-nowrap pr-3'
                            : 'block min-w-0 truncate pr-3'
                      }
                    >
                      {colId === 'duration' && columnsPreset === 'core' ? (
                        <Tooltip
                          text={
                            durationMode === 'overall'
                              ? CORE_DURATION_HEADER_TOOLTIP.overall
                              : CORE_DURATION_HEADER_TOOLTIP.production
                          }
                          placement="top"
                        >
                          <span className="cursor-help border-b border-dotted border-current/40 truncate">
                            Duration
                          </span>
                        </Tooltip>
                      ) : colId === 'duration' ? (
                        <TimeModeHeader
                          mode={timeMode}
                          onChange={(next) => setLayout((prev) => ({ ...prev, timeMode: next }))}
                        />
                      ) : meta?.tooltip ? (
                        <Tooltip text={meta.tooltip} placement="top">
                          <span className="cursor-help border-b border-dotted border-current/40 truncate">
                            {label}
                          </span>
                        </Tooltip>
                      ) : (
                        label
                      )}
                    </span>
                    {header.column.getCanResize() ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${colId} column`}
                        draggable={false}
                        className={`plan-jobs-table__resize-handle${header.column.getIsResizing() ? ' plan-jobs-table__resize-handle--active' : ''}`}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          header.getResizeHandler()(e)
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation()
                          header.getResizeHandler()(e)
                        }}
                      />
                    ) : null}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => {
            const original = row.original
            const isParentRow = original.kind === 'parent' || original.depth === 0
            const expanded =
              original.kind === 'parent' ? !collapsed.has(original.collapseKey) : true
            const rowKey =
              original.rootId ?? `job-${original.productTypeId}-${original.depth}-${rowIndex}`
            const isDropTarget =
              !!original.rootId &&
              dragOverRootId === original.rootId &&
              draggingRootId !== original.rootId
            const rowEnabled = original.enabled !== false

            return (
              <tr
                key={rowKey}
                className={`${planTableRowClass(isParentRow)}${isParentRow ? ' plan-jobs-table__row--parent' : ''}${original.kind === 'parent' ? ' cursor-pointer' : ''}${
                  draggingRootId && original.rootId === draggingRootId
                    ? ' plan-jobs-table__row--dragging'
                    : ''
                }${isDropTarget ? ' plan-jobs-table__drop-target' : ''}${
                  original.isRoot && !rowEnabled ? ' plan-jobs-table__row--disabled' : ''
                }${!original.isRoot ? ' plan-jobs-table__row--child' : ''}`}
                {...(original.kind === 'parent'
                  ? expandableRowProps(expanded, original.name, () =>
                      onToggleCollapse(original.collapseKey),
                    )
                  : {})}
                onDragOver={
                  canReorder && original.isRoot && original.rootId && draggingRootId
                    ? (e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverRootId !== original.rootId) setDragOverRootId(original.rootId!)
                      }
                    : undefined
                }
                onDragLeave={
                  canReorder && original.isRoot && original.rootId
                    ? (e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverRootId((id) => (id === original.rootId ? null : id))
                        }
                      }
                    : undefined
                }
                onDrop={
                  canReorder && original.isRoot && original.rootId
                    ? (e) => {
                        e.preventDefault()
                        const fromId = e.dataTransfer.getData('text/plain')
                        setDraggingRootId(null)
                        setDragOverRootId(null)
                        if (fromId && fromId !== original.rootId)
                          onReorder?.(fromId, original.rootId!)
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={planJobsPinningStyles(cell.column, 'body')}
                    className={`${pinningCellClass(cell.column.id, false)} ${planJobsTableColumnClass(cell.column.id, timeMode)} min-w-0`}
                    onClick={cell.column.id === 'actions' ? stopRowToggle : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          {table.getFooterGroups().map((footerGroup) => (
            <tr key={footerGroup.id} className="text-sm font-medium">
              {footerGroup.headers.map((header) => (
                <td
                  key={header.id}
                  style={planJobsPinningStyles(header.column, 'head')}
                  className={`${pinningCellClass(header.column.id, true)} ${planJobsTableColumnClass(header.column.id, timeMode)}`}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.footer, header.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  )
}
