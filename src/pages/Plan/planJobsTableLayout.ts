export type PlanJobsColumnId =
  | 'runs'
  | 'duration'
  | 'bpos'
  | 'owner'
  | 'progress'
  | 'output'
  | 'volume'
  | 'setup'
  | 'profit'
  | 'margin'

/** Shared Duration / Ready by column — header dropdown picks which field is shown. */
export type PlanJobsTimeMode = 'duration' | 'readyBy'

/** Always pinned on the right; not reorderable with scroll columns. */
export const PLAN_JOBS_PINNED_RIGHT: PlanJobsColumnId[] = ['margin']

export interface PlanJobsTableLayout {
  /** Reorderable columns between Product and pinned margin. */
  order: PlanJobsColumnId[]
  /** Pixel widths the user dragged to. Missing ids use the column default. */
  widths: Partial<Record<PlanJobsColumnId, number>>
  /** Sticky Product column width. */
  productWidth?: number
  /** Sticky Actions column width. */
  actionsWidth?: number
  /** Duration vs Ready by in the merged time column. */
  timeMode?: PlanJobsTimeMode
}

export const DEFAULT_PRODUCT_COLUMN_WIDTH = 288
export const PLAN_PRODUCT_MIN_WIDTH = 200
export const PLAN_PRODUCT_MAX_WIDTH = 480
export const PLAN_JOBS_ACTIONS_COLUMN_WIDTH = 88
export const PLAN_JOBS_ACTIONS_MIN_WIDTH = 72
export const PLAN_JOBS_ACTIONS_MAX_WIDTH = 140

export type PlanJobsColumnAlign = 'left' | 'right' | 'center'

export interface PlanJobsColumnSpec {
  defaultWidth: number
  minWidth: number
  maxWidth: number
  align: PlanJobsColumnAlign
}

/** Default widths and alignment — tuned for typical EVE plan values. */
export const PLAN_JOBS_COLUMN_SPECS: Record<PlanJobsColumnId, PlanJobsColumnSpec> = {
  runs: { defaultWidth: 110, minWidth: 84, maxWidth: 140, align: 'center' },
  duration: { defaultWidth: 105, minWidth: 79, maxWidth: 149, align: 'left' },
  bpos: { defaultWidth: 70, minWidth: 64, maxWidth: 112, align: 'center' },
  owner: { defaultWidth: 60, minWidth: 60, maxWidth: 60, align: 'center' },
  progress: { defaultWidth: 136, minWidth: 120, maxWidth: 200, align: 'left' },
  output: { defaultWidth: 92, minWidth: 80, maxWidth: 140, align: 'right' },
  volume: { defaultWidth: 100, minWidth: 88, maxWidth: 140, align: 'right' },
  setup: { defaultWidth: 112, minWidth: 96, maxWidth: 180, align: 'right' },
  profit: { defaultWidth: 140, minWidth: 120, maxWidth: 225, align: 'right' },
  margin: { defaultWidth: 88, minWidth: 76, maxWidth: 128, align: 'right' },
}

export function planJobsDefaultColumnWidth(id: PlanJobsColumnId): number {
  return PLAN_JOBS_COLUMN_SPECS[id].defaultWidth
}

export function clampPlanJobsColumnWidth(id: PlanJobsColumnId, width: number): number {
  const spec = PLAN_JOBS_COLUMN_SPECS[id]
  return Math.round(Math.min(spec.maxWidth, Math.max(spec.minWidth, width)))
}

export function planJobsColumnAlign(id: PlanJobsColumnId): PlanJobsColumnAlign {
  return PLAN_JOBS_COLUMN_SPECS[id].align
}

export function planJobsTableColumnClass(
  columnId: string,
  timeMode: PlanJobsTimeMode = 'duration',
): string {
  if (columnId === 'product') return 'plan-jobs-table__col plan-jobs-table__col--product'
  if (columnId === 'actions') return 'plan-jobs-table__col plan-jobs-table__col--actions'
  if (columnId === 'duration' && timeMode === 'readyBy') {
    return 'plan-jobs-table__col plan-jobs-table__col--left plan-jobs-table__col--ready-by'
  }
  const spec = PLAN_JOBS_COLUMN_SPECS[columnId as PlanJobsColumnId]
  if (!spec) return 'plan-jobs-table__col'
  return `plan-jobs-table__col plan-jobs-table__col--${spec.align}`
}

export function parsePlanJobsTimeMode(raw: unknown): PlanJobsTimeMode {
  return raw === 'readyBy' ? 'readyBy' : 'duration'
}

