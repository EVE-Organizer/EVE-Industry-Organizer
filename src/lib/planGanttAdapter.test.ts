import { describe, expect, it } from 'vitest'
import { buildPlanGanttLanes } from '@/lib/planGanttAdapter'
import type { PlanNode, ScheduledPlanJob } from '@/types'

function job(partial: Partial<ScheduledPlanJob> & Pick<ScheduledPlanJob, 'startHour' | 'endHour'>): ScheduledPlanJob {
  return {
    productTypeId: 1,
    name: 'Job',
    slot: 0,
    runs: 1,
    outputQty: 1,
    activity: 'manufacture',
    pool: 'manufacturing',
    ...partial,
  }
}

describe('buildPlanGanttLanes', () => {
  it('omits manufacturing jobs that start after the production window', () => {
    const nodes: PlanNode[] = []
    const lanes = buildPlanGanttLanes(
      [
        job({ name: 'Alloy', startHour: 0, endHour: 81 }),
        job({ name: 'Barrage M', startHour: 500, endHour: 675 }),
      ],
      nodes,
      1,
      162,
      'manufacturing',
    )
    expect(lanes[0]!.bars.map((b) => b.label)).toEqual(['Alloy'])
    expect(lanes[0]!.sublabel).toContain('ends 81h')
  })
})
