import type { PlanNode, ScheduledPlanJob } from '@/types'

export interface SchedulePlanInput {
  nodes: PlanNode[]
  slots: number
  windowHours: number
}

/** Greedy slot packing: children before parents. */
export function schedulePlanJobs(input: SchedulePlanInput): ScheduledPlanJob[] {
  const { nodes, slots, windowHours } = input
  const buildNodes = nodes.filter((n) => n.mode === 'build' && n.runs > 0)
  const byDepth = [...buildNodes].sort((a, b) => b.depth - a.depth)

  const slotFreeAt = Array.from({ length: Math.max(1, slots) }, () => 0)
  const jobs: ScheduledPlanJob[] = []

  for (const node of byDepth) {
    let remainingRuns = node.runs
    const runsPerJob = Math.max(1, Math.ceil(node.runs / Math.max(1, node.concurrentCopies)))
    const perRunSeconds = node.runs > 0 ? node.jobTimeSeconds / node.runs : 0

    while (remainingRuns > 0) {
      const slot = slotFreeAt.indexOf(Math.min(...slotFreeAt))
      const runsThisJob = Math.min(remainingRuns, runsPerJob)
      const startHour = slotFreeAt[slot] ?? 0
      const jobDurationHours = (perRunSeconds * runsThisJob) / 3600
      const endHour = startHour + jobDurationHours

      jobs.push({
        productTypeId: node.productTypeId,
        name: node.name,
        slot,
        startHour,
        endHour,
        runs: runsThisJob,
        outputQty: runsThisJob * (node.outputQty / Math.max(1, node.runs)),
      })

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
  return Math.max(1, Math.max(...jobs.map((j) => j.endHour)))
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
