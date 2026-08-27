import { describe, expect, it } from 'vitest'
import { applyTE } from '@/lib/cost'
import { resolveRankingRuns, resolveRankingRunsFromTime } from '@/lib/ranking'
import { DEFAULT_SETTINGS, type BlueprintInfo } from '@/types'

describe('resolveRankingRuns', () => {
  it('uses fixed batch size when no target time is set', () => {
    const avgVolume = 200
    const productQuantity = 1
    expect(resolveRankingRuns(500, productQuantity, avgVolume)).toBe(500)
    expect(resolveRankingRuns(1000, productQuantity, avgVolume)).toBe(1000)
  })

  it('returns null when hub volume cannot clear one run in 7 days', () => {
    expect(resolveRankingRuns(100, 1, 0.1)).toBeNull()
  })

  it('uses full batch when hub volume is missing', () => {
    expect(resolveRankingRuns(750, 10, 0)).toBe(750)
  })
})

describe('resolveRankingRunsFromTime', () => {
  const blueprint: BlueprintInfo = {
    blueprintTypeId: 1,
    productTypeId: 2,
    productQuantity: 1,
    manufacturingTime: 3600,
    materials: [{ typeId: 34, quantity: 1 }],
    tier: 't1',
    productGroup: 'Module',
    kind: 'manufacturing',
    spaceClass: 'highsec',
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    meDefault: 10,
    teDefault: 20,
    rankingTargetTimeSeconds: 24 * 3600,
  }

  it('derives runs from target job time for each blueprint', () => {
    const runs = resolveRankingRunsFromTime(
      24 * 3600,
      blueprint,
      'Module',
      settings,
      blueprint.productQuantity,
      0,
    )
    expect(runs).not.toBeNull()
    expect(runs!).toBeGreaterThan(0)
    expect(runs!).toBeLessThanOrEqual(10_000)
  })

  it('returns null when hub volume cannot clear one run in 7 days', () => {
    expect(
      resolveRankingRunsFromTime(
        24 * 3600,
        blueprint,
        'Module',
        settings,
        blueprint.productQuantity,
        0.1,
      ),
    ).toBeNull()
  })

  it('job time stays near the target for derived runs', () => {
    const runs =
      resolveRankingRunsFromTime(
        24 * 3600,
        blueprint,
        'Module',
        settings,
        blueprint.productQuantity,
        0,
      ) ?? 0
    const { te } = { te: settings.teDefault }
    const jobTime = applyTE(
      blueprint.manufacturingTime,
      te,
      runs,
      settings.skills.industry ?? 5,
      settings.skills.advancedIndustry ?? 5,
      0,
    )
    expect(jobTime).toBeGreaterThan(0)
    expect(Math.abs(jobTime - 24 * 3600)).toBeLessThan(24 * 3600)
  })
})
