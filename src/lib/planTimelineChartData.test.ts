import { describe, expect, it } from 'vitest'
import {
  buildSlotLanes,
  buildTimelineTicks,
  formatHourTick,
  layoutLaneBars,
  timelineBarStyle,
  timelineVisualRatio,
  TIMELINE_MIN_BAR_WIDTH_PCT,
} from '@/lib/planTimelineChartData'
import type { PlanNode, ScheduledPlanJob } from '@/types'

describe('buildSlotLanes', () => {
  it('preserves job start and end hours on each lane', () => {
    const jobs: ScheduledPlanJob[] = [
      {
        productTypeId: 1,
        name: 'Short',
        slot: 0,
        startHour: 0,
        endHour: 1,
        runs: 1,
        outputQty: 10,
      },
      {
        productTypeId: 2,
        name: 'Long',
        slot: 0,
        startHour: 3,
        endHour: 7,
        runs: 1,
        outputQty: 10,
      },
    ]
    const nodes = [
      { productTypeId: 1, depth: 2, name: 'Short' },
      { productTypeId: 2, depth: 1, name: 'Long' },
    ] as PlanNode[]

    const lanes = buildSlotLanes(jobs, nodes, 1)
    expect(lanes[0]!.jobs[0]).toMatchObject({ startHour: 0, endHour: 1, durationHours: 1 })
    expect(lanes[0]!.jobs[1]).toMatchObject({ startHour: 3, endHour: 7, durationHours: 4 })
    expect(lanes[0]!.busyHours).toBe(5)
  })
})

describe('formatHourTick', () => {
  it('avoids long floats', () => {
    expect(formatHourTick(100.33333333333333)).toBe('100h')
    expect(formatHourTick(12.5)).toBe('12.5h')
  })
})

describe('buildTimelineTicks', () => {
  it('spans 0 through windowHours', () => {
    expect(buildTimelineTicks(7)).toEqual([0, 1.75, 3.5, 5.25, 7])
  })
})

describe('timelineVisualRatio', () => {
  it('compresses long spans more than short ones', () => {
    const short = timelineVisualRatio(1, 10) - timelineVisualRatio(0, 10)
    const long = timelineVisualRatio(10, 10) - timelineVisualRatio(0, 10)
    expect(long).toBeGreaterThan(short)
    expect(long / short).toBeLessThan(10)
  })
})

describe('timelineBarStyle', () => {
  it('maps job hours to compressed track positions with a minimum width', () => {
    const style = timelineBarStyle({ startHour: 0, durationHours: 0.01 }, 8880)
    expect(style.visualWidthPct).toBeLessThan(TIMELINE_MIN_BAR_WIDTH_PCT)
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(TIMELINE_MIN_BAR_WIDTH_PCT)
  })
})

describe('layoutLaneBars', () => {
  it('stacks overlapping short jobs onto extra sub-rows', () => {
    const bars = [0, 1, 2, 3].map((i) => ({
      id: `job-${i}`,
      name: `Job ${i}`,
      startHour: 0,
      endHour: 0.5,
      durationHours: 0.5,
      runs: 1,
      outputQty: 1,
      productTypeId: i,
      depth: 1,
      isRoot: false,
    }))
    const { layouts, rowCount } = layoutLaneBars(bars, 8880)
    expect(rowCount).toBeGreaterThan(1)
    const rows = new Set([...layouts.values()].map((layout) => layout.row))
    expect(rows.size).toBeGreaterThan(1)
    for (const layout of layouts.values()) {
      expect(parseFloat(layout.width)).toBeGreaterThanOrEqual(TIMELINE_MIN_BAR_WIDTH_PCT)
    }
  })
})
