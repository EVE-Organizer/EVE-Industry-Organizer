export interface FitSkillReq {
  skillId: number
  level: number
}

export interface FittingType {
  typeId: number
  name: string
  group: string
  category: string
  cpu?: number
  power?: number
  cpuOutput?: number
  powerOutput?: number
  skills?: FitSkillReq[]
  weapon?: 'turret' | 'launcher' | 'smartbomb'
  family?: string
  rigDrawback?: { family: string; stat: 'cpu' | 'power'; pct: number }
  electronicsUpgrades?: boolean
}

export interface FittingData {
  generatedAt: string
  types: FittingType[]
}

export interface ParsedFitItem {
  name: string
  quantity: number
  chargeName?: string
  offline?: boolean
}

export interface ParsedFit {
  shipName: string
  fitName: string
  items: ParsedFitItem[]
}

export interface ResolvedFitItem {
  type: FittingType
  quantity: number
  charge?: FittingType
  offline: boolean
}

export interface SkillInfoLite {
  skillId: number
  name: string
  rank: number
  prerequisites: FitSkillReq[]
}

export const CPU_MANAGEMENT = 3426
export const POWER_GRID_MANAGEMENT = 3413
export const WEAPON_UPGRADES = 3318
export const ADVANCED_WEAPON_UPGRADES = 11207
export const ELECTRONICS_UPGRADES = 3432
export const ENERGY_WEAPON_RIGGING = 26258
export const HYBRID_WEAPON_RIGGING = 26259
export const PROJECTILE_WEAPON_RIGGING = 26260
export const LAUNCHER_RIGGING = 26261
export const ARMOR_RIGGING = 26253

export const RIGGING_SKILL_BY_FAMILY: Record<string, number> = {
  energy: ENERGY_WEAPON_RIGGING,
  hybrid: HYBRID_WEAPON_RIGGING,
  projectile: PROJECTILE_WEAPON_RIGGING,
  launcher: LAUNCHER_RIGGING,
  armorRepair: ARMOR_RIGGING,
}

export interface FittingLevels {
  cpuManagement: number
  powerGridManagement: number
  weaponUpgrades: number
  advancedWeaponUpgrades: number
  electronicsUpgrades: number
  rigging: Record<string, number>
}

export interface FitLoad {
  cpuUsed: number
  cpuOutput: number
  powerUsed: number
  powerOutput: number
  cpuOk: boolean
  powerOk: boolean
}

export interface FitSkillRow {
  skillId: number
  name: string
  required: number
  trained?: number
  rank: number
}

export type FittingIndex = {
  byId: Map<number, FittingType>
  byName: Map<string, FittingType>
}
