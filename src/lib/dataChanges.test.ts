import { describe, expect, it } from 'vitest'
import { diffAssets, diffJobs, diffPrices, diffSkills } from '@/lib/dataChanges'

describe('diffJobs', () => {
  it('counts new, finished, and status changes', () => {
    const diff = diffJobs(
      [
        { jobId: 1, status: 'active' },
        { jobId: 2, status: 'active' },
      ],
      [
        { jobId: 1, status: 'ready' },
        { jobId: 2, status: 'paused' },
        { jobId: 3, status: 'active' },
      ],
    )
    expect(diff).toEqual({ finished: 1, added: 1, statusChanged: 1 })
  })
})

describe('diffAssets', () => {
  it('counts type ids whose quantity changed', () => {
    const before = new Map([
      [34, 10],
      [35, 5],
    ])
    const after = new Map([
      [34, 12],
      [35, 5],
      [36, 1],
    ])
    expect(diffAssets(before, after).changed).toBe(2)
  })
})

describe('diffSkills', () => {
  it('counts level changes', () => {
    expect(diffSkills({ industry: 4 }, { industry: 5, science: 1 }).changed).toBe(2)
  })
})

describe('diffPrices', () => {
  it('ignores moves under the threshold', () => {
    const before = new Map([[34, 100]])
    const after = new Map([[34, 100.2]])
    expect(diffPrices(before, after)).toEqual([])
    expect(diffPrices(before, new Map([[34, 110]]))).toEqual([
      { typeId: 34, before: 100, after: 110 },
    ])
  })
})
