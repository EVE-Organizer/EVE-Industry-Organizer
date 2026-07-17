import type { PlanNode, PlanNodeSimulation, ScheduledPlanJob } from '@/types'

export interface PlanSlotJobBar {
  id: string
  name: string
  startHour: number
  endHour: number
  durationHours: number
  runs: number
  outputQty: number
  productTypeId: number
  depth: number
  isRoot: boolean
}

export interface PlanSlotLane {
  slot: number
  label: string
  jobs: PlanSlotJobBar[]
  jobCount: number
  busyHours: number
  endHour: number
}

export interface PlanStockPoint {
  hour: number
  supply: number
  demand: number
  inventory: number
}

const GANTT_COLORS = [
  '#f5a623', // primary / eve orange
  '#4a9eff', // secondary / eve blue
  '#3fb950', // success
  '#58a6ff', // accent
  '#d29922', // muted warning gold
]

/** Theme-aligned bar color: roots use primary; others cycle by depth. */
export function ganttBarColor(depth: number, isRoot = false): string {
  if (isRoot) return GANTT_COLORS[0]!
  return GANTT_COLORS[(Math.abs(depth) % (GANTT_COLORS.length - 1)) + 1]!
}

/**
 * One lane per industry slot. Bars are positioned on the full plan window (0 … windowHours).
 */
export function buildSlotLanes(
  jobs: ScheduledPlanJob[],
  nodes: PlanNode[],
  slotCount: number,
): PlanSlotLane[] {
  const depthById = new Map(nodes.map((n) => [n.productTypeId, n.depth]))
  const rootById = new Map(nodes.map((n) => [n.productTypeId, n.isRoot]))
  const slots = Math.max(1, slotCount)

  const bySlot = new Map<number, ScheduledPlanJob[]>()
  for (let s = 0; s < slots; s++) bySlot.set(s, [])
  for (const job of jobs) {
    const list = bySlot.get(job.slot) ?? []
    list.push(job)
    bySlot.set(job.slot, list)
  }

  const lanes: PlanSlotLane[] = []
  for (let s = 0; s < slots; s++) {
    const slotJobs = [...(bySlot.get(s) ?? [])].sort((a, b) => a.startHour - b.startHour)
    const durations = slotJobs.map((job) => Math.max(0.01, job.endHour - job.startHour))
    const busyHours = durations.reduce((sum, d) => sum + d, 0)

    const bars: PlanSlotJobBar[] = slotJobs.map((job, index) => {
      const durationHours = durations[index]!
      return {
        id: `${job.productTypeId}-${s}-${index}`,
        name: job.name,
        startHour: job.startHour,
        endHour: job.endHour,
        durationHours,
        runs: job.runs,
        outputQty: job.outputQty,
        productTypeId: job.productTypeId,
        depth: depthById.get(job.productTypeId) ?? 0,
        isRoot: rootById.get(job.productTypeId) ?? false,
      }
    })

    lanes.push({
      slot: s,
      label: `Slot ${s + 1}`,
      jobs: bars,
      jobCount: bars.length,
      busyHours,
      endHour: bars.length > 0 ? Math.max(...bars.map((b) => b.endHour)) : 0,
    })
  }

  return lanes
}

export function buildStockSeries(sim: PlanNodeSimulation | undefined): PlanStockPoint[] {
  if (!sim) return []
  return sim.buckets.map((b) => ({
    hour: b.hour,
    supply: b.supply,
    demand: b.demand,
    inventory: b.inventory,
  }))
}

/** Keep Recharts responsive when bucket count is large. */
export function downsampleStockSeries(points: PlanStockPoint[], maxPoints = 240): PlanStockPoint[] {
  if (points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  const sampled: PlanStockPoint[] = []
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]!)
  }
  const last = points[points.length - 1]!
  if (sampled[sampled.length - 1]?.hour !== last.hour) sampled.push(last)
  return sampled
}

/** Worst shortage build nodes only (cap for readable charts). */
export function buildNodesForStockCharts(
  nodes: PlanNode[],
  jobs: ScheduledPlanJob[],
  simulations: Map<number, PlanNodeSimulation>,
  limit = 4,
): PlanNode[] {
  const jobIds = new Set(jobs.map((j) => j.productTypeId))
  const withShort = nodes.filter(
    (n) =>
      n.mode === 'build' &&
      jobIds.has(n.productTypeId) &&
      (simulations.get(n.productTypeId)?.shortages.length ?? 0) > 0,
  )

  return [...withShort]
    .sort((a, b) => {
      const da = Math.max(
        0,
        ...(simulations.get(a.productTypeId)?.shortages.map((s) => s.deficit) ?? [0]),
      )
      const db = Math.max(
        0,
        ...(simulations.get(b.productTypeId)?.shortages.map((s) => s.deficit) ?? [0]),
      )
      return db - da || b.depth - a.depth
    })
    .slice(0, limit)
}

