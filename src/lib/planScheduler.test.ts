import { describe, expect, it } from 'vitest'
import { buildPlanPipeline } from '@/lib/planPipeline'
import { schedulePlanJobs, detectOverUnder, productReadyHours, scheduledDurationHours, windowHoursFromJobs } from '@/lib/planScheduler'
import { simulatePlanFlow } from '@/lib/planSimulator'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo, PlanNode } from '@/types'

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
    canToggle: false,
    ...partial,
  }
}

describe('schedulePlanJobs', () => {
  it('packs jobs into available slots without overlap on same slot', () => {
    const nodes = [
      mockNode({ productTypeId: 1, name: 'Child', depth: 2, runs: 20, jobTimeSeconds: 7200 }),
      mockNode({ productTypeId: 2, name: 'Parent', depth: 1, runs: 10, jobTimeSeconds: 3600 }),
    ]
    const jobs = schedulePlanJobs({ nodes, slots: 2, windowHours: 48 })
    const slot0 = jobs.filter((j) => j.slot === 0)
    const slot1 = jobs.filter((j) => j.slot === 1)
    expect(slot0.length).toBeGreaterThan(0)
    expect(slot1.length).toBeGreaterThan(0)
    for (const slotJobs of [slot0, slot1]) {
      for (let i = 1; i < slotJobs.length; i++) {
        expect(slotJobs[i].startHour).toBeGreaterThanOrEqual(slotJobs[i - 1].endHour - 0.001)
      }
    }
  })

  it('schedules deeper nodes before parents', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'Child',
        depth: 2,
        runs: 10,
        jobTimeSeconds: 3600,
        outputQty: 10,
        demandByParent: [{ parentProductTypeId: 2, qty: 10 }],
        parentProductTypeIds: [2],
      }),
      mockNode({
        productTypeId: 2,
        name: 'Parent',
        depth: 1,
        runs: 10,
        jobTimeSeconds: 3600,
        outputQty: 10,
        totalDemandQty: 10,
        childProductTypeIds: [1],
      }),
    ]
    const jobs = schedulePlanJobs({ nodes, slots: 1, windowHours: 48 })
    const childFirst = jobs.find((j) => j.productTypeId === 1)
    const parent = jobs.find((j) => j.productTypeId === 2)
    expect(childFirst).toBeDefined()
    expect(parent).toBeDefined()
    expect(childFirst!.endHour).toBeLessThanOrEqual(parent!.startHour + 0.001)
  })

  it('waits for child supply before starting parent on another slot', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'Child',
        depth: 2,
        runs: 10,
        jobTimeSeconds: 7200,
        outputQty: 10,
        demandByParent: [{ parentProductTypeId: 2, qty: 10 }],
        parentProductTypeIds: [2],
      }),
      mockNode({
        productTypeId: 2,
        name: 'Parent',
        depth: 1,
        runs: 10,
        jobTimeSeconds: 3600,
        outputQty: 10,
        totalDemandQty: 10,
        childProductTypeIds: [1],
      }),
    ]
    const jobs = schedulePlanJobs({ nodes, slots: 2, windowHours: 48 })
    const child = jobs.find((j) => j.productTypeId === 1)!
    const parent = jobs.find((j) => j.productTypeId === 2)!
    expect(parent.startHour).toBeGreaterThanOrEqual(child.endHour - 0.001)
  })

  it('keeps component inventory non-negative for a simple chain', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'Child',
        depth: 2,
        runs: 20,
        jobTimeSeconds: 7200,
        outputQty: 20,
        demandByParent: [{ parentProductTypeId: 2, qty: 20 }],
        parentProductTypeIds: [2],
      }),
      mockNode({
        productTypeId: 2,
        name: 'Parent',
        depth: 1,
        runs: 10,
        jobTimeSeconds: 3600,
        outputQty: 10,
        totalDemandQty: 10,
        childProductTypeIds: [1],
      }),
    ]
    const jobs = schedulePlanJobs({ nodes, slots: 11, windowHours: Number.POSITIVE_INFINITY })
    const windowHours = Math.max(...jobs.map((j) => j.endHour))
    const simulations = simulatePlanFlow({ nodes, jobs, windowHours })
    const shortages = [...simulations.values()].flatMap((sim) => sim.shortages)
    expect(shortages).toHaveLength(0)
  })

  it('schedules duplicate roots of the same product on separate slots in parallel', () => {
    const nodes = [
      mockNode({
        productTypeId: 200,
        name: 'Ship',
        isRoot: true,
        depth: 0,
        runs: 20,
        concurrentCopies: 2,
        jobTimeSeconds: 3600,
        outputQty: 20,
        totalDemandQty: 20,
      }),
    ]
    const jobs = schedulePlanJobs({ nodes, slots: 5, windowHours: 48 })
    const rootJobs = jobs.filter((j) => j.productTypeId === 200)
    expect(rootJobs).toHaveLength(2)
    expect(new Set(rootJobs.map((j) => j.slot)).size).toBe(2)
    expect(rootJobs[0].startHour).toBeCloseTo(0, 5)
    expect(rootJobs[1].startHour).toBeCloseTo(0, 5)
  })

  it('scales job duration by runs per chunk when concurrent copies split runs', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'Split',
        runs: 20,
        concurrentCopies: 2,
        jobTimeSeconds: 3600,
      }),
    ]
    const jobs = schedulePlanJobs({ nodes, slots: 2, windowHours: 48 })
    expect(jobs).toHaveLength(2)
    for (const job of jobs) {
      expect(job.endHour - job.startHour).toBeCloseTo(1, 5)
    }
    expect(jobs[0].runs + jobs[1].runs).toBe(20)
  })

  it('schedules science pool jobs before manufacture when pipeline includes invention', () => {
    const productTypeId = 500
    const blueprints: BlueprintInfo[] = [
      {
        blueprintTypeId: 15000,
        productTypeId,
        productQuantity: 1,
        manufacturingTime: 3600,
        materials: [],
        requiredSkills: {},
        tier: 't2',
        productGroup: 'Module',
        bpIconUrl: '',
        productIconUrl: '',
        productRenderUrl: '',
        invention: {
          t1BlueprintTypeId: 14000,
          datacores: [{ typeId: 11467, quantity: 1 }],
          runsPerBPC: 10,
          baseChance: 0.34,
          copyTime: 3600,
          inventionTime: 1800,
        },
      },
    ]
    const nodes = [
      mockNode({
        productTypeId,
        name: 'T2 Module',
        isRoot: true,
        depth: 0,
        runs: 10,
        jobTimeSeconds: 3600,
        outputQty: 10,
        unitPrice: 1_000_000,
      }),
    ]
    const pipeline = buildPlanPipeline({
      nodes,
      blueprints,
      settings: DEFAULT_SETTINGS,
      scienceSlots: 2,
      manufacturingSlots: 3,
    })

    const jobs = schedulePlanJobs({
      nodes,
      slots: 3,
      scienceSlots: 2,
      windowHours: 500,
      pipeline,
      blueprints,
    })

    const scienceJobs = jobs.filter((j) => j.pool === 'science')
    const mfgJobs = jobs.filter((j) => j.pool === 'manufacturing')
    expect(scienceJobs.length).toBeGreaterThan(0)
    expect(mfgJobs.length).toBeGreaterThan(0)
    for (const job of scienceJobs) {
      expect(job.pool).toBe('science')
    }
    for (const job of mfgJobs) {
      expect(job.pool).toBe('manufacturing')
    }

    const inventJob = scienceJobs.find((j) => j.activity === 'invention')
    const mfgJob = mfgJobs.find((j) => j.productTypeId === productTypeId)
    expect(inventJob).toBeDefined()
    expect(mfgJob).toBeDefined()
    expect(mfgJob!.startHour).toBeGreaterThanOrEqual(inventJob!.endHour - 1e-6)
  })
})

