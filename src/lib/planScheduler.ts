import type { PlanNode, ScheduledPlanJob } from '@/types'

export interface SchedulePlanInput {
  nodes: PlanNode[]
  slots: number
  windowHours: number
}

interface ScheduleEvent {
  productTypeId: number
  hour: number
  qty: number
}

function childDemandForJob(child: PlanNode, parent: PlanNode, parentRunsThisJob: number): number {
  const entry = child.demandByParent.find((d) => d.parentProductTypeId === parent.productTypeId)
  if (!entry) return 0
  return entry.qty * (parentRunsThisJob / Math.max(1, parent.runs))
}

/** Inventory available when a job starts at `hour` (matches planSimulator bucket semantics). */
function inventoryWhenStarting(
  productTypeId: number,
  hour: number,
  supplies: ScheduleEvent[],
  demands: ScheduleEvent[],
): number {
  let inv = 0
  let supplyAtHour = 0
  let demandAtHour = 0

  for (const event of supplies) {
    if (event.productTypeId !== productTypeId) continue
    if (event.hour < hour) inv += event.qty
    else if (event.hour === hour) supplyAtHour += event.qty
  }

  for (const event of demands) {
    if (event.productTypeId !== productTypeId) continue
    if (event.hour < hour) inv -= event.qty
    else if (event.hour === hour) demandAtHour += event.qty
  }

  return inv + supplyAtHour - demandAtHour
}

function findEarliestStartHour(
  productTypeId: number,
  needed: number,
  minHour: number,
  supplies: ScheduleEvent[],
  demands: ScheduleEvent[],
): number {
  if (needed <= 0) return minHour

  const productSupplies = supplies.filter((s) => s.productTypeId === productTypeId)
  const candidates = new Set<number>([minHour])
  for (const event of productSupplies) {
    if (event.hour >= minHour) candidates.add(event.hour)
  }

  for (const hour of [...candidates].sort((a, b) => a - b)) {
    if (inventoryWhenStarting(productTypeId, hour, supplies, demands) >= needed) {
      return hour
    }
  }

  const lastSupplyHour = productSupplies.reduce(
    (max, event) => (event.hour > max ? event.hour : max),
    minHour,
  )
  return Math.max(minHour, lastSupplyHour)
}

function earliestStartWithDependencies(
  node: PlanNode,
  runsThisJob: number,
  slotMinStart: number,
  nodesById: Map<number, PlanNode>,
  supplies: ScheduleEvent[],
  demands: ScheduleEvent[],
): number {
  let start = slotMinStart

  for (const childId of node.childProductTypeIds) {
    const child = nodesById.get(childId)
    if (!child || child.mode !== 'build') continue

    const needed = childDemandForJob(child, node, runsThisJob)
    if (needed <= 0) continue

    start = Math.max(
      start,
      findEarliestStartHour(child.productTypeId, needed, start, supplies, demands),
    )
  }

  return start
}

/** Greedy slot packing with build dependencies: parents wait for child supply. */
export function schedulePlanJobs(input: SchedulePlanInput): ScheduledPlanJob[] {
  const { nodes, slots, windowHours } = input
  const buildNodes = nodes.filter((n) => n.mode === 'build' && n.runs > 0)
  const byDepth = [...buildNodes].sort((a, b) => b.depth - a.depth)
  const nodesById = new Map(nodes.map((node) => [node.productTypeId, node]))

  const slotFreeAt = Array.from({ length: Math.max(1, slots) }, () => 0)
  const jobs: ScheduledPlanJob[] = []
  const supplies: ScheduleEvent[] = []
  const demands: ScheduleEvent[] = []

  for (const node of byDepth) {
    let remainingRuns = node.runs
    const runsPerJob = Math.max(1, Math.ceil(node.runs / Math.max(1, node.concurrentCopies)))

    while (remainingRuns > 0) {
      const slot = slotFreeAt.indexOf(Math.min(...slotFreeAt))
      const runsThisJob = Math.min(remainingRuns, runsPerJob)
      const slotMinStart = slotFreeAt[slot] ?? 0
      const startHour = earliestStartWithDependencies(
        node,
        runsThisJob,
        slotMinStart,
        nodesById,
        supplies,
        demands,
      )
      const jobDurationHours =
        runsPerJob > 0 ? (node.jobTimeSeconds * runsThisJob) / runsPerJob / 3600 : 0
      const endHour = startHour + jobDurationHours
      const outputQty = runsThisJob * (node.outputQty / Math.max(1, node.runs))

      jobs.push({
        productTypeId: node.productTypeId,
        name: node.name,
        slot,
        startHour,
        endHour,
        runs: runsThisJob,
        outputQty,
      })

      supplies.push({ productTypeId: node.productTypeId, hour: endHour, qty: outputQty })

      for (const childId of node.childProductTypeIds) {
        const child = nodesById.get(childId)
        if (!child || child.mode !== 'build') continue
        const qty = childDemandForJob(child, node, runsThisJob)
        if (qty > 0) {
          demands.push({ productTypeId: child.productTypeId, hour: startHour, qty })
        }
      }

      slotFreeAt[slot] = endHour
      remainingRuns -= runsThisJob
    }
  }

  return jobs.filter((j) => j.startHour < windowHours)
}

export function scheduledDurationHours(jobs: ScheduledPlanJob[], productTypeId: number): number {
  const productJobs = jobs.filter((j) => j.productTypeId === productTypeId)
  if (productJobs.length === 0) return 0
  const start = Math.min(...productJobs.map((j) => j.startHour))
  const end = Math.max(...productJobs.map((j) => j.endHour))
  return end - start
}

export function windowHoursFromJobs(jobs: ScheduledPlanJob[]): number {
  if (jobs.length === 0) return 1
  const end = Math.max(...jobs.map((j) => j.endHour))
  if (!Number.isFinite(end) || end <= 0) return 1
  return Math.max(1, end)
}

export function detectOverUnder(nodes: PlanNode[]): { productTypeId: number; message: string }[] {
  const warnings: { productTypeId: number; message: string }[] = []
  for (const node of nodes) {
    if (node.mode !== 'build' || node.isRoot) continue
    const produced = node.outputQty
    const demand = node.totalDemandQty
    if (produced > demand * 1.001) {
      warnings.push({
        productTypeId: node.productTypeId,
        message: `${node.name}: produced ${Math.round(produced)} vs demand ${Math.round(demand)} (over +${Math.round(produced - demand)})`,
      })
    } else if (produced < demand * 0.999) {
      warnings.push({
        productTypeId: node.productTypeId,
        message: `${node.name}: produced ${Math.round(produced)} vs demand ${Math.round(demand)} (under -${Math.round(demand - produced)})`,
      })
    }
  }
  return warnings
}
