import type { PlanNode, ScheduledPlanJob } from '@/types'
import type { GanttBar, GanttLane } from '@/components/gantt/ganttTypes'
import { ganttBarColor } from '@/lib/planTimelineChartData'
import { formatHourTick } from '@/lib/planTimelineChartData'

export function buildPlanGanttLanes(
  jobs: ScheduledPlanJob[],
  nodes: PlanNode[],
  slotCount: number,
  windowHours: number,
): GanttLane[] {
  const depthById = new Map(nodes.map((n) => [n.productTypeId, n.depth]))
  const rootById = new Map(nodes.map((n) => [n.productTypeId, n.isRoot]))
  const slots = Math.max(1, slotCount)
  const span = Math.max(windowHours, 1)

  const bySlot = new Map<number, ScheduledPlanJob[]>()
  for (let s = 0; s < slots; s++) bySlot.set(s, [])
  for (const job of jobs) {
    const list = bySlot.get(job.slot) ?? []
    list.push(job)
    bySlot.set(job.slot, list)
  }

  return Array.from({ length: slots }, (_, slotIndex) => {
    const slotJobs = [...(bySlot.get(slotIndex) ?? [])].sort((a, b) => a.startHour - b.startHour)
    const bars: GanttBar[] = slotJobs.map((job, index) => {
      const durationHours = Math.max(0.01, job.endHour - job.startHour)
      const depth = depthById.get(job.productTypeId) ?? 0
      const isRoot = rootById.get(job.productTypeId) ?? false
      return {
        id: `${job.productTypeId}-${slotIndex}-${index}`,
        label: job.name,
        start: job.startHour / span,
        end: job.endHour / span,
        duration: durationHours,
        productTypeId: job.productTypeId,
        color: ganttBarColor(depth, isRoot),
        meta: { runs: job.runs, outputQty: job.outputQty, isRoot },
      }
    })

    const busyHours = slotJobs.reduce((sum, job) => sum + Math.max(0.01, job.endHour - job.startHour), 0)
    const endHour = bars.length > 0 ? Math.max(...slotJobs.map((j) => j.endHour)) : 0

    return {
      id: `slot-${slotIndex}`,
      label: `Slot ${slotIndex + 1}`,
      sublabel: `${bars.length} job${bars.length === 1 ? '' : 's'} · ends ${formatHourTick(endHour)}`,
      bars,
      jobCount: bars.length,
      busyHours,
      endHour,
    }
  })
}

export function formatPlanGanttTick(ratio: number, windowHours: number): string {
  return formatHourTick(ratio * Math.max(windowHours, 1))
}