describe('productReadyHours', () => {
  it('returns the latest finish hour for that product', () => {
    const jobs = [
      { productTypeId: 1, name: 'A', slot: 0, startHour: 1894, endHour: 2063, runs: 1, outputQty: 1 },
      { productTypeId: 1, name: 'A copy', slot: 0, startHour: 0, endHour: 10, runs: 1, outputQty: 1 },
      { productTypeId: 2, name: 'B', slot: 0, startHour: 0, endHour: 50, runs: 1, outputQty: 1 },
    ]
    expect(productReadyHours(jobs, 1)).toBe(2063)
    expect(productReadyHours(jobs, 2)).toBe(50)
    expect(productReadyHours(jobs, 99)).toBeNull()
  })
})

describe('scheduledDurationHours', () => {
  it('returns wall-clock span across all jobs for a product', () => {
    const jobs = [
      { productTypeId: 1, name: 'A', slot: 0, startHour: 2, endHour: 5, runs: 10, outputQty: 10 },
      { productTypeId: 1, name: 'A', slot: 1, startHour: 0, endHour: 4, runs: 10, outputQty: 10 },
      { productTypeId: 2, name: 'B', slot: 0, startHour: 0, endHour: 1, runs: 5, outputQty: 5 },
    ]
    expect(scheduledDurationHours(jobs, 1)).toBe(5)
    expect(scheduledDurationHours(jobs, 2)).toBe(1)
    expect(scheduledDurationHours(jobs, 99)).toBe(0)
  })
})

describe('windowHoursFromJobs', () => {
  it('uses latest end hour with a minimum of 1', () => {
    expect(windowHoursFromJobs([])).toBe(1)
    expect(
      windowHoursFromJobs([
        { productTypeId: 1, name: 'A', slot: 0, startHour: 0, endHour: 12.5, runs: 1, outputQty: 1 },
      ]),
    ).toBe(12.5)
  })
})

describe('detectOverUnder', () => {
  it('flags under-production vs demand', () => {
    const warnings = detectOverUnder([
      mockNode({ productTypeId: 1, name: 'Widget', outputQty: 50, totalDemandQty: 100 }),
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('under')
  })
})
