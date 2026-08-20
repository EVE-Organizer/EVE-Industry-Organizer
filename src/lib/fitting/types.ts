export interface FitSkillReq {
  skillId: number
  level: number
}

export interface FitResists {
  em: number
  thermal: number
  kinetic: number
  explosive: number
}

export interface FitCombatAttrs {
  shieldHp?: number
  armorHp?: number
  hullHp?: number
  shieldRes?: FitResists
  armorRes?: FitResists
  velocity?: number
  mass?: number
  agility?: number
  capCapacity?: number
  capRecharge?: number
  calibration?: number
  droneBandwidth?: number
  droneBay?: number
  scanRes?: number
  maxTargets?: number
  lockRange?: number
  warpSpeed?: number
  damageMultiplier?: number
  cycleTime?: number
  optimal?: number
  falloff?: number
  tracking?: number
  capacitorNeed?: number
  calibrationCost?: number
  speedFactor?: number
  shieldBonus?: number
  armorBonus?: number
  damageBonus?: number
  laserDamageBonus?: number
  rofBonus?: number
  miningAmount?: number
  repairAmount?: number
  chargeGroups?: number[]
  chargeGroup?: number
  chargeSize?: number
  chargeDamageMult?: number
  optimalMod?: number
  falloffMod?: number
  trackingMod?: number
  signature?: number
  droneVolume?: number
  damage?: Partial<FitResists> & { total?: number }
  optimalBonus?: number
  falloffBonus?: number
  trackingBonus?: number
  resistBonus?: Partial<FitResists>
  implantBonuses?: Record<string, number>
}

export interface ShipTrait {
  skillId: number
  bonus: number
  unit: number
  text: string
}

export interface FittingType {
  typeId: number
  name: string
  group: string
  category: string
  groupId?: number
  cpu?: number
  power?: number
  cpuOutput?: number
  powerOutput?: number
  skills?: FitSkillReq[]
  weapon?: 'turret' | 'launcher' | 'smartbomb'
  family?: string
  rigDrawback?: { family: string; stat: 'cpu' | 'power'; pct: number }
  electronicsUpgrades?: boolean
  combat?: FitCombatAttrs
  traits?: ShipTrait[]
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

export const SHIELD_MANAGEMENT = 3419
export const HULL_UPGRADES = 3386
export const MECHANICS = 3392
export const ENERGY_MANAGEMENT = 3417
export const ENERGY_SYSTEMS_OPERATION = 3424
export const NAVIGATION = 3449
export const EVASIVE_MANEUVERING = 3422
export const ACCELERATION_CONTROL = 3452
export const AFTERBURNER = 3440
export const HIGH_SPEED_MANEUVERING = 3450
export const MOTION_PREDICTION = 3312
export const SHARPSHOOTER = 3301
export const TRAJECTORY_ANALYSIS = 3300
export const RAPID_FIRING = 3302
export const DRONES = 3436
export const DRONE_INTERFACING = 3442

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
  calibrationUsed?: number
  calibrationOutput?: number
  calibrationOk?: boolean
}

export interface FitTankLayer {
  hp: number
  ehp: number
  resists: FitResists
}

export interface FitShipStats {
  load: FitLoad
  tank: {
    shield: FitTankLayer
    armor: FitTankLayer
    hull: { hp: number; ehp: number }
    totalEhp: number
  }
  weapons?: {
    rawDps: number
    appliedDps: number
    optimalKm: number
    falloffKm: number
    tracking: number
    ammoName?: string
  }
  drones?: { dps: number; bandwidth: number; bay: number }
  capacitor: {
    capacity: number
    peakRecharge: number
    usage: number
    stablePercent: number | null
    lastsSeconds: number | null
  }
  navigation: {
    maxVelocity: number
    alignSeconds: number
    signature: number
    lockRange?: number
    maxTargets?: number
    warpSpeed?: number
  }
  mining?: { m3PerSec: number }
  unmappedTraits: string[]
}

export type FleetLinkId = 'skirmish' | 'armored' | 'information' | 'siege' | 'miningForeman'

export interface FitStatsContext {
  skillLevels: Map<number, number>
  /** CPU/PG/rigging levels for load bars; separate from preview combat skills. */
  fittingLevels?: FittingLevels
  implantTypeIds: number[]
  fleetLinks: FleetLinkId[]
  rangeKm: number
  implantIndex: FittingIndex
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

export interface ChargeGroupKey {
  moduleTypeId: number
  label: string
  quantity: number
}

export interface ChargeSelection {
  groupKey: string
  chargeTypeId: number | null
}
