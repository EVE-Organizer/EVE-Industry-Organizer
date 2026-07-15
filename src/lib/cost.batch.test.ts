import { describe, expect, it } from 'vitest'
import {
  applyTE,
  clampGraphRuns,
  clampManufacturingRuns,
  manufacturingTimePerRun,
  runsForJobTime,
} from '@/lib/cost'
import { MAX_BATCH_SIZE } from '@/types'

describe('manufacturing run/time helpers', () => {
  const baseTime = 3600
  const te = 20
  const advancedIndustry = 5
  const structureTeBonusPercent = 10

  it('computes per-run time with TE, structure, and Advanced Industry', () => {
    const perRun = manufacturingTimePerRun(baseTime, te, advancedIndustry, structureTeBonusPercent)
    expect(perRun).toBe(applyTE(baseTime, te, 1, advancedIndustry, structureTeBonusPercent))
  })

  it('round-trips runs through job time', () => {
    const runs = 100
    const jobTime = applyTE(baseTime, te, runs, advancedIndustry, structureTeBonusPercent)
    expect(
      runsForJobTime(jobTime, baseTime, te, advancedIndustry, structureTeBonusPercent, {
        step: 1,
        maxRuns: null,
      }),
    ).toBe(runs)
  })

  it('picks closest runs when job time is between step boundaries', () => {
    const perRun = manufacturingTimePerRun(baseTime, te, advancedIndustry, structureTeBonusPercent)
    const targetRuns = 47
    const targetTime = perRun * targetRuns + perRun * 0.4
    expect(
      runsForJobTime(targetTime, baseTime, te, advancedIndustry, structureTeBonusPercent, {
        step: 1,
        maxRuns: null,
      }),
    ).toBe(targetRuns)
  })

  it('clampManufacturingRuns enforces step 10 and max 500', () => {
    expect(clampManufacturingRuns(47)).toBe(50)
    expect(clampManufacturingRuns(505)).toBe(500)
    expect(clampManufacturingRuns(7)).toBe(10)
  })

  it('clampGraphRuns allows runs above blueprint list cap', () => {
    expect(clampGraphRuns(1000)).toBe(1000)
    expect(clampGraphRuns(MAX_BATCH_SIZE + 50)).toBe(MAX_BATCH_SIZE + 50)
  })

  it('runsForJobTime with maxRuns null allows high run counts', () => {
    const runs = 750
    const jobTime = applyTE(baseTime, te, runs, advancedIndustry, structureTeBonusPercent)
    expect(
      runsForJobTime(jobTime, baseTime, te, advancedIndustry, structureTeBonusPercent, {
        step: 1,
        maxRuns: null,
      }),
    ).toBe(runs)
  })
})
