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
} from '@/lib/fitting/types'

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

const GROUP_ORDER = ['Fitting', 'Ship', 'Gunnery', 'Armor', 'Navigation', 'Support'] as const

export type FitSkillGroupName = (typeof GROUP_ORDER)[number]

export interface FitSkillGroup {
  title: FitSkillGroupName
  rows: FitSkillRow[]
}

export function romanLevel(level: number): string {
  return ['0', 'I', 'II', 'III', 'IV', 'V'][level] ?? String(level)
}

export function skillGroupName(row: FitSkillRow): FitSkillGroupName {
  if (FITTING_SKILL_IDS.has(row.skillId)) return 'Fitting'
  if (/frigate|spaceship command|destroyer|cruiser|battleship|industrial/i.test(row.name)) {
    return 'Ship'
  }
  if (
    /gunnery|turret|laser|missile|launcher|sharpshooter|motion prediction|rapid firing|surgical|trajectory|controlled bursts|specialization/i.test(
      row.name,
    )
  ) {
    return 'Gunnery'
  }
  if (/hull|armor|repair/i.test(row.name)) return 'Armor'
  if (/afterburner|navigation|acceleration|evasive|fuel conservation|microwarp/i.test(row.name)) {
    return 'Navigation'
  }
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
