import type { FleetLinkId, FittingType, ResolvedFitItem } from '@/lib/fitting/types'
import {
  ACCELERATION_CONTROL,
  AFTERBURNER,
  DRONE_INTERFACING,
  DRONES,
  ENERGY_MANAGEMENT,
  ENERGY_SYSTEMS_OPERATION,
  EVASIVE_MANEUVERING,
  HIGH_SPEED_MANEUVERING,
  HULL_UPGRADES,
  MECHANICS,
  MOTION_PREDICTION,
  NAVIGATION,
  RAPID_FIRING,
  SHARPSHOOTER,
  SHIELD_MANAGEMENT,
  TRAJECTORY_ANALYSIS,
} from '@/lib/fitting/types'

export interface MaxoutSkillEntry {
  skillId: number
  level: number
  tooltip?: string
}

const CORE_SKILLS: MaxoutSkillEntry[] = [
  { skillId: SHIELD_MANAGEMENT, level: 5, tooltip: '+5% shield HP per level' },
  { skillId: HULL_UPGRADES, level: 5, tooltip: '+5% armor HP per level' },
  { skillId: MECHANICS, level: 5, tooltip: '+5% hull HP per level' },
  { skillId: ENERGY_MANAGEMENT, level: 5, tooltip: '+5% capacitor per level' },
  { skillId: ENERGY_SYSTEMS_OPERATION, level: 5, tooltip: '+5% cap recharge per level' },
  { skillId: NAVIGATION, level: 5, tooltip: '+5% max velocity per level' },
]

function mergeSkill(into: Map<number, MaxoutSkillEntry>, entry: MaxoutSkillEntry): void {
  const current = into.get(entry.skillId)
  if (!current || entry.level > current.level) into.set(entry.skillId, entry)
}

function onlineModules(items: ResolvedFitItem[]): ResolvedFitItem[] {
  return items.filter((item) => !item.offline && item.type.category === 'Module')
}

export function maxoutSkillsForFit(
  ship: FittingType,
  items: ResolvedFitItem[],
  fleetLinks: FleetLinkId[] = [],
): MaxoutSkillEntry[] {
  const map = new Map<number, MaxoutSkillEntry>()
  for (const entry of CORE_SKILLS) mergeSkill(map, entry)

  for (const item of onlineModules(items)) {
    const g = item.type.group
    if (item.type.weapon === 'turret' || item.type.weapon === 'launcher') {
      for (const req of item.type.skills ?? []) {
        mergeSkill(map, { skillId: req.skillId, level: 5 })
      }
      mergeSkill(map, { skillId: RAPID_FIRING, level: 5, tooltip: '+4% RoF per level' })
      mergeSkill(map, { skillId: MOTION_PREDICTION, level: 5, tooltip: '+5% tracking per level' })
      mergeSkill(map, { skillId: SHARPSHOOTER, level: 5, tooltip: '+5% tracking per level' })
      mergeSkill(map, { skillId: TRAJECTORY_ANALYSIS, level: 5, tooltip: '+5% optimal range per level' })
    }
    if (g.includes('Afterburner')) {
      mergeSkill(map, { skillId: AFTERBURNER, level: 5 })
      mergeSkill(map, { skillId: ACCELERATION_CONTROL, level: 5, tooltip: '+5% AB speed per level' })
    }
    if (g.includes('Microwarpdrive')) {
      mergeSkill(map, { skillId: HIGH_SPEED_MANEUVERING, level: 5 })
      mergeSkill(map, { skillId: ACCELERATION_CONTROL, level: 5, tooltip: '+10% MWD speed per level' })
    }
    if (g.includes('Armor Repair') || g.includes('Coating') || g.includes('Energized Membrane')) {
      mergeSkill(map, { skillId: 3394, level: 5, tooltip: 'Repair Systems' })
    }
    if (g.includes('Shield Extender') || g.includes('Shield Booster') || g.includes('Shield Hardener')) {
      mergeSkill(map, { skillId: 3416, level: 5, tooltip: 'Shield Operation' })
    }
    if (g.includes('Mining Laser') || g.includes('Strip Miner')) {
      mergeSkill(map, { skillId: 3387, level: 5, tooltip: 'Mining' })
      mergeSkill(map, { skillId: 3388, level: 5, tooltip: 'Astrogeology' })
    }
  }

  for (const item of items) {
    if (item.type.category === 'Drone') {
      mergeSkill(map, { skillId: DRONES, level: 5 })
      mergeSkill(map, { skillId: DRONE_INTERFACING, level: 5, tooltip: '+5% drone damage per level' })
    }
    for (const req of item.charge?.skills ?? []) {
      mergeSkill(map, { skillId: req.skillId, level: req.level })
    }
  }

  for (const req of ship.skills ?? []) {
    mergeSkill(map, { skillId: req.skillId, level: Math.max(req.level, 5) })
  }

  mergeSkill(map, { skillId: EVASIVE_MANEUVERING, level: 5, tooltip: '-5% align time per level' })

  if (fleetLinks.length) {
    mergeSkill(map, { skillId: 3348, level: 5, tooltip: 'Leadership' })
    mergeSkill(map, { skillId: 3349, level: 5, tooltip: 'Skirmish Warfare' })
  }

  return [...map.values()].sort((a, b) => a.skillId - b.skillId)
}

export function maxoutSkillIds(entries: MaxoutSkillEntry[]): number[] {
  return entries.map((e) => e.skillId)
}
