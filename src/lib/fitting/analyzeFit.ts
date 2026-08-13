import type { SkillInfo } from '@/types'
import { parseEft } from '@/lib/fitting/parseEft'
import {
  computeFitLoad,
  emptyFittingLevels,
  expandPrerequisites,
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
  fits: boolean
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
  const min = minFittingLevels(ship, items, required, skills)
  const combined = expandPrerequisites(
    min ? mergeFittingSkills(required, min.levels) : required,
    skills,
  )
  const load = computeFitLoad(ship, items, min?.levels ?? emptyFittingLevels())
  return {
    parsed,
    shipName: ship.name,
    fitName: parsed.fitName,
    unknown,
    load,
    minLevels: min?.levels ?? null,
    minLoad: min?.load ?? null,
    skills: skillRows(combined, skills, trained),
    fits: min != null,
  }
}
