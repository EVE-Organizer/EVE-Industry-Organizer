import { describe, expect, it } from 'vitest'
import {
  assessReadyBy,
  findMaxRootRunsMeetingDeadline,
  suggestDeadlinePlan,
} from '@/pages/Plan/planDeadline'

/** Fake plan: finish = sum of (work / copies) for each component. */
function finishModel(work: Record<number, number>) {
  return (copies: Map<number, number>) =>
    Object.entries(work).reduce(
      (sum, [id, hours]) => sum + hours / (copies.get(Number(id)) ?? 1),
      0,
    )
}

describe('assessReadyBy', () => {
  it('offers Fix when the root job timer is longer than the deadline', () => {
    expect(
      assessReadyBy({
        readyByHours: 10,
        finishesAtHours: 500,
        rootJobHours: 24,
        componentBuildCount: 4,
      }),
    ).toMatchObject({ status: 'late', fixable: true })
  })

  it('offers Fix when components can move a deadline the root job can still meet', () => {
    expect(
      assessReadyBy({
        readyByHours: 100,
        finishesAtHours: 500,
        rootJobHours: 24,
        componentBuildCount: 3,
      }),
    ).toMatchObject({ status: 'late', fixable: true })
  })

  it('is on time when the chain finishes by the deadline', () => {
    expect(
      assessReadyBy({
        readyByHours: 500,
        finishesAtHours: 480,
        rootJobHours: 24,
        componentBuildCount: 2,
      }).status,
    ).toBe('onTime')
  })
})

describe('suggestDeadlinePlan', () => {
  it('suggests nothing when the root is already on time', () => {
    const result = suggestDeadlinePlan({
      readyByHours: 10,
      candidates: [{ productTypeId: 1, name: 'A', copies: 1 }],
      finishFor: finishModel({ 1: 6 }),
    })
    expect(result.steps).toEqual([])
    expect(result.meetsDeadline).toBe(true)
  })

  it('adds BPOs where they save the most time until the deadline is met', () => {
    const result = suggestDeadlinePlan({
      readyByHours: 12,
      candidates: [
        { productTypeId: 1, name: 'Slow', copies: 1 },
        { productTypeId: 2, name: 'Fast', copies: 1 },
      ],
      finishFor: finishModel({ 1: 16, 2: 4 }),
    })
    expect(result.steps[0]).toMatchObject({ productTypeId: 1, copies: 2 })
    expect(result.meetsDeadline).toBe(true)
    expect(result.finishesAtHours).toBeLessThanOrEqual(12)
  })

  it('jumps BPO counts when one extra copy cannot reach the deadline', () => {
    const result = suggestDeadlinePlan({
      readyByHours: 40,
      candidates: [{ productTypeId: 1, name: 'A', copies: 1 }],
      finishFor: finishModel({ 1: 1000 }),
    })
    expect(result.meetsDeadline).toBe(true)
    expect(result.steps.at(-1)?.copies).toBeGreaterThan(10)
  })

  it('hints that runs will drop when extra BPOs still miss the deadline', () => {
    const result = suggestDeadlinePlan({
      readyByHours: 1,
      candidates: [{ productTypeId: 1, name: 'A', copies: 1 }],
      finishFor: finishModel({ 1: 1000 }),
    })
    expect(result.meetsDeadline).toBe(false)
    expect(result.hint).toMatch(/lower runs/)
  })

  it('stops early when another BPO would not help', () => {
    const result = suggestDeadlinePlan({
      readyByHours: 1,
      candidates: [{ productTypeId: 1, name: 'A', copies: 1 }],
      finishFor: () => 20,
    })
    expect(result.steps).toEqual([])
    expect(result.meetsDeadline).toBe(false)
  })
})

describe('findMaxRootRunsMeetingDeadline', () => {
  it('picks the highest run count whose finish is on time', () => {
    const result = findMaxRootRunsMeetingDeadline({
      readyByHours: 100,
      currentRuns: 50,
      finishForRuns: (runs) => runs * 3,
    })
    expect(result.runs).toBe(33)
    expect(result.meetsDeadline).toBe(true)
    expect(result.finishesAtHours).toBeLessThanOrEqual(100)
  })

  it('raises runs when the current count finishes before the deadline', () => {
    const result = findMaxRootRunsMeetingDeadline({
      readyByHours: 100,
      currentRuns: 10,
      maxRuns: 50,
      finishForRuns: (runs) => runs * 3,
    })
    expect(result.runs).toBe(33)
    expect(result.meetsDeadline).toBe(true)
  })

  it('returns minimum runs when nothing meets the deadline', () => {
    const result = findMaxRootRunsMeetingDeadline({
      readyByHours: 5,
      currentRuns: 20,
      finishForRuns: () => 50,
    })
    expect(result.runs).toBe(1)
    expect(result.meetsDeadline).toBe(false)
  })
})
