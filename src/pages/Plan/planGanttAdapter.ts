import type { PlanJobActivity, PlanJobPool, PlanNode, ScheduledPlanJob } from '@/types'
import type { GanttBar, GanttLane } from '@/components/gantt/ganttTypes'
import { ganttBarColor, formatHourTick } from '@/lib/planTimelineChartData'
import { formatDecimal } from '@/lib/profit'

const ACTIVITY_COLORS: Partial<Record<PlanJobActivity, string>> = {
  copy: '#a371f7',
  invention: '#db61a2',
  reaction: '#3fb950',
  manufacture: '#f5a623',
}

function sameMergeGroup(a: ScheduledPlanJob, b: ScheduledPlanJob): boolean {
  return a.productTypeId === b.productTypeId && a.activity === b.activity
}

function mergeSlotJobsToBars(
  slotJobs: ScheduledPlanJob[],
  pool: PlanJobPool,
  slotIndex: number,
  span: number,
  depthById: Map<number, number>,
  rootById: Map<number, boolean>,
): GanttBar[] {
  if (slotJobs.length === 0) return []

  const bars: GanttBar[] = []
  let groupStart = 0

  const pushGroup = (from: number, to: number) => {
    const group = slotJobs.slice(from, to + 1)
    const first = group[0]!
    const last = group[group.length - 1]!
    const count = group.length
    const startHour = first.startHour
    const endHour = last.endHour
    const durationHours = Math.max(0.01, endHour - startHour)
    const depth = depthById.get(first.productTypeId) ?? 0
    const isRoot = rootById.get(first.productTypeId) ?? false
    const activity = first.activity

    bars.push({
      id: `${pool}-${first.productTypeId}-${slotIndex}-${from}`,
      label: first.name,
      start: startHour / span,
      end: endHour / span,
      duration: durationHours,
      productTypeId: first.productTypeId,
      color:
        activity && ACTIVITY_COLORS[activity]
          ? ACTIVITY_COLORS[activity]!
          : ganttBarColor(depth, isRoot),
      meta: {
        runs: group.reduce((sum, job) => sum + job.runs, 0),
        outputQty: group.reduce((sum, job) => sum + job.outputQty, 0),
        isRoot,
        activity: activity ?? 'manufacture',
        pool,
        ...(count > 1 ? { count } : {}),
      },
    })
  }

  for (let i = 1; i <= slotJobs.length; i += 1) {
    if (i === slotJobs.length || !sameMergeGroup(slotJobs[i - 1]!, slotJobs[i]!)) {
      pushGroup(groupStart, i - 1)
      groupStart = i
    }
  }

  return bars
}

export function buildPlanGanttLanes(
  jobs: ScheduledPlanJob[],
  nodes: PlanNode[],
  slotCount: number,
  windowHours: number,
  pool: PlanJobPool = 'manufacturing',
): GanttLane[] {
  const depthById = new Map(nodes.map((n) => [n.productTypeId, n.depth]))
  const rootById = new Map(nodes.map((n) => [n.productTypeId, n.isRoot]))
  const slots = Math.max(1, slotCount)
  const span = Math.max(windowHours, 1)
  const poolJobs = jobs.filter((j) => (j.pool ?? 'manufacturing') === pool && j.startHour < span)

  const bySlot = new Map<number, ScheduledPlanJob[]>()
  for (let s = 0; s < slots; s++) bySlot.set(s, [])
  for (const job of poolJobs) {
    const list = bySlot.get(job.slot) ?? []
    list.push(job)
    bySlot.set(job.slot, list)
  }

  const labelPrefix = pool === 'science' ? 'Sci' : pool === 'reaction' ? 'Rxn' : 'Slot'

  return Array.from({ length: slots }, (_, slotIndex) => {
    const slotJobs = [...(bySlot.get(slotIndex) ?? [])].sort((a, b) => a.startHour - b.startHour)
    const bars = mergeSlotJobsToBars(slotJobs, pool, slotIndex, span, depthById, rootById)

    const busyHours = slotJobs.reduce(
      (sum, job) => sum + Math.max(0.01, job.endHour - job.startHour),
      0,
    )
    const endHour = slotJobs.length > 0 ? Math.max(...slotJobs.map((j) => j.endHour)) : 0

    return {
      id: `${pool}-slot-${slotIndex}`,
      label: `${labelPrefix} ${slotIndex + 1}`,
      sublabel: `${slotJobs.length} job${slotJobs.length === 1 ? '' : 's'} · ends ${formatHourTick(endHour)}`,
      bars,
      jobCount: slotJobs.length,
      busyHours,
      endHour,
    }
  })
}

export function formatPlanGanttTick(ratio: number, windowHours: number): string {
  return formatHourTick(ratio * Math.max(windowHours, 1))
}

export function formatPlanScrubLabel(ratio: number, windowHours: number): string {
  const span = Math.max(windowHours, 1)
  const hours = ratio * span
  return `${formatPlanGanttTick(ratio, windowHours)} · ${formatDecimal(hours, 1)}h from plan start`
}
