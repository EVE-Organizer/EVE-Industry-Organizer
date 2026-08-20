import type { SkillInfo } from '@/types'
import { applyChargeSelections, buildChargeGroups, type ChargeModuleGroup } from '@/lib/fitting/fitCharges'
import { computeFitStats } from '@/lib/fitting/fitStats'
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
import { maxoutSkillsForFit, type MaxoutSkillEntry } from '@/lib/fitting/maxoutSkills'
import {
  ADVANCED_WEAPON_UPGRADES,
  CPU_MANAGEMENT,
  ELECTRONICS_UPGRADES,
  POWER_GRID_MANAGEMENT,
  RIGGING_SKILL_BY_FAMILY,
  WEAPON_UPGRADES,
  type FitLoad,
  type FitShipStats,
  type FitSkillRow,
  type FitStatsContext,
  type FleetLinkId,
  type FittingIndex,
  type FittingLevels,
  type ParsedFit,
} from '@/lib/fitting/types'

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
  fits: boolean
  possible: boolean
  stats: FitShipStats
  maxStats: FitShipStats
  chargeGroups: ChargeModuleGroup[]
  maxoutSkillIds: number[]
  ship: import('@/lib/fitting/types').FittingType
  items: import('@/lib/fitting/types').ResolvedFitItem[]
}

function buildStatsContext(
  skillLevels: Map<number, number>,
  index: FittingIndex,
  opts: {
    implantTypeIds?: number[]
    fleetLinks?: FleetLinkId[]
    rangeKm?: number
    fittingLevels?: FittingLevels
  } = {},
): FitStatsContext {
  return {
    skillLevels,
    fittingLevels: opts.fittingLevels,
    implantTypeIds: opts.implantTypeIds ?? [],
    fleetLinks: opts.fleetLinks ?? [],
    rangeKm: opts.rangeKm ?? 12,
    implantIndex: index,
  }
}

function fittingLevelsForStats(
  trained: Map<number, number> | undefined,
  min: { levels: FittingLevels } | null,
): FittingLevels {
  if (trained) return levelsFromSkillMap(trained)
  return min?.levels ?? maxFittingLevels()
}

function clampPreviewLevel(level: number | undefined): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(5, Math.max(0, Math.floor(level ?? 0)))
}

/** Base fitting levels from character/min/max, with explicit preview overrides for fitting skills only. */
function fittingLevelsWithPreview(
  previewSkills: Map<number, number> | undefined,
  trained: Map<number, number> | undefined,
  min: { levels: FittingLevels } | null,
): FittingLevels {
  const base = fittingLevelsForStats(trained, min)
  const levels: FittingLevels = {
    ...base,
    rigging: { ...base.rigging },
  }
  if (!previewSkills?.size) return levels

  if (previewSkills.has(CPU_MANAGEMENT)) {
    levels.cpuManagement = clampPreviewLevel(previewSkills.get(CPU_MANAGEMENT))
  }
  if (previewSkills.has(POWER_GRID_MANAGEMENT)) {
    levels.powerGridManagement = clampPreviewLevel(previewSkills.get(POWER_GRID_MANAGEMENT))
  }
  if (previewSkills.has(WEAPON_UPGRADES)) {
    levels.weaponUpgrades = clampPreviewLevel(previewSkills.get(WEAPON_UPGRADES))
  }
  if (previewSkills.has(ADVANCED_WEAPON_UPGRADES)) {
    levels.advancedWeaponUpgrades = clampPreviewLevel(previewSkills.get(ADVANCED_WEAPON_UPGRADES))
  }
  if (previewSkills.has(ELECTRONICS_UPGRADES)) {
    levels.electronicsUpgrades = clampPreviewLevel(previewSkills.get(ELECTRONICS_UPGRADES))
  }
  for (const [family, skillId] of Object.entries(RIGGING_SKILL_BY_FAMILY)) {
    if (previewSkills.has(skillId)) {
      levels.rigging[family] = clampPreviewLevel(previewSkills.get(skillId))
    }
  }
  return levels
}

/** Merge trained, maxout defaults, then explicit preview overrides (in that order). */
export function buildPreviewSkillMap(
  previewSkills: Map<number, number> | undefined,
  trained: Map<number, number> | undefined,
  maxout: MaxoutSkillEntry[],
  flyRequired?: Map<number, number>,
): Map<number, number> {
  const map = new Map<number, number>()
  if (flyRequired) {
    for (const [id, level] of flyRequired) map.set(id, level)
  }
  if (trained) {
    for (const [id, level] of trained) map.set(id, level)
  }
  for (const entry of maxout) {
    if (!map.has(entry.skillId)) map.set(entry.skillId, entry.level)
  }
  if (previewSkills) {
    for (const [id, level] of previewSkills) map.set(id, level)
  }
  return map
}

function allVMap(maxoutIds: number[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const id of maxoutIds) map.set(id, 5)
  return map
}

export function analyzeFit(
  eft: string,
  index: FittingIndex,
  skills: SkillInfo[],
  trained?: Map<number, number>,
  opts?: {
    previewSkills?: Map<number, number>
    chargeSelections?: Map<string, number | null>
    fleetLinks?: FleetLinkId[]
    rangeKm?: number
    implantTypeIds?: number[]
  },
): FitAnalysis {
  const parsed = parseEft(eft)
  const { ship, items, unknown } = resolveFit(parsed, index)
  const chargeGroups = buildChargeGroups(items, parsed, index)
  const selections = opts?.chargeSelections ?? new Map(chargeGroups.map((g) => [g.key, g.defaultChargeId]))
  const resolvedItems = applyChargeSelections(items, selections, index)

  const required = requiredSkills(ship, resolvedItems, skills)
  const maxLoad = computeFitLoad(ship, resolvedItems, maxFittingLevels())
  const sheetLoad = trained ? computeFitLoad(ship, resolvedItems, levelsFromSkillMap(trained)) : null
  const load = sheetLoad ?? maxLoad
  const min = minFittingLevels(ship, resolvedItems, required, skills, trained)
  const needFittingExtras = !trained || !load.cpuOk || !load.powerOk
  const displayRequired = expandPrerequisites(
    needFittingExtras && min ? mergeFittingSkills(required, min.levels) : required,
    skills,
  )

  const maxout = maxoutSkillsForFit(ship, resolvedItems, opts?.fleetLinks)
  const maxoutIds = maxout.map((e) => e.skillId)

  const usingPreview = Boolean(opts?.previewSkills)
  const previewMap = usingPreview
    ? buildPreviewSkillMap(opts!.previewSkills, trained, maxout, required)
    : trained
      ? new Map(trained)
      : allVMap(maxoutIds)
  if (!usingPreview) {
    for (const entry of maxout) {
      if (!previewMap.has(entry.skillId)) previewMap.set(entry.skillId, entry.level)
    }
  }

  const fittingLevels = usingPreview
    ? fittingLevelsWithPreview(opts!.previewSkills, trained, min)
    : fittingLevelsForStats(trained, min)
  const statsOpts = { ...(opts ?? {}), fittingLevels }
  const maxStatsOpts = { ...(opts ?? {}), fittingLevels: maxFittingLevels() }

  const ctx = buildStatsContext(previewMap, index, statsOpts)
  const maxCtx = buildStatsContext(allVMap(maxoutIds), index, maxStatsOpts)

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
    stats: computeFitStats(ship, resolvedItems, ctx),
    maxStats: computeFitStats(ship, resolvedItems, maxCtx),
    chargeGroups,
    maxoutSkillIds: maxoutIds,
    ship,
    items: resolvedItems,
  }
}
