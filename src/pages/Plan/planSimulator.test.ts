import { describe, expect, it } from 'vitest'
import {
  MAX_PLAN_SIM_BUCKETS,
  resolveSimBucketHours,
  resolveSimulationWindow,
  simulatePlanFlow,
} from '@/pages/Plan/planSimulator'
import type { PlanNode, ScheduledPlanJob } from '@/types'

function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name'>): PlanNode {
  return {
    mode: 'build',
    totalDemandQty: 100,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: 10,
    bpcCount: 1,
    concurrentCopies: 1,
    jobTimeSeconds: 3600,
    outputQty: 10,
    isRoot: false,
    isLeaf: false,
    depth: 1,
    canToggle: true,
    ...partial,
  }
}

describe('planSimulator safety', () => {
  it('does not allocate unbounded buckets for non-finite windows', () => {
    const nodes = [mockNode({ productTypeId: 1, name: 'A' })]
    const jobs: ScheduledPlanJob[] = [
      { productTypeId: 1, name: 'A', slot: 0, startHour: 0, endHour: 10, runs: 1, outputQty: 1 },
    ]

    const sim = simulatePlanFlow({ nodes, jobs, windowHours: Number.POSITIVE_INFINITY })
    const buckets = sim.get(1)?.buckets ?? []

    expect(buckets.length).toBeLessThanOrEqual(MAX_PLAN_SIM_BUCKETS)
    expect(buckets.length).toBeGreaterThan(0)
  })

  it('widens bucket size for long plans', () => {
    expect(resolveSimulationWindow(Number.POSITIVE_INFINITY)).toBe(1)
    const span = resolveSimulationWindow(50_000)
    const bucketHours = resolveSimBucketHours(50_000)
    expect(bucketHours).toBeGreaterThan(1)
    expect(Math.ceil(span / bucketHours)).toBeLessThanOrEqual(MAX_PLAN_SIM_BUCKETS)
  })
})
