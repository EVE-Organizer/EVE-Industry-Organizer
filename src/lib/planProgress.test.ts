import { describe, expect, it } from 'vitest'
import {
  chainProductIds,
  fixedJobsFromProgress,
  matchLiveJobsToSteps,
  mergeProgress,
  progressForProducts,
  progressStepsFromJobs,
  planBehindAndEta,
  rootProgress,
  snapshotFromJobs,
  syncPlanProgress,
} from '@/lib/planProgress'
import type { LiveIndustryJob, PlanStepProgress } from '@/types'

function live(partial: Partial<LiveIndustryJob>): LiveIndustryJob {
  return {
    jobId: 1,
    characterId: 7,
    installerId: 7,
    blueprintId: 1,
    activityId: 1,
    activityLabel: 'Manufacturing',
    blueprintTypeId: 100,
    productTypeId: 200,
    productName: 'Widget',
    facilityId: 1,
    locationId: 1,
    runs: 10,
    status: 'active',
    startAt: '2026-10-07T12:00:00Z',
    endAt: '2026-10-07T20:00:00Z',
    durationSeconds: 1,
    ...partial,
  }
}

describe('matchLiveJobsToSteps', () => {
  it('keeps a saved done match after the job vanishes and picks the closest run count', () => {
    const steps = [
      {
        stepKey: 'manufacture:200:1',
        characterId: 7,
        activityId: 1,
        productTypeId: 200,
        runs: 10,
        durationHours: 2,
      },
      {
        stepKey: 'manufacture:200:2',
        characterId: 7,
        activityId: 1,
        productTypeId: 200,
        runs: 40,
        durationHours: 4,
      },
    ]
    const existing: Record<string, PlanStepProgress> = {
      'manufacture:200:1': { status: 'done', source: 'esi', esiJobId: 99 },
    }
    const next = matchLiveJobsToSteps(
      steps,
      [live({ jobId: 5, runs: 40, status: 'ready' })],
      '2026-10-07T00:00:00Z',
      existing,
    )
    expect(next['manufacture:200:1']?.status).toBe('done')
    expect(next['manufacture:200:2']?.esiJobId).toBe(5)
    expect(next['manufacture:200:2']?.status).toBe('done')
  })
})

describe('mergeProgress', () => {
  it('lets manual status win over ESI and stock', () => {
    const manual: PlanStepProgress = { status: 'done', source: 'manual' }
    expect(
      mergeProgress(
        { status: 'running', source: 'esi' },
        { status: 'done', source: 'stock' },
        manual,
      ),
    ).toBe(manual)
  })
})

describe('planBehindAndEta', () => {
  it('reports behind hours when now is ahead of linear progress', () => {
    const result = planBehindAndEta({
      jobs: [
        {
          productTypeId: 1,
          name: 'x',
          slot: 0,
          startHour: 0,
          endHour: 10,
          runs: 1,
          outputQty: 1,
          stepKey: 'a',
        },
      ],
      progress: {},
      nowHour: 5,
      startedAtMs: Date.parse('2026-01-01T00:00:00Z'),
      windowHours: 10,
    })
    expect(result.behindHours).toBe(5)
    expect(result.eta.toISOString()).toBe('2026-01-01T10:00:00.000Z')
  })
})

describe('rootProgress', () => {
  it('weights percent by job duration', () => {
    const result = rootProgress(
      [
        { stepKey: 'a', durationHours: 1 },
        { stepKey: 'b', durationHours: 3 },
      ],
      { a: { status: 'done', source: 'manual' } },
    )
    expect(result).toEqual({ done: 1, total: 2, percent: 25, runningPercent: 0 })
  })
})

