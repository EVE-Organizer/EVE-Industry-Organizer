import { describe, expect, it } from 'vitest'
import {
  totalDurationFooterHours,
  totalReadyByFooterHours,
} from '@/pages/Plan/planJobsFooterTotals'
import { rowDurationHours, type BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'

function root(
  partial: Partial<BuildBlueprintRow> & Pick<BuildBlueprintRow, 'rootId'>,
): BuildBlueprintRow {
  return {
    name: 'Item',
    productTypeId: 1,
    runs: 1,
    jobTimeHours: 10,
    outputQty: 1,
    isRoot: true,
    enabled: true,
    ...partial,
  }
}

describe('totalReadyByFooterHours', () => {
  it('prefers latest ready-by deadline over scheduled finish', () => {
    const hours = totalReadyByFooterHours([
      root({ rootId: 'a', readyByHours: 100, finishesAtHours: 500 }),
      root({ rootId: 'b', readyByHours: 40, finishesAtHours: 480 }),
    ])
    expect(hours).toBe(100)
  })

  it('is empty when no root has a deadline', () => {
    const hours = totalReadyByFooterHours([
      root({ rootId: 'a', finishesAtHours: 120 }),
      root({ rootId: 'b', finishesAtHours: 80 }),
    ])
    expect(hours).toBeNull()
  })
})

describe('rowDurationHours', () => {
  it('uses stored target, not job timer, and treats 0 as unset', () => {
    expect(rowDurationHours(root({ rootId: 'a', durationHours: 24, jobTimeHours: 182 }))).toBe(24)
    expect(rowDurationHours(root({ rootId: 'a', durationHours: 0, jobTimeHours: 10 }))).toBe(10)
  })
})

describe('totalDurationFooterHours', () => {
  it('matches the Duration column (stored target over job timer)', () => {
    expect(
      totalDurationFooterHours([
        root({ rootId: 'a', durationHours: 24, jobTimeHours: 10 }),
        root({ rootId: 'b', jobTimeHours: 8 }),
      ]),
    ).toBe(24)
  })
})
