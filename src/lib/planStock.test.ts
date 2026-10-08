import { describe, expect, it } from 'vitest'
import {
  allocateStartStock,
  jobComponentNeed,
  producedSinceStart,
  stepReadiness,
  stockStepProgress,
} from '@/lib/planStock'
import type { PlanNode } from '@/types'

function node(partial: Partial<PlanNode>): PlanNode {
  return {
    productTypeId: 1,
    name: 'x',
    mode: 'build',
    depth: 1,
    isRoot: false,
    isLeaf: false,
    totalDemandQty: 100,
    demandByParent: [],
    childProductTypeIds: [],
    runs: 1,
    runsPerBpc: 1,
    bpcCount: 1,
    concurrentCopies: 1,
    jobTimeSeconds: 1,
    outputQty: 100,
    ...partial,
  } as PlanNode
}

describe('allocateStartStock', () => {
  it('reduces non-root demand and never allocates a root', () => {
    const allocated = allocateStartStock(
      [node({ productTypeId: 1, isRoot: true, totalDemandQty: 50 }), node({ productTypeId: 2, totalDemandQty: 80, depth: 1 })],
      new Map([[2, 30]]),
    )
    expect(allocated).toEqual({ 2: 30 })
  })
})

describe('producedSinceStart', () => {
  it('stays up after a parent consumes the new output', () => {
    expect(
      producedSinceStart({ stockNow: 0, startStock: 10, allocated: 10, consumedByStartedParents: 40 }),
    ).toBe(40)
  })
})

describe('stepReadiness', () => {
  it('names a transfer when another character holds the inputs', () => {
    const text = stepReadiness({
      ownerName: 'Main',
      need: [{ typeId: 2, name: 'Robotics', qty: 300 }],
      pooled: new Map([[2, 300]]),
      byCharacter: [
        { name: 'Main', qty: new Map() },
        { name: 'Alt', qty: new Map([[2, 300]]) },
      ],
    })
    expect(text).toBe('Move Robotics ×300 Alt → Main')
  })
})

describe('stockStepProgress', () => {
  const steps = [1, 2, 3].map((bpoIndex) => ({
    productTypeId: 5,
    name: 'Part',
    slot: bpoIndex,
    startHour: 0,
    endHour: 1,
    runs: 10,
    outputQty: 10,
    activity: 'manufacture' as const,
    bpoIndex,
    stepKey: `manufacture:5:${bpoIndex}`,
  }))
  const part = node({ productTypeId: 5, demandByParent: [{ parentProductTypeId: 9, qty: 30 }] })

  it('marks as many steps done as the gained stock covers, in BPO order', () => {
    const done = stockStepProgress({
      jobs: steps,
      nodes: [part],
      startStock: { 5: 0 },
      allocated: { 5: 0 },
      pooled: new Map([[5, 25]]),
      progress: {},
    })
    expect(Object.keys(done).sort()).toEqual(['manufacture:5:1', 'manufacture:5:2'])
  })

  it('counts output a started parent already pulled out of stock', () => {
    const parentStep = { ...steps[0]!, productTypeId: 9, stepKey: 'manufacture:9:1', bpoIndex: 1 }
    const done = stockStepProgress({
      jobs: [...steps, parentStep],
      nodes: [part],
      startStock: { 5: 0 },
      allocated: { 5: 0 },
      pooled: new Map(),
      progress: { 'manufacture:9:1': { status: 'running', source: 'esi' } },
    })
    // The single parent step started, so all 30 units were consumed
    expect(Object.keys(done)).toHaveLength(3)
  })

  it('never overwrites a step tracked from ESI', () => {
    const done = stockStepProgress({
      jobs: steps,
      nodes: [part],
      startStock: { 5: 0 },
      allocated: { 5: 0 },
      pooled: new Map([[5, 30]]),
      progress: { 'manufacture:5:1': { status: 'running', source: 'esi', esiJobId: 4 } },
    })
    expect(done['manufacture:5:1']).toBeUndefined()
  })
})
describe('jobComponentNeed', () => {
  it('lists only built components, scaled by runs', () => {
    const need = jobComponentNeed({
      runs: 10,
      me: 0,
      materials: [
        { typeId: 2, quantity: 5 },
        { typeId: 34, quantity: 100 },
      ],
      builtTypeIds: new Set([2]),
      nameOf: () => 'Robotics',
    })
    expect(need).toEqual([{ typeId: 2, name: 'Robotics', qty: 50 }])
  })
})