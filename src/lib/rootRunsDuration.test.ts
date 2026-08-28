import { describe, expect, it } from 'vitest'
import {
  applyRootEntryPatch,
  createSyncedPlanRootEntry,
  inGameDurationHoursFromRuns,
  inGameRunsFromDurationHours,
  descendantProductIds,
  fitPlanToRootReadyDeadlines,
  scaleRunsToSlotDeadline,
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
  it('seeds job time from runs only when duration is unset', () => {
    const synced = syncRootEntry(
      { ...root, productionDurationHours: 0 },
      blueprint,
      DEFAULT_SETTINGS,
    )
    expect(synced.productionDurationHours).toBe(
      inGameDurationHoursFromRuns(blueprint, DEFAULT_SETTINGS, root.runs),
    )
  })

  it('keeps a stored duration target', () => {
    const synced = syncRootEntry(root, blueprint, DEFAULT_SETTINGS)
    expect(synced.productionDurationHours).toBe(24)
    expect(synced).toBe(root)
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
  it('keeps the typed duration and updates runs to match the job timer', () => {
    const next = applyRootEntryPatch(
      root,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
    )

    const expectedRuns = inGameRunsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24)

    expect(next.runs).toBe(expectedRuns)
    expect(next.productionDurationHours).toBe(24)
  })

  it('preserves long duration input as the stored target', () => {
    const next = applyRootEntryPatch(
      root,
      { productionDurationHours: 168 },
      blueprint,
      DEFAULT_SETTINGS,
    )

    expect(next.productionDurationHours).toBe(168)
    expect(next.runs).toBe(inGameRunsFromDurationHours(blueprint, DEFAULT_SETTINGS, 168))
  })

  it('does not overwrite stored duration when runs change', () => {
    const next = applyRootEntryPatch(
      root,
      { runs: 200 },
      blueprint,
      DEFAULT_SETTINGS,
    )

    expect(next.runs).toBe(200)
    expect(next.productionDurationHours).toBe(24)
  })
})

describe('scaleRunsToSlotDeadline', () => {
  it('shrinks runs when ready-by overruns the root deadline', () => {
    expect(scaleRunsToSlotDeadline(1000, 2063, 168)).toBe(Math.floor(1000 * (168 / 2063)))
  })

  it('leaves runs alone when the product already finishes inside the deadline', () => {
    expect(scaleRunsToSlotDeadline(100, 22, 168)).toBe(100)
  })
})

describe('descendantProductIds', () => {
  it('walks children and does not include the root', () => {
    const ids = descendantProductIds(1, [
      { productTypeId: 1, childProductTypeIds: [2, 3] },
      { productTypeId: 2, childProductTypeIds: [4] },
      { productTypeId: 3, childProductTypeIds: [] },
      { productTypeId: 4, childProductTypeIds: [] },
    ])
    expect([...ids].sort()).toEqual([2, 3, 4])
  })
})

