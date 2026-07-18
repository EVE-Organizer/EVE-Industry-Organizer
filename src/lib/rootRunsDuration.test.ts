import { describe, expect, it } from 'vitest'
import {
  applyRootEntryPatch,
  createSyncedPlanRootEntry,
  durationHoursFromRuns,
  inGameDurationHoursFromRuns,
  inGameRunsFromDurationHours,
  jobTimeSecondsForRuns,
  resolveRunsFromPatch,
  runsForDemand,
  runsFromDurationHours,
  syncRootEntry,
} from '@/lib/rootRunsDuration'
import { applyTE } from '@/lib/cost'
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
    const synced = syncRootEntry(root, blueprint, DEFAULT_SETTINGS)
    expect(synced.productionDurationHours).toBe(
      inGameDurationHoursFromRuns(blueprint, DEFAULT_SETTINGS, root.runs),
    )
    expect(synced.productionDurationHours).not.toBe(24)
  })
})

describe('createSyncedPlanRootEntry', () => {
  it('creates a root with matching runs and job time', () => {
    const entry = createSyncedPlanRootEntry(100, blueprint, DEFAULT_SETTINGS)
    expect(entry.runs).toBe(100)
    expect(entry.productionDurationHours).toBe(
      inGameDurationHoursFromRuns(blueprint, DEFAULT_SETTINGS, 100),
    )
    expect('id' in entry).toBe(false)
  })
})

describe('applyRootEntryPatch', () => {
  it('snaps job time to actual wall-clock duration after hours input', () => {
    const next = applyRootEntryPatch(
      root,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
    )

    const expectedRuns = inGameRunsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24)
    const expectedHours = inGameDurationHoursFromRuns(
      blueprint,
      DEFAULT_SETTINGS,
      expectedRuns,
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
    )

    expect(next.productionDurationHours).toBeGreaterThan(160)
    expect(next.productionDurationHours).toBeLessThanOrEqual(168.01)
  })

  it('updates job time when runs change', () => {
    const next = applyRootEntryPatch(
      root,
      { runs: 200 },
      blueprint,
      DEFAULT_SETTINGS,
    )

    expect(next.runs).toBe(200)
    expect(next.productionDurationHours).toBe(
      inGameDurationHoursFromRuns(blueprint, DEFAULT_SETTINGS, 200),
    )
  })
})

describe('resolveRunsFromPatch', () => {
  it('converts job time to runs for one in-game job (ignores slot count)', () => {
    const runs = resolveRunsFromPatch(
      100,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
      3,
    )
    expect(runs).toBe(inGameRunsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24))
    expect(runs).not.toBe(runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 3))
  })

  it('returns explicit runs when provided', () => {
    expect(resolveRunsFromPatch(100, { runs: 150 }, blueprint, DEFAULT_SETTINGS, 3)).toBe(150)
  })
})

describe('runsForDemand', () => {
  it('uses exact ceil without batch stepping', () => {
    expect(runsForDemand(1, 35)).toBe(35)
    expect(runsForDemand(5, 12)).toBe(3)
  })
})

describe('jobTimeSecondsForRuns', () => {
  it('matches applyTE for a single parallel line', () => {
    const seconds = jobTimeSecondsForRuns(blueprint, DEFAULT_SETTINGS, 100, 1)
    expect(seconds).toBe(
      applyTE(
        blueprint.manufacturingTime,
        DEFAULT_SETTINGS.teDefault,
        100,
        DEFAULT_SETTINGS.skills.industry ?? 0,
        DEFAULT_SETTINGS.skills.advancedIndustry ?? 0,
      ),
    )
  })
})

describe('Nova Heavy Missile (product 206)', () => {
  const novaHeavyMissile: BlueprintInfo = {
    blueprintTypeId: 807,
    productTypeId: 206,
    productQuantity: 100,
    manufacturingTime: 600,
    materials: [],
    requiredSkills: {},
    tier: 't1',
    productGroup: 'Heavy Missile',
    bpIconUrl: '',
    productIconUrl: '',
    productRenderUrl: '',
  }

  const noBonusSettings = {
    ...DEFAULT_SETTINGS,
    teDefault: 0,
    meDefault: 0,
    skills: { ...DEFAULT_SETTINGS.skills, industry: 0, advancedIndustry: 0 },
  }

  const industryOneSettings = {
    ...noBonusSettings,
    skills: { ...noBonusSettings.skills, industry: 1 },
  }

  it('6 runs ≈ 1 hr at TE 0 (not ~45 runs from slot multiplication)', () => {
    const hours = inGameDurationHoursFromRuns(novaHeavyMissile, noBonusSettings, 6)
    expect(hours).toBeCloseTo(1, 5)

    const runsInOneHour = inGameRunsFromDurationHours(novaHeavyMissile, noBonusSettings, 1)
    expect(runsInOneHour).toBe(6)
    expect(runsInOneHour).not.toBeGreaterThan(10)
  })

  it('matches in-game 57:36 for 6 runs with Industry I', () => {
    const seconds = jobTimeSecondsForRuns(novaHeavyMissile, industryOneSettings, 6, 1)
    expect(seconds).toBeCloseTo(57 * 60 + 36, 0)
  })

  it('TE 20 cuts time by 20% (not 80%)', () => {
    const te20Settings = {
      ...noBonusSettings,
      teDefault: 20,
    }
    const hours = inGameDurationHoursFromRuns(novaHeavyMissile, te20Settings, 6)
    // 600 * 6 * 0.8 / 3600 = 0.8 h
    expect(hours).toBeCloseTo(0.8, 5)
  })

  it('1091 runs × 10 min/run = 181.833… h (in-game job timer, no TE)', () => {
    const hours = inGameDurationHoursFromRuns(novaHeavyMissile, noBonusSettings, 1091)
    expect(hours).toBeCloseTo((1091 * 600) / 3600, 5)
    expect(hours).toBeCloseTo(181.833333, 3)
    expect(hours).not.toBe(24)
  })

  it('syncs job time when runs change from stale 24 h default', () => {
    const staleRoot: PlanRootEntry = {
      id: 'root-nova',
      productTypeId: 206,
      runs: 1091,
      productionDurationHours: 24,
    }
    const synced = syncRootEntry(staleRoot, novaHeavyMissile, noBonusSettings)
    expect(synced.productionDurationHours).toBeCloseTo(181.833333, 3)
    expect(synced.productionDurationHours).not.toBe(24)
  })
})

describe('runsFromDurationHours', () => {
  it('scales total runs with parallel lines for the same wall clock', () => {
    const oneLine = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 1)
    const threeLines = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 3)
    expect(threeLines).toBeGreaterThan(oneLine)
  })
})
