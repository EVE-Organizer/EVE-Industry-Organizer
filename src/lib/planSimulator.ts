import type { PlanNode, PlanNodeSimulation, PlanTimeBucket, ScheduledPlanJob } from '@/types'

export interface SimulatePlanInput {
  nodes: PlanNode[]
  jobs: ScheduledPlanJob[]
  windowHours: number
  bucketHours?: number
}

/** Cap hourly buckets so long plans cannot freeze the UI. */
export const MAX_PLAN_SIM_BUCKETS = 720

export function resolveSimulationWindow(windowHours: number): number {
  if (!Number.isFinite(windowHours) || windowHours <= 0) return 1
  return Math.min(windowHours, 8760)
}

export function resolveSimBucketHours(windowHours: number, requested = 1): number {
  const span = resolveSimulationWindow(windowHours)
  return Math.max(requested, Math.ceil(span / MAX_PLAN_SIM_BUCKETS))
}

function indexJobsByProduct(jobs: ScheduledPlanJob[]): Map<number, ScheduledPlanJob[]> {
  const map = new Map<number, ScheduledPlanJob[]>()
  for (const job of jobs) {
    const list = map.get(job.productTypeId)
    if (list) list.push(job)
    else map.set(job.productTypeId, [job])
  }
  return map
}

function emptyBuckets(windowHours: number, bucketHours: number): PlanTimeBucket[] {
  const span = resolveSimulationWindow(windowHours)
  const count = Math.max(1, Math.ceil(span / bucketHours))
  const buckets: PlanTimeBucket[] = []
  for (let i = 0; i < count; i++) {
    buckets.push({ hour: i * bucketHours, supply: 0, demand: 0, inventory: 0 })
  }
  return buckets
}

export function simulatePlanFlow(input: SimulatePlanInput): Map<number, PlanNodeSimulation> {
  const windowHours = resolveSimulationWindow(input.windowHours)
  const bucketHours = resolveSimBucketHours(windowHours, input.bucketHours ?? 1)
  const count = Math.max(1, Math.ceil(windowHours / bucketHours))
  const jobsByProduct = indexJobsByProduct(input.jobs)
  const nodesById = new Map(input.nodes.map((node) => [node.productTypeId, node]))
  const result = new Map<number, PlanNodeSimulation>()

  for (const node of input.nodes) {
    const buckets = emptyBuckets(windowHours, bucketHours)

    for (const job of jobsByProduct.get(node.productTypeId) ?? []) {
      const idx = Math.min(count - 1, Math.floor(job.endHour / bucketHours))
      buckets[idx]!.supply += job.outputQty
    }

    if (node.demandByParent.length > 0) {
      for (const parentId of node.parentProductTypeIds) {
        const parentNode = nodesById.get(parentId)
        if (!parentNode) continue
        const demandEntry = node.demandByParent.find((d) => d.parentProductTypeId === parentId)
        if (!demandEntry) continue
        const fraction = demandEntry.qty / Math.max(1, parentNode.totalDemandQty)
        for (const job of jobsByProduct.get(parentId) ?? []) {
          const idx = Math.min(count - 1, Math.floor(job.startHour / bucketHours))
          buckets[idx]!.demand +=
            parentNode.outputQty * fraction * (job.runs / Math.max(1, parentNode.runs))
        }
      }
    }

    let inventory = 0
    const shortages: PlanNodeSimulation['shortages'] = []
    let shortageStart: number | null = null

    for (const bucket of buckets) {
      inventory += bucket.supply - bucket.demand
      bucket.inventory = inventory
      if (inventory < 0 && shortageStart == null) shortageStart = bucket.hour
      if (inventory >= 0 && shortageStart != null) {
        shortages.push({
          startHour: shortageStart,
          endHour: bucket.hour,
          deficit: Math.abs(Math.min(0, inventory)),
        })
        shortageStart = null
      }
    }
    if (shortageStart != null) {
      shortages.push({
        startHour: shortageStart,
        endHour: windowHours,
        deficit: Math.abs(Math.min(0, inventory)),
      })
    }

    result.set(node.productTypeId, { productTypeId: node.productTypeId, buckets, shortages })
  }

  return result
}

export interface PlanShortageRow {
  productTypeId: number
  name: string
  startHour: number
  endHour: number
  deficit: number
}

/** All shortage windows across the plan, sorted by peak deficit then start hour. */
export function collectPlanShortages(
  simulations: Map<number, PlanNodeSimulation>,
  nodes: PlanNode[],
): PlanShortageRow[] {
  const rows: PlanShortageRow[] = []

  for (const node of nodes) {
    const sim = simulations.get(node.productTypeId)
    if (!sim || sim.shortages.length === 0) continue
    for (const shortage of sim.shortages) {
      rows.push({
        productTypeId: node.productTypeId,
        name: node.name,
        ...shortage,
      })
    }
  }

  return rows.sort((a, b) => b.deficit - a.deficit || a.startHour - b.startHour)
}

/** Inventory remaining when the last scheduled job finishes. */
export function inventoryAtPlanEnd(
  simulations: Map<number, PlanNodeSimulation>,
  productTypeId: number,
): number {
  const sim = simulations.get(productTypeId)
  if (!sim || sim.buckets.length === 0) return 0
  return sim.buckets[sim.buckets.length - 1]!.inventory
}

export function simulationForPair(
  simulations: Map<number, PlanNodeSimulation>,
  supplierId: number,
  consumerId: number,
): PlanTimeBucket[] {
  const supplier = simulations.get(supplierId)
  const consumer = simulations.get(consumerId)
  if (!supplier || !consumer) return []

  const len = Math.max(supplier.buckets.length, consumer.buckets.length)
  const merged: PlanTimeBucket[] = []
  let inventory = 0
  for (let i = 0; i < len; i++) {
    const supply = supplier.buckets[i]?.supply ?? 0
    const demand = consumer.buckets[i]?.demand ?? 0
    inventory += supply - demand
    merged.push({
      hour: supplier.buckets[i]?.hour ?? consumer.buckets[i]?.hour ?? i,
      supply,
      demand,
      inventory,
    })
  }
  return merged
}
