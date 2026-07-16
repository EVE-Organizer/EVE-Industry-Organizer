import { describe, expect, it } from 'vitest'
import {
  applyRootEntryPatch,
  durationHoursFromRuns,
  resolveRunsFromPatch,
  runsFromDurationHours,
} from '@/lib/rootRunsDuration'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo, PlanRootEntry } from '@/types'

const blueprint: BlueprintInfo = {
  blueprintTypeId: 10001,
  productTypeId: 100,
  productQuantity: 1,
  manufacturingTime: 3600,
  materials: [],
  requiredSkills: {},
  tier: 't1',
  productGroup: 'Module',
  bpIconUrl: '',
  productIconUrl: '',
  productRenderUrl: '',
}

const root: PlanRootEntry = {
  productTypeId: 100,
  runs: 100,
  productionDurationHours: 24,
}

describe('applyRootEntryPatch', () => {
  it('snaps job time to actual wall-clock duration after hours input', () => {
    const slots = 6
    const next = applyRootEntryPatch(
      root,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
      slots,
    )

    const expectedRuns = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, slots)
    const expectedHours = durationHoursFromRuns(blueprint, DEFAULT_SETTINGS, expectedRuns, slots)

    expect(next.runs).toBe(expectedRuns)
    expect(next.productionDurationHours).toBe(expectedHours)
    expect(next.productionDurationHours).not.toBe(24)
  })

  it('updates job time when runs change', () => {
    const next = applyRootEntryPatch(
      root,
      { runs: 200 },
      blueprint,
      DEFAULT_SETTINGS,
      6,
    )

    expect(next.runs).toBe(200)
    expect(next.productionDurationHours).toBe(
      durationHoursFromRuns(blueprint, DEFAULT_SETTINGS, 200, 6),
    )
  })
})

describe('resolveRunsFromPatch', () => {
  it('converts job time to runs using concurrent copies', () => {
    const runs = resolveRunsFromPatch(
      100,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
      3,
    )
    expect(runs).toBe(runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 3))
  })

  it('returns explicit runs when provided', () => {
    expect(resolveRunsFromPatch(100, { runs: 150 }, blueprint, DEFAULT_SETTINGS, 3)).toBe(150)
  })
})
