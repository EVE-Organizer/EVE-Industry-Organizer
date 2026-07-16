import type { PlanNode, PlanNodeSimulation, PlanTimeBucket, ScheduledPlanJob } from '@/types'

export interface SimulatePlanInput {
  nodes: PlanNode[]
  jobs: ScheduledPlanJob[]
  windowHours: number
  bucketHours?: number
}

function emptyBuckets(windowHours: number, bucketHours: number): PlanTimeBucket[] {
  const count = Math.max(1, Math.ceil(windowHours / bucketHours))
  const buckets: PlanTimeBucket[] = []
  let inventory = 0
  for (let i = 0; i < count; i++) {
    buckets.push({ hour: i * bucketHours, supply: 0, demand: 0, inventory })
  }
  return buckets
}

export function simulatePlanFlow(input: SimulatePlanInput): Map<number, PlanNodeSimulation> {
  const bucketHours = input.bucketHours ?? 1
  const count = Math.max(1, Math.ceil(input.windowHours / bucketHours))
  const result = new Map<number, PlanNodeSimulation>()

  for (const node of input.nodes) {
    const buckets = emptyBuckets(input.windowHours, bucketHours)

    const supplyJobs = input.jobs.filter((j) => j.productTypeId === node.productTypeId)
    for (const job of supplyJobs) {
      const idx = Math.min(count - 1, Math.floor(job.endHour / bucketHours))
      buckets[idx].supply += job.outputQty
    }

    if (node.demandByParent.length > 0) {
      for (const parentId of node.parentProductTypeIds) {
        const parentJobs = input.jobs.filter((j) => j.productTypeId === parentId)
        for (const job of parentJobs) {
          const parentNode = input.nodes.find((n) => n.productTypeId === parentId)
          if (!parentNode) continue
          const demandEntry = node.demandByParent.find((d) => d.parentProductTypeId === parentId)
          if (!demandEntry) continue
          const fraction = demandEntry.qty / Math.max(1, parentNode.totalDemandQty)
          const idx = Math.min(count - 1, Math.floor(job.startHour / bucketHours))
          buckets[idx].demand += parentNode.outputQty * fraction * (job.runs / Math.max(1, parentNode.runs))
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
        endHour: input.windowHours,
        deficit: Math.abs(Math.min(0, inventory)),
      })
    }

    result.set(node.productTypeId, { productTypeId: node.productTypeId, buckets, shortages })
  }

  return result
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
