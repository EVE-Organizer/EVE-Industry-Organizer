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
  const industry = 5
  const advancedIndustry = 5
  const structureTeBonusPercent = 10

  it('computes per-run time with TE, Industry, structure, and Advanced Industry', () => {
    const perRun = manufacturingTimePerRun(
      baseTime,
      te,
      industry,
      advancedIndustry,
      structureTeBonusPercent,
    )
    expect(perRun).toBe(
      applyTE(baseTime, te, 1, industry, advancedIndustry, structureTeBonusPercent),
    )
  })

  it('round-trips runs through job time', () => {
    const runs = 100
    const jobTime = applyTE(baseTime, te, runs, industry, advancedIndustry, structureTeBonusPercent)
    expect(
      runsForJobTime(jobTime, baseTime, te, industry, advancedIndustry, structureTeBonusPercent, {
        step: 1,
        maxRuns: null,
      }),
    ).toBe(runs)
  })

  it('picks closest runs when job time is between step boundaries', () => {
    const perRun = manufacturingTimePerRun(
      baseTime,
      te,
      industry,
      advancedIndustry,
      structureTeBonusPercent,
    )
    const targetRuns = 47
    const targetTime = perRun * targetRuns + perRun * 0.4
    expect(
      runsForJobTime(
        targetTime,
        baseTime,
        te,
        industry,
        advancedIndustry,
        structureTeBonusPercent,
        {
          step: 1,
          maxRuns: null,
        },
      ),
    ).toBe(targetRuns)
  })

  it('clampManufacturingRuns enforces step 10 and max batch cap', () => {
    expect(clampManufacturingRuns(47)).toBe(50)
    expect(clampManufacturingRuns(10_050)).toBe(10_000)
    expect(clampManufacturingRuns(7)).toBe(10)
    expect(clampManufacturingRuns(1)).toBe(1)
  })

  it('clampGraphRuns allows runs above blueprint list cap', () => {
    expect(clampGraphRuns(1000)).toBe(1000)
    expect(clampGraphRuns(MAX_BATCH_SIZE + 50)).toBe(MAX_BATCH_SIZE + 50)
  })

  it('sizes runs with item-type construction skills so job time matches applyTE', () => {
    const requiredSkills = { 'Advanced Small Ship Construction': 1 }
    const skills = {
      industry: 5,
      advancedIndustry: 5,
      advancedSmallShipConstruction: 5,
    }
    const target = 168 * 3600
    const withSkills = runsForJobTime(target, baseTime, 0, 5, 5, 0, {
      step: 1,
      maxRuns: null,
      requiredSkills,
      skills,
    })
    const withoutSkills = runsForJobTime(target, baseTime, 0, 5, 5, 0, {
      step: 1,
      maxRuns: null,
    })
    expect(withSkills).toBeGreaterThan(withoutSkills)
    const jobSeconds = applyTE(baseTime, 0, withSkills, 5, 5, 0, requiredSkills, skills)
    expect(Math.abs(jobSeconds - target) / target).toBeLessThan(0.01)
  })

  it('runsForJobTime with maxRuns null allows high run counts', () => {
    const runs = 750
    const jobTime = applyTE(baseTime, te, runs, industry, advancedIndustry, structureTeBonusPercent)
    expect(
      runsForJobTime(jobTime, baseTime, te, industry, advancedIndustry, structureTeBonusPercent, {
        step: 1,
        maxRuns: null,
      }),
    ).toBe(runs)
  })
})
