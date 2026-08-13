import type { SkillInfo } from '@/types'
import { parseEft } from '@/lib/fitting/parseEft'
import {
  computeFitLoad,
  expandPrerequisites,
  levelsFromSkillMap,
  maxFittingLevels,
  mergeFittingSkills,
  minFittingLevels,
  requiredSkills,
  resolveFit,
  skillRows,
} from '@/lib/fitting/fitSkills'
import type { FitLoad, FitSkillRow, FittingIndex, FittingLevels, ParsedFit } from '@/lib/fitting/types'

export interface FitAnalysis {
  parsed: ParsedFit
  shipName: string
  fitName: string
  unknown: string[]
  load: FitLoad
  maxLoad: FitLoad
  minLevels: FittingLevels | null
  minLoad: FitLoad | null
  skills: FitSkillRow[]
  /** True when the displayed load (sheet, or all-V if none) can online CPU and PG. */
  fits: boolean
  /** True when all fitting skills at V can online the hull. */
  possible: boolean
}

export function analyzeFit(
  eft: string,
  index: FittingIndex,
  skills: SkillInfo[],
  trained?: Map<number, number>,
): FitAnalysis {
  const parsed = parseEft(eft)
  const { ship, items, unknown } = resolveFit(parsed, index)
  const required = requiredSkills(ship, items, skills)
  const maxLoad = computeFitLoad(ship, items, maxFittingLevels())
  const sheetLoad = trained
    ? computeFitLoad(ship, items, levelsFromSkillMap(trained))
    : null
  const load = sheetLoad ?? maxLoad
  const min = minFittingLevels(ship, items, required, skills, trained)
  const needFittingExtras = !trained || !load.cpuOk || !load.powerOk
  const displayRequired = expandPrerequisites(
    needFittingExtras && min ? mergeFittingSkills(required, min.levels) : required,
    skills,
  )
  return {
    parsed,
    shipName: ship.name,
    fitName: parsed.fitName,
    unknown,
    load,
    maxLoad,
    minLevels: min?.levels ?? null,
    minLoad: min?.load ?? null,
    skills: skillRows(displayRequired, skills, trained),
    fits: load.cpuOk && load.powerOk,
    possible: maxLoad.cpuOk && maxLoad.powerOk,
  }
}