export const PLAN_JOBS_LAYOUT_STORAGE_KEY = 'plan-jobs-table-layout'

export const DEFAULT_PLAN_JOBS_SCROLL_ORDER: PlanJobsColumnId[] = [
  'runs',
  'duration',
  'bpos',
  'owner',
  'progress',
  'output',
  'volume',
  'setup',
  'profit',
]

/** Production jobs table (PlanRootList) — no owner / progress / bpos columns. */
export const CORE_PLAN_JOBS_SCROLL_ORDER: PlanJobsColumnId[] = [
  'runs',
  'duration',
  'output',
  'volume',
  'setup',
  'profit',
]

/** Scroll + pinned ids (for tests and migration). */
export const DEFAULT_PLAN_JOBS_ORDER: PlanJobsColumnId[] = [
  ...DEFAULT_PLAN_JOBS_SCROLL_ORDER,
  ...PLAN_JOBS_PINNED_RIGHT,
]

export const PLAN_JOBS_COLUMN_MIN_WIDTH = 64
export const PLAN_JOBS_COLUMN_MAX_WIDTH = 320

export function defaultPlanJobsLayout(): PlanJobsTableLayout {
  return {
    order: [...DEFAULT_PLAN_JOBS_SCROLL_ORDER],
    widths: {},
    productWidth: DEFAULT_PRODUCT_COLUMN_WIDTH,
    timeMode: 'duration',
  }
}

export function isPinnedPlanJobsColumn(id: PlanJobsColumnId): boolean {
  return PLAN_JOBS_PINNED_RIGHT.includes(id)
}

/** Move `from` to the position of `to`. Unknown ids leave the layout unchanged. */
export function movePlanJobsColumn(
  layout: PlanJobsTableLayout,
  from: PlanJobsColumnId,
  to: PlanJobsColumnId,
): PlanJobsTableLayout {
  if (from === to) return layout
  if (isPinnedPlanJobsColumn(from) || isPinnedPlanJobsColumn(to)) return layout
  const fromIndex = layout.order.indexOf(from)
  const toIndex = layout.order.indexOf(to)
  if (fromIndex < 0 || toIndex < 0) return layout
  const order = [...layout.order]
  order.splice(fromIndex, 1)
  order.splice(toIndex, 0, from)
  return { ...layout, order }
}

export function resizePlanJobsColumn(
  layout: PlanJobsTableLayout,
  id: PlanJobsColumnId,
  width: number,
): PlanJobsTableLayout {
  return { ...layout, widths: { ...layout.widths, [id]: clampPlanJobsColumnWidth(id, width) } }
}

export function resizePlanProductColumn(
  layout: PlanJobsTableLayout,
  width: number,
): PlanJobsTableLayout {
  const clamped = Math.round(
    Math.min(PLAN_PRODUCT_MAX_WIDTH, Math.max(PLAN_PRODUCT_MIN_WIDTH, width)),
  )
  return { ...layout, productWidth: clamped }
}

export function resizePlanActionsColumn(
  layout: PlanJobsTableLayout,
  width: number,
): PlanJobsTableLayout {
  const clamped = Math.round(
    Math.min(PLAN_JOBS_ACTIONS_MAX_WIDTH, Math.max(PLAN_JOBS_ACTIONS_MIN_WIDTH, width)),
  )
  return { ...layout, actionsWidth: clamped }
}

