import { describe, expect, it } from 'vitest'
import { buildLiveTimelineWindow, liveJobProgress, liveJobsToGanttLanes } from '@/lib/liveTimelineAdapter'
import type { LiveIndustryJob } from '@/types'

const baseJob: LiveIndustryJob = {
  jobId: 1,
  characterId: 42,
  installerId: 42,
  blueprintId: 999,
  activityId: 1,
  activityLabel: 'Manufacturing',
  blueprintTypeId: 2046,
  productTypeId: 2046,
  productName: 'Rifter',
  facilityId: 60003760,
  locationId: 60003760,
  runs: 10,
  status: 'active',
  startAt: '2026-01-01T10:00:00Z',
  endAt: '2026-01-01T12:00:00Z',
  durationSeconds: 7200,
}

describe('liveTimelineAdapter', () => {
  it('builds a window that includes active jobs', () => {
    const now = Date.parse('2026-01-01T11:00:00Z')
    const window = buildLiveTimelineWindow([baseJob], now)
    expect(window.startMs).toBeLessThanOrEqual(now)
    expect(window.endMs).toBeGreaterThanOrEqual(Date.parse(baseJob.endAt))
  })

  it('maps jobs into gantt lanes', () => {
    const window = buildLiveTimelineWindow([baseJob], Date.parse('2026-01-01T11:00:00Z'))
    const lanes = liveJobsToGanttLanes([baseJob], 2, window)
    expect(lanes).toHaveLength(2)
    expect(lanes.some((lane) => lane.bars.length === 1)).toBe(true)
    const bar = lanes.flatMap((lane) => lane.bars)[0]
    expect(bar?.label).toBe('Rifter')
    expect(bar?.start).toBeGreaterThanOrEqual(0)
    expect(bar?.end).toBeLessThanOrEqual(1)
  })

  it('computes live job progress from start and end times', () => {
    const now = Date.parse('2026-01-01T11:00:00Z')
    const progress = liveJobProgress(baseJob, now)
    expect(progress.ratio).toBe(0.5)
    expect(progress.remainingMs).toBe(3_600_000)
    expect(progress.animating).toBe(true)
  })

  it('stops animating paused and finished jobs', () => {
    const now = Date.parse('2026-01-01T11:00:00Z')
    expect(liveJobProgress({ ...baseJob, status: 'paused' }, now).animating).toBe(false)
    expect(liveJobProgress({ ...baseJob, status: 'ready' }, now).ratio).toBe(1)
    expect(liveJobProgress(baseJob, Date.parse(baseJob.endAt)).animating).toBe(false)
  })

  it('reports remaining time for in-flight jobs', () => {
    const now = Date.parse('2026-01-01T11:00:00Z')
    const progress = liveJobProgress(baseJob, now)
    expect(progress.remainingMs).toBe(3_600_000)
    expect(progress.animating).toBe(true)
  })
})
