import { describe, expect, it } from 'vitest'
import { buildPlanPhases, describeInstall, nextInstallJob } from '@/lib/planPhases'
import type { PlanNode, ScheduledPlanJob } from '@/types'

function job(
  partial: Partial<ScheduledPlanJob> & Pick<ScheduledPlanJob, 'productTypeId' | 'activity'>,
): ScheduledPlanJob {
  return {
    name: 'item',
    slot: 0,
    startHour: 0,
    endHour: 1,
    runs: 1,
    outputQty: 1,
    pool: 'manufacturing',
    ...partial,
  }
}

describe('buildPlanPhases', () => {
  it('orders research, reactions, deep components, then finals, and records overlaps', () => {
    const nodes = [
      { productTypeId: 1, depth: 0 },
      { productTypeId: 2, depth: 2 },
    ] as PlanNode[]
    const phases = buildPlanPhases(
      [
        job({ productTypeId: 1, activity: 'manufacture', startHour: 2, endHour: 4 }),
        job({ productTypeId: 2, activity: 'manufacture', startHour: 0, endHour: 3 }),
        job({ productTypeId: 9, activity: 'invention', startHour: 0, endHour: 1, pool: 'science' }),
      ],
      nodes,
    )
    expect(phases.map((phase) => phase.id)).toEqual(['research', 'components-2', 'final'])
    expect(phases[2]?.overlaps).toContain('Components · depth 2')
  })
  it('carries progress status and counts finished steps', () => {
    const phases = buildPlanPhases(
      [
        job({ productTypeId: 1, activity: 'manufacture', stepKey: 'manufacture:1:1' }),
        job({
          productTypeId: 1,
          activity: 'manufacture',
          stepKey: 'manufacture:1:2',
          startHour: 1,
        }),
      ],
      [{ productTypeId: 1, depth: 0 }] as PlanNode[],
      { 'manufacture:1:1': { status: 'done', source: 'esi' } },
    )
    expect(phases[0]?.doneCount).toBe(1)
    expect(phases[0]?.steps.map((s) => s.status)).toEqual(['done', 'todo'])
  })
})

describe('nextInstallJob', () => {
  it('skips running and finished steps and names the owner', () => {
    const jobs = [
      job({ productTypeId: 1, activity: 'manufacture', stepKey: 'a', startHour: 0 }),
      job({
        productTypeId: 2,
        activity: 'manufacture',
        stepKey: 'b',
        startHour: 2,
        name: 'Rifter',
        runs: 10,
        bpoIndex: 2,
      }),
    ]
    const next = nextInstallJob(jobs, { a: { status: 'running', source: 'esi' } })
    expect(next?.stepKey).toBe('b')
    expect(describeInstall(next!, 'Main')).toBe(
      'Next install: Install Rifter, BPO #2, 10 runs, as Main at 2.0h.',
    )
  })
})