export function formatHourTick(hours: number): string {
  if (!Number.isFinite(hours)) return '0h'
  if (hours >= 100) return `${Math.round(hours)}h`
  const rounded = Math.round(hours * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`
}

/** Exponent < 1 compresses long spans so short jobs stay readable; axis labels stay real hours. */
export const TIMELINE_VISUAL_EXPONENT = 0.55

/** Minimum bar width on the track (%), so short jobs stay clickable and legible. */
export const TIMELINE_MIN_BAR_WIDTH_PCT = 2.75

export interface PlanSlotBarLayout {
  left: string
  width: string
  visualWidthPct: number
  row: number
}

/** Map plan hours to 0–1 track position (sublinear: long durations take less width). */
export function timelineVisualRatio(
  hour: number,
  windowHours: number,
  exponent = TIMELINE_VISUAL_EXPONENT,
): number {
  const span = Math.max(windowHours, 1)
  const t = Math.max(0, Math.min(hour, span)) / span
  return Math.pow(t, exponent)
}

export function timelineTickPosition(hour: number, windowHours: number): string {
  return `${timelineVisualRatio(hour, windowHours) * 100}%`
}

/** Evenly spaced hour labels for the job schedule axis (includes 0 and window end). */
export function buildTimelineTicks(windowHours: number, count = 5): number[] {
  const span = Math.max(windowHours, 1)
  if (count <= 1) return [0, span]
  const ticks: number[] = []
  for (let i = 0; i < count; i++) {
    ticks.push((span * i) / (count - 1))
  }
  return ticks
}

export function timelineBarStyle(
  bar: Pick<PlanSlotJobBar, 'startHour' | 'durationHours'>,
  windowHours: number,
  exponent = TIMELINE_VISUAL_EXPONENT,
): { left: string; width: string; visualWidthPct: number; leftPct: number; widthPct: number } {
  const leftPct = timelineVisualRatio(bar.startHour, windowHours, exponent) * 100
  const rightPct =
    timelineVisualRatio(bar.startHour + bar.durationHours, windowHours, exponent) * 100
  const visualWidthPct = rightPct - leftPct
  const widthPct = Math.min(
    Math.max(visualWidthPct, TIMELINE_MIN_BAR_WIDTH_PCT),
    Math.max(0.35, 100 - leftPct),
  )
  return {
    left: `${leftPct}%`,
    width: `${widthPct}%`,
    visualWidthPct,
    leftPct,
    widthPct,
  }
}

function intervalsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end - 0.01 && b.start < a.end - 0.01
}

/** Assign sub-rows when min-width bars would overlap on the same slot lane. */
export function layoutLaneBars(
  bars: PlanSlotJobBar[],
  windowHours: number,
  minWidthPct = TIMELINE_MIN_BAR_WIDTH_PCT,
): { layouts: Map<string, PlanSlotBarLayout>; rowCount: number } {
  const sorted = [...bars].sort(
    (a, b) => a.startHour - b.startHour || a.durationHours - b.durationHours,
  )
  const layouts = new Map<string, PlanSlotBarLayout>()
  const rowIntervals: { start: number; end: number }[][] = []

  for (const bar of sorted) {
    const styled = timelineBarStyle(bar, windowHours)
    const leftPct = styled.leftPct
    const widthPct = Math.min(
      Math.max(styled.visualWidthPct, minWidthPct),
      Math.max(0.35, 100 - leftPct),
    )
    const interval = { start: leftPct, end: leftPct + widthPct }

    let row = 0
    for (; row < rowIntervals.length; row++) {
      const overlaps = rowIntervals[row]!.some((existing) => intervalsOverlap(interval, existing))
      if (!overlaps) break
    }

    if (row === rowIntervals.length) rowIntervals.push([])
    rowIntervals[row]!.push(interval)

    layouts.set(bar.id, {
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      visualWidthPct: widthPct,
      row,
    })
  }

  return { layouts, rowCount: Math.max(1, rowIntervals.length) }
}