/** Read a saved layout. Drops unknown ids, appends columns added since it was saved. */
export function parsePlanJobsLayout(raw: string | null): PlanJobsTableLayout {
  if (!raw) return defaultPlanJobsLayout()
  try {
    const parsed = JSON.parse(raw) as Partial<PlanJobsTableLayout>
    const known = new Set<PlanJobsColumnId>(DEFAULT_PLAN_JOBS_ORDER)
    const saved = (Array.isArray(parsed.order) ? parsed.order : []).filter(
      (id, index, list): id is PlanJobsColumnId => known.has(id) && list.indexOf(id) === index,
    )
    const scrollSaved = saved.filter((id) => !isPinnedPlanJobsColumn(id))
    const order = [
      ...scrollSaved,
      ...DEFAULT_PLAN_JOBS_SCROLL_ORDER.filter((id) => !scrollSaved.includes(id)),
    ]
    const productWidth =
      typeof parsed.productWidth === 'number' && Number.isFinite(parsed.productWidth)
        ? Math.min(
            PLAN_PRODUCT_MAX_WIDTH,
            Math.max(PLAN_PRODUCT_MIN_WIDTH, Math.round(parsed.productWidth)),
          )
        : DEFAULT_PRODUCT_COLUMN_WIDTH
    const actionsWidth =
      typeof parsed.actionsWidth === 'number' && Number.isFinite(parsed.actionsWidth)
        ? Math.min(
            PLAN_JOBS_ACTIONS_MAX_WIDTH,
            Math.max(PLAN_JOBS_ACTIONS_MIN_WIDTH, Math.round(parsed.actionsWidth)),
          )
        : undefined
    const widths: PlanJobsTableLayout['widths'] = {}
    for (const id of order) {
      const width = parsed.widths?.[id]
      if (typeof width === 'number' && Number.isFinite(width)) {
        widths[id] = clampPlanJobsColumnWidth(id, width)
      }
    }
    for (const id of PLAN_JOBS_PINNED_RIGHT) {
      const width = parsed.widths?.[id]
      if (typeof width === 'number' && Number.isFinite(width)) {
        widths[id] = clampPlanJobsColumnWidth(id, width)
      }
    }
    // Old layouts had a separate Ready by column; keep its width on the merged time column.
    const legacyReadyByWidth = (parsed.widths as { readyBy?: number } | undefined)?.readyBy
    if (
      widths.duration == null &&
      typeof legacyReadyByWidth === 'number' &&
      Number.isFinite(legacyReadyByWidth)
    ) {
      widths.duration = clampPlanJobsColumnWidth('duration', legacyReadyByWidth)
    }
    return {
      order,
      widths,
      productWidth,
      timeMode: parsePlanJobsTimeMode(parsed.timeMode),
      ...(actionsWidth != null ? { actionsWidth } : {}),
    }
  } catch {
    return defaultPlanJobsLayout()
  }
}

export function loadPlanJobsLayout(): PlanJobsTableLayout {
  try {
    return parsePlanJobsLayout(localStorage.getItem(PLAN_JOBS_LAYOUT_STORAGE_KEY))
  } catch {
    return defaultPlanJobsLayout()
  }
}

/** Keeps core column order and widths; drops full-table-only columns from saved layout. */
export function filterLayoutToCoreColumns(layout: PlanJobsTableLayout): PlanJobsTableLayout {
  const widths: PlanJobsTableLayout['widths'] = {}
  for (const id of CORE_PLAN_JOBS_SCROLL_ORDER) {
    const width = layout.widths[id]
    if (width != null) widths[id] = width
  }
  const runsSpec = PLAN_JOBS_COLUMN_SPECS.runs
  const savedRuns = widths.runs ?? layout.widths.runs
  widths.runs = clampPlanJobsColumnWidth(
    'runs',
    savedRuns != null && (savedRuns <= 76 || savedRuns === 96)
      ? runsSpec.defaultWidth
      : (savedRuns ?? runsSpec.defaultWidth),
  )
  const marginSpec = PLAN_JOBS_COLUMN_SPECS.margin
  const savedMargin = layout.widths.margin
  // Shrink layouts that still use the old wide margin default (localStorage).
  const marginWidth =
    savedMargin != null && savedMargin >= 112
      ? marginSpec.defaultWidth
      : (savedMargin ?? marginSpec.defaultWidth)
  widths.margin = clampPlanJobsColumnWidth('margin', marginWidth)
  const durationSpec = PLAN_JOBS_COLUMN_SPECS.duration
  const savedDuration = widths.duration ?? layout.widths.duration
  widths.duration = clampPlanJobsColumnWidth(
    'duration',
    savedDuration === 196 || savedDuration === 157
      ? durationSpec.defaultWidth
      : (savedDuration ?? durationSpec.defaultWidth),
  )
  const actionsMin = PLAN_JOBS_ACTIONS_COLUMN_WIDTH
  const actionsWidth =
    layout.actionsWidth != null && layout.actionsWidth < actionsMin
      ? actionsMin
      : layout.actionsWidth
  return {
    order: [...CORE_PLAN_JOBS_SCROLL_ORDER],
    widths,
    productWidth: layout.productWidth,
    actionsWidth,
    timeMode: 'duration',
  }
}

export function loadPlanJobsCoreLayout(): PlanJobsTableLayout {
  return filterLayoutToCoreColumns(loadPlanJobsLayout())
}

export function savePlanJobsLayout(layout: PlanJobsTableLayout): void {
  try {
    localStorage.setItem(PLAN_JOBS_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Storage can be full or disabled; the layout then lasts for this session only.
  }
}
