import { describe, expect, it } from 'vitest'
import type { LiveIndustryJob } from '@/types'
import {
  computeResearchProgress,
  enrichLiveJob,
  iconTypeIdMapFromJobs,
  researchKindFromActivity,
  resolveLiveJobIconIds,
} from '@/pages/Jobs/liveJobDisplay'

const researchJob: LiveIndustryJob = {
  jobId: 2,
  characterId: 42,
  installerId: 42,
  blueprintId: 1000000010495,
  activityId: 4,
  activityLabel: 'ME research',
  blueprintTypeId: 31156,
  productTypeId: 31156,
  productName: '',
  facilityId: 1,
  locationId: 1,
  runs: 1,
  status: 'active',
  startAt: '2026-01-01T00:00:00Z',
  endAt: '2026-01-02T00:00:00Z',
  durationSeconds: 86400,
}

const blueprintItem = {
  itemId: 1000000010495,
  typeId: 31156,
  materialEfficiency: 0,
  timeEfficiency: 0,
  runs: -1,
}

const typeMap = new Map<number, string>([
  [31155, 'Medium Low Friction Nozzle Joints I'],
  [31156, 'Medium Low Friction Nozzle Joints I Blueprint'],
])

const blueprintByBpo = new Map([[31156, { productTypeId: 31155 }]])

describe('liveJobDisplay', () => {
  it('maps research activity ids to ME, TE, and Copy', () => {
    expect(researchKindFromActivity(4)).toBe('me')
    expect(researchKindFromActivity(3)).toBe('te')
    expect(researchKindFromActivity(5)).toBe('copy')
    expect(researchKindFromActivity(1)).toBeNull()
  })

  it('resolves product and blueprint icons for research jobs', () => {
    expect(resolveLiveJobIconIds(researchJob, blueprintByBpo)).toEqual({
      productTypeId: 31155,
      blueprintTypeId: 31156,
    })
  })

  it('enriches research jobs with percent progress when blueprint ME/TE is known', () => {
    const blueprintByItemId = new Map([[blueprintItem.itemId, blueprintItem]])
    const display = enrichLiveJob(researchJob, typeMap, blueprintByBpo, blueprintByItemId)

    expect(display.itemName).toBe('Medium Low Friction Nozzle Joints I')
    expect(display.researchProgress).toBe('ME 0% → 1% (1 run)')
    expect(display.displayLabel).toBe('ME 0% → 1% (1 run) · Medium Low Friction Nozzle Joints I')
    expect(display.researchKind).toBe('me')
  })

  it('computes TE percent progress and copy counts', () => {
    expect(
      computeResearchProgress({ ...researchJob, activityId: 3, runs: 8 }, { ...blueprintItem, timeEfficiency: 0 }),
    ).toBe('TE 0% → 16% (8 runs)')
    expect(
      computeResearchProgress({ ...researchJob, activityId: 4, runs: 8 }, { ...blueprintItem, materialEfficiency: 0 }),
    ).toBe('ME 0% → 8% (8 runs)')
    expect(
      computeResearchProgress({ ...researchJob, activityId: 3, runs: 1 }, { ...blueprintItem, timeEfficiency: 18 }),
    ).toBe('TE 18% → 20% (1 run)')
    expect(computeResearchProgress({ ...researchJob, activityId: 5, runs: 5, licensedRuns: 10 })).toBe(
      'Copy ×5 (10 runs/BPC)',
    )
  })

  it('builds icon map from enriched jobs', () => {
    const display = enrichLiveJob(researchJob, typeMap, blueprintByBpo)
    expect(iconTypeIdMapFromJobs([display]).get(31155)).toBe(31156)
  })
})
