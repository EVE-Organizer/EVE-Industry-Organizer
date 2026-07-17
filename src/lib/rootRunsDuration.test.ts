import { describe, expect, it } from 'vitest'
import {
  applyRootEntryPatch,
  createSyncedPlanRootEntry,
  durationHoursFromRuns,
  resolveRunsFromPatch,
  runsFromDurationHours,
  syncRootEntry,
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
  id: 'root-1',
  productTypeId: 100,
  runs: 100,
  productionDurationHours: 24,
}

describe('syncRootEntry', () => {
  it('recomputes job time from runs', () => {
    const synced = syncRootEntry(root, blueprint, DEFAULT_SETTINGS, 1)
    expect(synced.productionDurationHours).toBe(
      durationHoursFromRuns(blueprint, DEFAULT_SETTINGS, root.runs, 1),
    )
    expect(synced.productionDurationHours).not.toBe(24)
  })
})

describe('createSyncedPlanRootEntry', () => {
  it('creates a root with matching runs and job time', () => {
    const entry = createSyncedPlanRootEntry(100, blueprint, DEFAULT_SETTINGS, 1)
    expect(entry.runs).toBe(100)
    expect(entry.productionDurationHours).toBe(
      durationHoursFromRuns(blueprint, DEFAULT_SETTINGS, 100, 1),
    )
    expect('id' in entry).toBe(false)
  })
})

describe('applyRootEntryPatch', () => {
  it('snaps job time to actual wall-clock duration after hours input', () => {
    const parallelLines = 1
    const next = applyRootEntryPatch(
      root,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
      parallelLines,
    )

    const expectedRuns = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, parallelLines)
    const expectedHours = durationHoursFromRuns(
      blueprint,
      DEFAULT_SETTINGS,
      expectedRuns,
      parallelLines,
    )

    expect(next.runs).toBe(expectedRuns)
    expect(next.productionDurationHours).toBe(expectedHours)
    expect(next.productionDurationHours).not.toBe(24)
  })

  it('preserves long job time input for a single root line', () => {
    const next = applyRootEntryPatch(
      root,
      { productionDurationHours: 168 },
      blueprint,
      DEFAULT_SETTINGS,
      1,
    )

    expect(next.productionDurationHours).toBeGreaterThan(160)
    expect(next.productionDurationHours).toBeLessThanOrEqual(168)
  })

  it('updates job time when runs change', () => {
    const next = applyRootEntryPatch(
      root,
      { runs: 200 },
      blueprint,
      DEFAULT_SETTINGS,
      1,
    )

    expect(next.runs).toBe(200)
    expect(next.productionDurationHours).toBe(
      durationHoursFromRuns(blueprint, DEFAULT_SETTINGS, 200, 1),
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

describe('runsFromDurationHours', () => {
  it('scales total runs with parallel lines for the same wall clock', () => {
    const oneLine = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 1)
    const threeLines = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 3)
    expect(threeLines).toBeGreaterThan(oneLine)
  })
})
