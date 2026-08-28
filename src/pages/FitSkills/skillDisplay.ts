import {
  ADVANCED_WEAPON_UPGRADES,
  ARMOR_RIGGING,
  CPU_MANAGEMENT,
  ELECTRONICS_UPGRADES,
  ENERGY_WEAPON_RIGGING,
  HYBRID_WEAPON_RIGGING,
  LAUNCHER_RIGGING,
  POWER_GRID_MANAGEMENT,
  PROJECTILE_WEAPON_RIGGING,
  WEAPON_UPGRADES,
  type FitSkillRow,
  type FittingLevels,
} from '@/pages/FitSkills/types'

const JURY_RIGGING = 26252

const FITTING_SKILL_IDS = new Set([
  CPU_MANAGEMENT,
  POWER_GRID_MANAGEMENT,
  WEAPON_UPGRADES,
  ADVANCED_WEAPON_UPGRADES,
  ELECTRONICS_UPGRADES,
  JURY_RIGGING,
  ENERGY_WEAPON_RIGGING,
  HYBRID_WEAPON_RIGGING,
  PROJECTILE_WEAPON_RIGGING,
  LAUNCHER_RIGGING,
  ARMOR_RIGGING,
])

const GROUP_ORDER = [
  'Fitting',
  'Ship',
  'DPS',
  'Drones',
  'Shield',
  'Armor',
  'Navigation',
  'Capacitor',
  'Mining',
  'Support',
] as const

export type FitSkillGroupName = (typeof GROUP_ORDER)[number]

export const FIT_SKILL_GROUP_HINTS: Record<FitSkillGroupName, string> = {
  Fitting: 'CPU, power grid, upgrades, and rigging to online the fit.',
  Ship: 'Hull class and spaceship command skills for the hull and hull bonuses.',
  DPS: 'Turret, launcher, and gunnery support skills for weapon damage and range.',
  Drones: 'Drone command, damage, and bandwidth skills.',
  Shield: 'Shield hit points, resistances, and shield tank modules.',
  Armor: 'Armor hit points, resistances, and armor tank modules.',
  Navigation: 'Speed, align time, afterburner, and microwarpdrive skills.',
  Capacitor: 'Cap capacity, recharge, and cap-using module skills.',
  Mining: 'Mining lasers, strip miners, and ore yield skills.',
  Support: 'Other support skills such as leadership, targeting, and electronics.',
}

export interface FitSkillGroup {
  title: FitSkillGroupName
  rows: FitSkillRow[]
}

export function romanLevel(level: number): string {
  return ['0', 'I', 'II', 'III', 'IV', 'V'][level] ?? String(level)
}

export function skillGroupName(row: FitSkillRow): FitSkillGroupName {
  if (FITTING_SKILL_IDS.has(row.skillId)) return 'Fitting'
  if (/frigate|spaceship command|destroyer|cruiser|battleship|industrial|assault|marauder/i.test(row.name)) {
    return 'Ship'
  }
  if (
    /gunnery|turret|laser|missile|launcher|sharpshooter|motion prediction|rapid firing|surgical|trajectory|controlled bursts|specialization|precursor|hybrid|projectile|energy turret/i.test(
      row.name,
    )
  ) {
    return 'DPS'
  }
  if (/drone|interfacing|drone navigation|drone durability|drone sharpshooting/i.test(row.name)) {
    return 'Drones'
  }
  if (/shield|resistance compensation/i.test(row.name)) return 'Shield'
  if (/hull|armor|repair|layering|mechanics/i.test(row.name)) return 'Armor'
  if (/afterburner|navigation|acceleration|evasive|fuel conservation|microwarp|high speed/i.test(row.name)) {
    return 'Navigation'
  }
  if (/capacitor|energy management|energy systems|energy emission|energy grid/i.test(row.name)) {
    return 'Capacitor'
  }
  if (/mining|astrogeology|ice harvesting|gas cloud|strip/i.test(row.name)) return 'Mining'
  return 'Support'
}

export function groupFitSkills(rows: FitSkillRow[]): FitSkillGroup[] {
  const buckets = new Map<FitSkillGroupName, FitSkillRow[]>()
  for (const row of rows) {
    const title = skillGroupName(row)
    const list = buckets.get(title) ?? []
    list.push(row)
    buckets.set(title, list)
  }
  return GROUP_ORDER.flatMap((title) => {
    const grouped = buckets.get(title)
    return grouped?.length ? [{ title, rows: grouped }] : []
  })
}

/** Union of skills required to fly and skills worth maxing for stats preview. */
export function mergeAllFitSkills(
  flyRows: FitSkillRow[],
  maxoutEntries: { skillId: number; level: number }[],
  skills: { skillId: number; name: string; rank: number }[],
  trained?: Map<number, number>,
): FitSkillRow[] {
  const byId = new Map<number, FitSkillRow>()
  for (const row of flyRows) {
    byId.set(row.skillId, {
      ...row,
      trained: trained?.get(row.skillId) ?? row.trained ?? 0,
    })
  }
  const skillById = new Map(skills.map((s) => [s.skillId, s]))
  for (const entry of maxoutEntries) {
    const existing = byId.get(entry.skillId)
    const trainedLevel = trained?.get(entry.skillId) ?? existing?.trained ?? 0
    if (existing) {
      byId.set(entry.skillId, {
        ...existing,
        required: Math.max(existing.required, entry.level),
        trained: trainedLevel,
      })
    } else {
      byId.set(entry.skillId, {
        skillId: entry.skillId,
        name: skillById.get(entry.skillId)?.name ?? `Skill ${entry.skillId}`,
        required: entry.level,
        rank: skillById.get(entry.skillId)?.rank ?? 1,
        trained: trainedLevel,
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function formatFittingCombo(levels: FittingLevels): string {
  const parts = [
    `CPU Management ${romanLevel(levels.cpuManagement)}`,
    `Power Grid Management ${romanLevel(levels.powerGridManagement)}`,
    `Weapon Upgrades ${romanLevel(levels.weaponUpgrades)}`,
    `Advanced Weapon Upgrades ${romanLevel(levels.advancedWeaponUpgrades)}`,
  ]
  for (const [family, level] of Object.entries(levels.rigging)) {
    if (!level) continue
    const label =
      family === 'energy'
        ? 'Energy Weapon Rigging'
        : family === 'hybrid'
          ? 'Hybrid Weapon Rigging'
          : family === 'projectile'
            ? 'Projectile Weapon Rigging'
            : family === 'launcher'
              ? 'Launcher Rigging'
              : family === 'armorRepair'
                ? 'Armor Rigging'
                : family
    parts.push(`${label} ${romanLevel(level)}`)
  }
  return parts.join(', ')
}