describe('plan step helpers', () => {
  const jobs = [
    {
      productTypeId: 200,
      name: 'T2',
      slot: 0,
      startHour: 0,
      endHour: 2,
      runs: 10,
      outputQty: 0,
      activity: 'invention' as const,
      stepKey: 'invention:200:1',
      characterKey: 'sso:7' as const,
    },
    {
      productTypeId: 200,
      name: 'T2',
      slot: 1,
      startHour: 2,
      endHour: 6,
      runs: 10,
      outputQty: 10,
      activity: 'manufacture' as const,
      stepKey: 'manufacture:200:1',
    },
  ]

  it('matches copy and invention steps on the T1 blueprint', () => {
    const blueprint = {
      blueprintTypeId: 201,
      productTypeId: 200,
      invention: { t1BlueprintTypeId: 101 },
    } as never
    const steps = progressStepsFromJobs(jobs, new Map([[200, blueprint]]))
    expect(steps[0]).toMatchObject({ activityId: 8, blueprintTypeId: 101, characterId: 7 })
    expect(steps[1]).toMatchObject({ activityId: 1, blueprintTypeId: 201, durationHours: 4 })
  })

  it('freezes runs and owner for Start plan', () => {
    expect(snapshotFromJobs(jobs)['invention:200:1']).toEqual({ runs: 10, characterKey: 'sso:7' })
  })

  it('locks running and done steps at their real hours since start', () => {
    const fixed = fixedJobsFromProgress(
      {
        a: {
          status: 'running',
          source: 'esi',
          startedAt: '2026-10-07T02:00:00Z',
          endedAt: '2026-10-07T05:00:00Z',
        },
        b: { status: 'done', source: 'stock' },
        c: { status: 'todo', source: 'manual' },
      },
      '2026-10-07T00:00:00Z',
    )
    expect(fixed).toHaveLength(2)
    expect(fixed.find((f) => f.stepKey === 'a')).toMatchObject({ startHour: 2, endHour: 5 })
    expect(fixed.find((f) => f.stepKey === 'b')).toMatchObject({ startHour: 0, endHour: 0 })
  })
})
describe('syncPlanProgress', () => {
  const steps = [
    {
      stepKey: 'manufacture:200:1',
      characterId: 7,
      activityId: 1,
      productTypeId: 200,
      runs: 10,
      durationHours: 2,
    },
  ]

  it('prefers a manual mark over ESI and ESI over stock', () => {
    const base = {
      steps,
      liveJobs: [live({ jobId: 5, status: 'ready' })],
      startedAt: '2026-10-07T00:00:00Z',
      stockFor: () => ({
        'manufacture:200:1': { status: 'done' as const, source: 'stock' as const },
      }),
    }
    const fromEsi = syncPlanProgress({ ...base, persisted: {} })
    expect(fromEsi['manufacture:200:1']?.source).toBe('esi')

    const manual = syncPlanProgress({
      ...base,
      persisted: { 'manufacture:200:1': { status: 'todo', source: 'manual' } },
    })
    expect(manual['manufacture:200:1']).toMatchObject({ source: 'manual', status: 'todo' })
  })

  it('falls back to stock when no ESI job matches', () => {
    const progress = syncPlanProgress({
      steps,
      liveJobs: [],
      startedAt: '2026-10-07T00:00:00Z',
      persisted: {},
      stockFor: () => ({ 'manufacture:200:1': { status: 'done', source: 'stock' } }),
    })
    expect(progress['manufacture:200:1']?.source).toBe('stock')
  })
})
describe('chain progress', () => {
  it('walks children and survives a cycle', () => {
    const nodes = [
      { productTypeId: 1, childProductTypeIds: [2] },
      { productTypeId: 2, childProductTypeIds: [1, 3] },
      { productTypeId: 3, childProductTypeIds: [] },
    ]
    expect([...chainProductIds(nodes, 1)].sort()).toEqual([1, 2, 3])
  })

  it('weights progress by step duration', () => {
    const job = (productTypeId: number, endHour: number, stepKey: string) => ({
      productTypeId,
      name: 'x',
      slot: 0,
      startHour: 0,
      endHour,
      runs: 1,
      outputQty: 1,
      stepKey,
    })
    const result = progressForProducts(
      [job(1, 1, 'a'), job(2, 3, 'b')],
      { a: { status: 'done', source: 'esi' } },
      new Set([1, 2]),
    )
    expect(result).toEqual({ done: 1, total: 2, percent: 25, runningPercent: 0 })
  })
})
