import { describe, expect, it } from 'vitest'
import { buildPlanGanttLanes } from '@/pages/Plan/planGanttAdapter'
import type { PlanNode, ScheduledPlanJob } from '@/types'

function job(
  partial: Partial<ScheduledPlanJob> & Pick<ScheduledPlanJob, 'startHour' | 'endHour'>,
): ScheduledPlanJob {
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

  it('merges consecutive same product and activity into one bar with count', () => {
    const nodes: PlanNode[] = []
    const lanes = buildPlanGanttLanes(
      [
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 0,
          endHour: 2,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 2,
          endHour: 4,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 4,
          endHour: 6,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 6,
          endHour: 8,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 8,
          endHour: 10,
          activity: 'copy',
          pool: 'science',
        }),
      ],
      nodes,
      1,
      110,
      'science',
    )

    expect(lanes[0]!.bars).toHaveLength(1)
    const bar = lanes[0]!.bars[0]!
    expect(bar.meta?.count).toBe(5)
    expect(bar.start).toBeCloseTo(0)
    expect(bar.end).toBeCloseTo(10 / 110)
    expect(bar.duration).toBeCloseTo(10)
    expect(bar.meta?.runs).toBe(5)
    expect(lanes[0]!.jobCount).toBe(5)
    expect(lanes[0]!.sublabel).toContain('5 jobs')
  })

  it('does not merge same product with different activity', () => {
    const nodes: PlanNode[] = []
    const lanes = buildPlanGanttLanes(
      [
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 0,
          endHour: 2,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 2,
          endHour: 4,
          activity: 'invention',
          pool: 'science',
        }),
      ],
      nodes,
      1,
      24,
      'science',
    )

    expect(lanes[0]!.bars).toHaveLength(2)
    expect(lanes[0]!.bars[0]!.meta?.count).toBeUndefined()
    expect(lanes[0]!.bars[1]!.meta?.count).toBeUndefined()
  })

  it('splits merge groups when a different product appears in the middle', () => {
    const nodes: PlanNode[] = []
    const lanes = buildPlanGanttLanes(
      [
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 0,
          endHour: 2,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 2,
          endHour: 4,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Other',
          productTypeId: 200,
          startHour: 4,
          endHour: 6,
          activity: 'copy',
          pool: 'science',
        }),
        job({
          name: 'Hail M',
          productTypeId: 100,
          startHour: 6,
          endHour: 8,
          activity: 'copy',
          pool: 'science',
        }),
      ],
      nodes,
      1,
      24,
      'science',
    )

    expect(lanes[0]!.bars).toHaveLength(3)
    expect(lanes[0]!.bars[0]!.meta?.count).toBe(2)
    expect(lanes[0]!.bars[1]!.meta?.count).toBeUndefined()
    expect(lanes[0]!.bars[2]!.meta?.count).toBeUndefined()
    expect(lanes[0]!.jobCount).toBe(4)
    expect(lanes[0]!.sublabel).toContain('4 jobs')
  })
})
