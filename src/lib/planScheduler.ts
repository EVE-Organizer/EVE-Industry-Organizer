import type { PlanJobActivity, PlanJobPool, PlanNode, ScheduledPlanJob } from '@/types'
import type { PlanPipeline, PlanPipelineStage } from '@/lib/planPipeline'
import { isReactionRecipe } from '@/lib/recipes'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'
import type { BlueprintInfo } from '@/types'

export interface SchedulePlanInput {
  nodes: PlanNode[]
  slots: number
  /** Concurrent science slots for copy / invention. */
  scienceSlots?: number
  windowHours: number
  /** Optional pre-built pipeline; when present, science stages are scheduled too. */
  pipeline?: PlanPipeline
  blueprints?: BlueprintInfo[]
}

interface ScheduleEvent {
  productTypeId: number
  hour: number
  qty: number
}

interface StageReadyEvent {
  stageId: string
  hour: number
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
  scienceReadyByProduct: Map<number, number>,
): number {
  let start = slotMinStart

  const scienceReady = scienceReadyByProduct.get(node.productTypeId)
  if (scienceReady != null) start = Math.max(start, scienceReady)

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

function scheduleScienceStages(
  stages: PlanPipelineStage[],
  scienceSlots: number,
): { jobs: ScheduledPlanJob[]; readyByProduct: Map<number, number>; stageEnd: Map<string, number> } {
  const scienceStages = stages.filter((s) => s.pool === 'science')
  const slotFreeAt = Array.from({ length: Math.max(1, scienceSlots) }, () => 0)
  const jobs: ScheduledPlanJob[] = []
  const stageEnd = new Map<string, number>()
  const readyByProduct = new Map<number, number>()

  // Topological-ish: process in array order (copy before invent for same product).
  for (const stage of scienceStages) {
    let depEnd = 0
    for (const dep of stage.dependsOn) {
      depEnd = Math.max(depEnd, stageEnd.get(dep) ?? 0)
    }
    const slot = slotFreeAt.indexOf(Math.min(...slotFreeAt))
    const startHour = Math.max(slotFreeAt[slot] ?? 0, depEnd)
    const endHour = startHour + stage.durationHours
    jobs.push({
      productTypeId: stage.productTypeId,
      name: stage.name,
      slot,
      startHour,
      endHour,
      runs: stage.runs,
      outputQty: stage.runs,
      activity: stage.activity,
      pool: 'science',
    })
    slotFreeAt[slot] = endHour
    stageEnd.set(stage.id, endHour)
    const prev = readyByProduct.get(stage.productTypeId) ?? 0
    readyByProduct.set(stage.productTypeId, Math.max(prev, endHour))
  }

  return { jobs, readyByProduct, stageEnd }
}

function activityForNode(node: PlanNode, blueprints?: BlueprintInfo[]): PlanJobActivity {
  if (node.recipeKind === 'reaction') return 'reaction'
  if (blueprints) {
    const bp = getBlueprintForProduct(blueprints, node.productTypeId)
    if (bp && isReactionRecipe(bp)) return 'reaction'
  }
  return 'manufacture'
}

/** Greedy slot packing with build dependencies: parents wait for child supply + science. */
export function schedulePlanJobs(input: SchedulePlanInput): ScheduledPlanJob[] {
  const { nodes, slots, windowHours, pipeline, blueprints } = input
  const scienceSlots = input.scienceSlots ?? 1

  const scienceResult = pipeline
    ? scheduleScienceStages(pipeline.stages, scienceSlots)
    : { jobs: [] as ScheduledPlanJob[], readyByProduct: new Map<number, number>(), stageEnd: new Map() }

  const buildNodes = nodes.filter((n) => n.mode === 'build' && n.runs > 0)
  const byDepth = [...buildNodes].sort((a, b) => b.depth - a.depth)
  const nodesById = new Map(nodes.map((node) => [node.productTypeId, node]))

  const slotFreeAt = Array.from({ length: Math.max(1, slots) }, () => 0)
  const jobs: ScheduledPlanJob[] = [...scienceResult.jobs]
  const supplies: ScheduleEvent[] = []
  const demands: ScheduleEvent[] = []

  for (const node of byDepth) {
    let remainingRuns = node.runs
    const runsPerJob = Math.max(1, Math.ceil(node.runs / Math.max(1, node.concurrentCopies)))
    const activity = activityForNode(node, blueprints)

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
        scienceResult.readyByProduct,
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
        activity,
        pool: 'manufacturing' as PlanJobPool,
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
