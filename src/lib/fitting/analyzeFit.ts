import type { SkillInfo } from '@/types'
import { parseEft } from '@/lib/fitting/parseEft'
import {
  computeFitLoad,
  emptyFittingLevels,
  expandPrerequisites,
  levelsFromSkillMap,
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
  minLevels: FittingLevels | null
  minLoad: FitLoad | null
  skills: FitSkillRow[]
  /** True when the current skill map (untrained = 0) can online CPU and PG. */
  fits: boolean
  /** True when some skill combo at V or below can online the hull. */
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
  const currentLevels = trained ? levelsFromSkillMap(trained) : emptyFittingLevels()
  const load = computeFitLoad(ship, items, currentLevels)
  const min = minFittingLevels(ship, items, required, skills, trained)
  const displayRequired =
    load.cpuOk && load.powerOk
      ? required
      : expandPrerequisites(
          min ? mergeFittingSkills(required, min.levels) : required,
          skills,
        )
  return {
    parsed,
    shipName: ship.name,
    fitName: parsed.fitName,
    unknown,
    load,
    minLevels: min?.levels ?? null,
    minLoad: min?.load ?? null,
    skills: skillRows(displayRequired, skills, trained),
    fits: load.cpuOk && load.powerOk,
    possible: min != null,
  }
}