describe('fitPlanToRootReadyDeadlines', () => {
  const childBp: BlueprintInfo = { ...blueprint, blueprintTypeId: 10002, productTypeId: 200 }
  const otherBp: BlueprintInfo = { ...blueprint, blueprintTypeId: 10003, productTypeId: 300 }
  const bps = new Map<number, BlueprintInfo>([
    [100, blueprint],
    [200, childBp],
    [300, otherBp],
  ])
  const nodes = [
    { productTypeId: 100, childProductTypeIds: [200], isRoot: true, mode: 'build' as const },
    { productTypeId: 200, childProductTypeIds: [], isRoot: false, mode: 'build' as const },
    { productTypeId: 300, childProductTypeIds: [200], isRoot: true, mode: 'build' as const },
  ]

  it('scales only the overrunning root to its own ready-by deadline', () => {
    const late: PlanRootEntry = { id: 'late', productTypeId: 100, runs: 1000, productionDurationHours: 168 }
    const onTime: PlanRootEntry = { id: 'ok', productTypeId: 300, runs: 80, productionDurationHours: 20 }
    const { roots } = fitPlanToRootReadyDeadlines({
      roots: [late, onTime],
      targets: [
        { rootId: 'late', deadlineHours: 168 },
        { rootId: 'ok', deadlineHours: 168 },
      ],
      readyHoursByProductId: new Map([
        [100, 2063],
        [300, 20],
      ]),
      nodes,
      nodeOverrides: {},
      settings: DEFAULT_SETTINGS,
      getBlueprint: (id) => bps.get(id),
    })
    expect(roots[0]!.runs).toBe(Math.floor(1000 * (168 / 2063)))
    expect(roots[0]!.productionDurationHours).toBe(168)
    expect(roots[1]!.runs).toBe(80)
  })

  it('does not grow runs when the deadline is later than ready-by', () => {
    const { roots } = fitPlanToRootReadyDeadlines({
      roots: [root],
      targets: [{ rootId: root.id, deadlineHours: 168 }],
      readyHoursByProductId: new Map([[100, 22]]),
      nodes: [{ productTypeId: 100, childProductTypeIds: [], isRoot: true, mode: 'build' }],
      nodeOverrides: {},
      settings: DEFAULT_SETTINGS,
      getBlueprint: () => blueprint,
    })
    expect(roots[0]!.runs).toBe(root.runs)
  })

  it('keeps a shared sub-build pin when another root still needs it', () => {
    const late: PlanRootEntry = { id: 'late', productTypeId: 100, runs: 1000, productionDurationHours: 168 }
    const onTime: PlanRootEntry = { id: 'ok', productTypeId: 300, runs: 80, productionDurationHours: 20 }
    const { nodeOverrides } = fitPlanToRootReadyDeadlines({
      roots: [late, onTime],
      targets: [
        { rootId: 'late', deadlineHours: 168 },
        { rootId: 'ok', deadlineHours: 168 },
      ],
      readyHoursByProductId: new Map([
        [100, 2063],
        [300, 20],
      ]),
      nodes,
      nodeOverrides: { 200: { runs: 500 } },
      settings: DEFAULT_SETTINGS,
      getBlueprint: (id) => bps.get(id),
    })
    expect(nodeOverrides[200]!.runs).toBe(500)
  })

  it('shrinks an unshared sub-build pin with the overrunning root', () => {
    const late: PlanRootEntry = { id: 'late', productTypeId: 100, runs: 1000, productionDurationHours: 168 }
    const { nodeOverrides } = fitPlanToRootReadyDeadlines({
      roots: [late],
      targets: [{ rootId: 'late', deadlineHours: 168 }],
      readyHoursByProductId: new Map([[100, 2063]]),
      nodes,
      nodeOverrides: { 200: { runs: 500 } },
      settings: DEFAULT_SETTINGS,
      getBlueprint: (id) => bps.get(id),
    })
    expect(nodeOverrides[200]!.runs).toBe(Math.floor(500 * (168 / 2063)))
  })
})

describe('resolveRunsFromPatch', () => {
  it('converts job time to runs for one in-game job (ignores slot count)', () => {
    const runs = resolveRunsFromPatch(
      100,
      { productionDurationHours: 24 },
      blueprint,
      DEFAULT_SETTINGS,
    )
    expect(runs).toBe(inGameRunsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24))
    expect(runs).not.toBe(runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 3))
  })

  it('returns explicit runs when provided', () => {
    expect(resolveRunsFromPatch(100, { runs: 150 }, blueprint, DEFAULT_SETTINGS)).toBe(150)
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

  it('keeps a stored 24 h target even when runs imply a longer job', () => {
    const staleRoot: PlanRootEntry = {
      id: 'root-nova',
      productTypeId: 206,
      runs: 1091,
      productionDurationHours: 24,
    }
    const synced = syncRootEntry(staleRoot, novaHeavyMissile, noBonusSettings)
    expect(synced.productionDurationHours).toBe(24)
  })
})

describe('runsFromDurationHours', () => {
  it('scales total runs with parallel lines for the same wall clock', () => {
    const oneLine = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 1)
    const threeLines = runsFromDurationHours(blueprint, DEFAULT_SETTINGS, 24, 3)
    expect(threeLines).toBeGreaterThan(oneLine)
  })
})
