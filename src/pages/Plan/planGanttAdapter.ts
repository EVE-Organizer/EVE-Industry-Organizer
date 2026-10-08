import type {
  PlanCharacterKey,
  PlanJobActivity,
  PlanJobPool,
  PlanNode,
  ScheduledPlanJob,
} from '@/types'
import type { GanttBar, GanttLane } from '@/components/gantt/ganttTypes'
import { formatHourTick } from '@/lib/planTimelineChartData'
import { formatDecimal } from '@/lib/profit'

export const PLAN_GANTT_ACTIVITY_COLORS: Record<PlanJobActivity, string> = {
  manufacture: '#f5a623',
  invention: '#a371f7',
  copy: '#58a6ff',
  reaction: '#3fb950',
}

export const PLAN_GANTT_ACTIVITY_LEGEND: Array<{
  activity: PlanJobActivity
  label: string
  color: string
}> = [
  { activity: 'manufacture', label: 'Manufacture', color: PLAN_GANTT_ACTIVITY_COLORS.manufacture },
  { activity: 'reaction', label: 'Reaction', color: PLAN_GANTT_ACTIVITY_COLORS.reaction },
  { activity: 'copy', label: 'Copy', color: PLAN_GANTT_ACTIVITY_COLORS.copy },
  { activity: 'invention', label: 'Invention', color: PLAN_GANTT_ACTIVITY_COLORS.invention },
]

export interface PlanGanttCrewMember {
  key: PlanCharacterKey
  name: string
  characterId?: number
  manufacturing: number
  reactions: number
  research: number
}

function slotCountForPool(member: PlanGanttCrewMember, pool: PlanJobPool): number {
  if (pool === 'reaction') return member.reactions
  if (pool === 'science') return member.research
  return member.manufacturing
}

function laneKey(characterKey: PlanCharacterKey | undefined, slot: number): string {
  return `${characterKey ?? '__shared__'}:${slot}`
}

function sameMergeGroup(a: ScheduledPlanJob, b: ScheduledPlanJob): boolean {
  return a.productTypeId === b.productTypeId && a.activity === b.activity
}

function mergeSlotJobsToBars(
  slotJobs: ScheduledPlanJob[],
  pool: PlanJobPool,
  laneId: string,
  span: number,
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
    const isRoot = rootById.get(first.productTypeId) ?? false
    const activity = first.activity

    bars.push({
      id: `${laneId}-${first.productTypeId}-${from}`,
      label: first.name,
      start: startHour / span,
      end: endHour / span,
      duration: durationHours,
      productTypeId: first.productTypeId,
      color: PLAN_GANTT_ACTIVITY_COLORS[activity ?? 'manufacture'],
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

function buildLane(
  id: string,
  label: string,
  slotJobs: ScheduledPlanJob[],
  pool: PlanJobPool,
  span: number,
  rootById: Map<number, boolean>,
  owner?: {
    characterId?: number
    characterName?: string
    groupId?: string
    groupLabel?: string
  },
): GanttLane {
  const sorted = [...slotJobs].sort((a, b) => a.startHour - b.startHour)
  const bars = mergeSlotJobsToBars(sorted, pool, id, span, rootById)
  const busyHours = sorted.reduce(
    (sum, job) => sum + Math.max(0.01, job.endHour - job.startHour),
    0,
  )
  const endHour = sorted.length > 0 ? Math.max(...sorted.map((j) => j.endHour)) : 0

  return {
    id,
    label,
    sublabel:
      sorted.length > 0
        ? `${sorted.length} job${sorted.length === 1 ? '' : 's'} · ends ${formatHourTick(endHour)}`
        : 'Idle',
    bars,
    jobCount: sorted.length,
    busyHours,
    endHour,
    characterId: owner?.characterId,
    characterName: owner?.characterName,
    groupId: owner?.groupId,
    groupLabel: owner?.groupLabel,
  }
}

export function buildPlanGanttLanes(
  jobs: ScheduledPlanJob[],
  nodes: PlanNode[],
  slotCount: number,
  windowHours: number,
  pool: PlanJobPool = 'manufacturing',
  crew?: PlanGanttCrewMember[],
): GanttLane[] {
  const rootById = new Map(nodes.map((n) => [n.productTypeId, n.isRoot]))
  const span = Math.max(windowHours, 1)
  const poolJobs = jobs.filter((j) => (j.pool ?? 'manufacturing') === pool && j.startHour < span)

  const byLane = new Map<string, ScheduledPlanJob[]>()

  for (const job of poolJobs) {
    const key = laneKey(job.characterKey, job.slot)
    const list = byLane.get(key) ?? []
    list.push(job)
    byLane.set(key, list)
  }

  const lanes: GanttLane[] = []

  if (crew && crew.length > 0) {
    for (const member of crew) {
      const slots = Math.max(1, slotCountForPool(member, pool))
      for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
        const id = `${pool}-${member.key}-${slotIndex}`
        const slotJobs = byLane.get(laneKey(member.key, slotIndex)) ?? []
        lanes.push(
          buildLane(id, `Slot ${slotIndex + 1}`, slotJobs, pool, span, rootById, {
            characterId: member.characterId,
            characterName: member.name,
            groupId: member.key,
            groupLabel: member.name,
          }),
        )
      }
    }
    for (const [key, slotJobs] of byLane) {
      if (key.startsWith('__shared__')) {
        const slotIndex = Number(key.split(':')[1])
        lanes.push(
          buildLane(
            `${pool}-shared-${slotIndex}`,
            `Slot ${slotIndex + 1}`,
            slotJobs,
            pool,
            span,
            rootById,
          ),
        )
      }
    }
    return lanes
  }

  const slots = Math.max(1, slotCount)
  for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
    const slotJobs =
      byLane.get(laneKey(undefined, slotIndex)) ?? poolJobs.filter((j) => j.slot === slotIndex)
    lanes.push(
      buildLane(
        `${pool}-slot-${slotIndex}`,
        pool === 'science'
          ? `Sci ${slotIndex + 1}`
          : pool === 'reaction'
            ? `Rxn ${slotIndex + 1}`
            : `Slot ${slotIndex + 1}`,
        slotJobs,
        pool,
        span,
        rootById,
      ),
    )
  }

  return lanes
}

export function formatPlanGanttTick(ratio: number, windowHours: number): string {
  return formatHourTick(ratio * Math.max(windowHours, 1))
}

export function formatPlanScrubLabel(ratio: number, windowHours: number): string {
  const span = Math.max(windowHours, 1)
  const hours = ratio * span
  return `${formatPlanGanttTick(ratio, windowHours)} · ${formatDecimal(hours, 1)}h from plan start`
}

export function legendForPool(pool: PlanJobPool): typeof PLAN_GANTT_ACTIVITY_LEGEND {
  if (pool === 'reaction')
    return PLAN_GANTT_ACTIVITY_LEGEND.filter((item) => item.activity === 'reaction')
  if (pool === 'science') {
    return PLAN_GANTT_ACTIVITY_LEGEND.filter(
      (item) => item.activity === 'copy' || item.activity === 'invention',
    )
  }
  return PLAN_GANTT_ACTIVITY_LEGEND.filter((item) => item.activity === 'manufacture')
}
