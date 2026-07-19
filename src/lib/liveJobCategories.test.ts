import { describe, expect, it } from 'vitest'
import type { LiveIndustryJob } from '@/types'
import {
  blueprintStackTypeId,
  blueprintTypeIdMapFromJobs,
  filterJobsByTab,
  isLiveManufacturingJob,
  isLiveResearchJob,
} from '@/lib/liveJobCategories'

const baseJob: LiveIndustryJob = {
  jobId: 1,
  characterId: 42,
  installerId: 42,
  blueprintId: 999,
  activityId: 1,
  activityLabel: 'Manufacturing',
  blueprintTypeId: 100,
  productTypeId: 200,
  productName: 'Test Item',
  facilityId: 1,
  locationId: 1,
  runs: 10,
  status: 'active',
  startAt: '2026-01-01T00:00:00Z',
  endAt: '2026-01-02T00:00:00Z',
  durationSeconds: 86400,
}

describe('liveJobCategories', () => {
  it('splits manufacturing and research jobs', () => {
    const mfg = { ...baseJob, activityId: 1 as const }
    const te = { ...baseJob, jobId: 2, activityId: 3 as const, activityLabel: 'TE research' }
    const jobs = [mfg, te]

    expect(isLiveManufacturingJob(mfg)).toBe(true)
    expect(isLiveResearchJob(te)).toBe(true)
    expect(filterJobsByTab(jobs, 'manufacturing')).toEqual([mfg])
    expect(filterJobsByTab(jobs, 'research')).toEqual([te])
  })

  it('stacks blueprint icon only when product differs from blueprint', () => {
    expect(blueprintStackTypeId(baseJob)).toBe(100)
    expect(blueprintStackTypeId({ ...baseJob, productTypeId: 100 })).toBeUndefined()

    const map = blueprintTypeIdMapFromJobs([baseJob, { ...baseJob, jobId: 2, productTypeId: 100 }])
    expect(map.get(200)).toBe(100)
    expect(map.has(100)).toBe(false)
  })
})
