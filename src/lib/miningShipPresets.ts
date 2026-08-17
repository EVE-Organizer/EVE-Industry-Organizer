import type {
  MiningBoosterHullId,
  MiningBurstTech,
  MiningCrystalId,
  MiningFleetLine,
  MiningForemanBurstId,
  MiningMinerModuleId,
  MiningSubtype,
  MiningBuffId,
  MiningShipId,
  MiningBoostSpace,
  MiningSurveyChipsetId,
  MiningUpgradeId,
  SkillLevels,
} from '@/types'
import { DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE } from '@/lib/miningIph'
import { MINING_SPACES } from '@/lib/miningIph'

export type {
  MiningShipId,
  MiningBuffId,
  MiningBoostSpace,
  MiningBoosterHullId,
  MiningForemanBurstId,
  MiningMinerModuleId,
  MiningBurstTech,
  MiningUpgradeId,
  MiningSurveyChipsetId,
  MiningCrystalId,
} from '@/types'

export type MiningShipTier = 'barge' | 'exhumer' | 'frigate' | 'expedition'
export type MiningShipTech = 't1' | 't2'

export interface MiningShipPreset {
  id: MiningShipId
  label: string
  typeId: number
  tier: MiningShipTier
  tech: MiningShipTech
  subtypes: MiningSubtype[]
  m3PerHrBySubtype: Partial<Record<MiningSubtype, number>>
  roleOreYieldPct?: number
  miningBargeOreYieldPct?: number
  exhumersOreYieldPct?: number
  roleOreDurationReductionPct?: number
  exhumersOreDurationReductionPct?: number
  roleIceDurationReductionPct?: number
  miningBargeIceDurationReductionPct?: number
  exhumersIceDurationReductionPct?: number
}

export type MiningBuffCategory = 'fit' | 'fleet'

export interface MiningBuffPreset {
  id: MiningBuffId
  label: string
  shortLabel: string
  multiplier: number
  category: MiningBuffCategory
  hint: string
  typeId?: number
  /** Which boost-space contexts show this buff (fleet buffs only). */
  boostSpaces?: readonly MiningBoostSpace[]
  applies: (
    ship: MiningShipPreset,
    subtype: MiningSubtype,
    boostSpace: MiningBoostSpace,
    activeBuffIds: readonly MiningBuffId[],
    boosterHull?: MiningBoosterHullId | null,
  ) => boolean
}

export interface MiningBoosterHullPreset {
  id: MiningBoosterHullId
  label: string
  typeId: number
  boostSpaces: readonly MiningBoostSpace[]
  /** Typical yield multiplier with Mining Laser Optimization (no mindlink). */
  mluMultiplier: number
  hint: string
}

export type MiningForemanYieldKind = 'cycle' | 'crit' | 'none'

export interface MiningForemanBurstPreset {
  id: MiningForemanBurstId
  label: string
  shortLabel: string
  hint: string
  yieldKind: MiningForemanYieldKind
  typeId: number
}

export interface MiningShipGroup {
  id: string
  label: string
  tier: MiningShipTier
  tech: MiningShipTech
}

export const MINING_BOOST_SPACES: { id: MiningBoostSpace; label: string; hint: string }[] = [
  {
    id: 'solo',
    label: 'Solo',
    hint: 'No booster ship on grid. Personal modules and implants only.',
  },
  ...MINING_SPACES.map((s) => ({
    id: s.id as MiningBoostSpace,
    label: s.label,
    hint:
      s.id === 'highsec'
        ? 'Orca or Porpoise bursts (Rorqual cannot enter highsec).'
        : s.id === 'wormhole'
          ? 'Porpoise is common in WH (fits smaller connections); Rorqual for larger ops.'
          : 'Rorqual or Porpoise foreman bursts.',
  })),
]

/** Strip Miner I / Ice Harvester I / Miner II at skill IV. See miningIph Retriever constants. */
const BAKED = 4
const ORE_SKILL = (1 + 0.05 * BAKED) ** 2
/** Strip Miner I (17482): attr 77 miningAmount 150, attr 73 duration 45s. */
const STRIP_I_M3_HR = (150 / 45) * 2 * 3600
/** Ice Harvester I (16278): 1000 m³ / 240s. */
const ICE_I_M3_HR = (1000 / 240) * 2 * 3600
const ICE_SKILL_DUR = 1 - 0.05 * BAKED
/** Miner II (482): 15 m³ / 15s. */
const MINER_II_M3_HR = (15 / 15) * 2 * 3600
const SCOOP_II_M3_HR = (20 / 40) * 2 * 3600
const FRIG_GAS_DUR = 1 - 0.05 * BAKED

function bakedOreM3(yieldMult: number, durationMult = 1) {
  return Math.round((STRIP_I_M3_HR * yieldMult * ORE_SKILL) / durationMult)
}

function bakedIceM3(durationMult = 1) {
  return Math.round(ICE_I_M3_HR / (ICE_SKILL_DUR * durationMult))
}

function bakedMinerOreM3(guns: number, yieldMult: number) {
  return Math.round(MINER_II_M3_HR * (guns / 2) * yieldMult * ORE_SKILL)
}

function bakedGasM3(guns: number, yieldMult = 1, durationMult = 1) {
  return Math.round((SCOOP_II_M3_HR * (guns / 2) * yieldMult) / durationMult)
}

export const MINING_SHIPS: MiningShipPreset[] = [
  {
    id: 'retriever',
    label: 'Retriever',
    typeId: 17478,
    tier: 'barge',
    tech: 't1',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: bakedOreM3(1.22), moon: bakedOreM3(1.22), ice: bakedIceM3(0.875 * 0.92) },
    roleOreYieldPct: 10,
    miningBargeOreYieldPct: 3,
    roleIceDurationReductionPct: 12.5,
    miningBargeIceDurationReductionPct: 2,
  },
  {
    id: 'covetor',
    label: 'Covetor',
    typeId: 17476,
    tier: 'barge',
    tech: 't1',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: bakedOreM3(1.12, 0.75), moon: bakedOreM3(1.12, 0.75), ice: bakedIceM3(0.7 * 0.88) },
    miningBargeOreYieldPct: 3,
    roleOreDurationReductionPct: 25,
    roleIceDurationReductionPct: 30,
    miningBargeIceDurationReductionPct: 3,
  },
  {
    id: 'procurer',
    label: 'Procurer',
    typeId: 17480,
    tier: 'barge',
    tech: 't1',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: bakedOreM3(1.08), moon: bakedOreM3(1.08), ice: bakedIceM3(0.92) },
    miningBargeOreYieldPct: 2,
    miningBargeIceDurationReductionPct: 2,
  },
  {
    id: 'hulk',
    label: 'Hulk',
    typeId: 22544,
    tier: 'exhumer',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: bakedOreM3(1.36, 0.85 * 0.88), moon: bakedOreM3(1.36, 0.85 * 0.88), ice: bakedIceM3(0.7 * 0.88 * 0.84) },
    miningBargeOreYieldPct: 3,
    exhumersOreYieldPct: 6,
    roleOreDurationReductionPct: 15,
    exhumersOreDurationReductionPct: 3,
    roleIceDurationReductionPct: 30,
    miningBargeIceDurationReductionPct: 3,
    exhumersIceDurationReductionPct: 4,
  },
  {
    id: 'mackinaw',
    label: 'Mackinaw',
    typeId: 22548,
    tier: 'exhumer',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: bakedOreM3(1.28, 0.9), moon: bakedOreM3(1.28, 0.9), ice: bakedIceM3(0.875 * 0.84 * 0.84) },
    miningBargeOreYieldPct: 3,
    exhumersOreYieldPct: 4,
    roleOreDurationReductionPct: 10,
    roleIceDurationReductionPct: 12.5,
    miningBargeIceDurationReductionPct: 4,
    exhumersIceDurationReductionPct: 4,
  },
  {
    id: 'skiff',
    label: 'Skiff',
    typeId: 22546,
    tier: 'exhumer',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: bakedOreM3(1.16), moon: bakedOreM3(1.16), ice: bakedIceM3(0.84) },
    miningBargeOreYieldPct: 2,
    exhumersOreYieldPct: 2,
    miningBargeIceDurationReductionPct: 4,
  },
  {
    id: 'venture',
    label: 'Venture',
    typeId: 32880,
    tier: 'frigate',
    tech: 't1',
    subtypes: ['ore', 'moon', 'gas'],
    m3PerHrBySubtype: { ore: bakedMinerOreM3(2, 2 * 1.2), moon: bakedMinerOreM3(2, 2 * 1.2), gas: bakedGasM3(2, 2, FRIG_GAS_DUR) },
  },
  {
    id: 'prospect',
    label: 'Prospect',
    typeId: 33697,
    tier: 'expedition',
    tech: 't2',
    subtypes: ['ore', 'moon', 'gas'],
    m3PerHrBySubtype: { ore: bakedMinerOreM3(2, 2 * 1.2 * 1.2), moon: bakedMinerOreM3(2, 2 * 1.2 * 1.2), gas: bakedGasM3(2, 2, FRIG_GAS_DUR) },
  },
  {
    id: 'endurance',
    label: 'Endurance',
    typeId: 37135,
    tier: 'expedition',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice', 'gas'],
    m3PerHrBySubtype: { ore: bakedMinerOreM3(1, 4 * 1.2), moon: bakedMinerOreM3(1, 4 * 1.2), ice: 22_000, gas: bakedGasM3(1) },
  },
]

/** Industrial command ships that run Mining Foreman bursts. */
export const MINING_BOOSTER_HULLS: MiningBoosterHullPreset[] = [
  {
    id: 'porpoise',
    label: 'Porpoise',
    typeId: 42244,
    boostSpaces: ['highsec', 'lowsec', 'nullsec', 'wormhole'],
    mluMultiplier: 1.3,
    hint: 'Small command ship. Works in all spaces including wormholes.',
  },
  {
    id: 'orca',
    label: 'Orca',
    typeId: 28606,
    boostSpaces: ['highsec'],
    mluMultiplier: 1.38,
    hint: 'Highsec industrial command ship (~38% more yield with MLU burst).',
  },
  {
    id: 'rorqual',
    label: 'Rorqual',
    typeId: 28352,
    boostSpaces: ['lowsec', 'nullsec', 'wormhole'],
    mluMultiplier: 1.58,
    hint: 'Capital booster for lowsec, nullsec, and wormhole ops (~58% with MLU burst).',
  },
]

/** Mining Foreman burst charges loaded into Command Burst modules. */
export const MINING_FOREMAN_BURSTS: MiningForemanBurstPreset[] = [
  {
    id: 'miningLaserOptimization',
    label: 'Mining Laser Optimization Charge',
    shortLabel: 'Optimization',
    hint: 'Cuts mining module cycle time (~15% base). Biggest m³/hr boost.',
    yieldKind: 'cycle',
    typeId: 42830,
  },
  {
    id: 'miningLaserEfficiency',
    label: 'Mining Laser Efficiency Charge',
    shortLabel: 'Efficiency',
    hint: 'Raises mining crit chance (+50% base) and cuts residue. Crits add extra m³ without draining the rock.',
    yieldKind: 'crit',
    typeId: 90733,
  },
  {
    id: 'miningLaserFieldEnhancement',
    label: 'Mining Laser Field Enhancement Charge',
    shortLabel: 'Field Enhancement',
    hint: 'Increases mining laser range. Does not change m³/hr at the rock.',
    yieldKind: 'none',
    typeId: 42829,
  },
  {
    id: 'miningEquipmentPreservation',
    label: 'Mining Equipment Preservation Charge',
    shortLabel: 'Preservation',
    hint: 'Reduces crystal wear. Does not change m³/hr.',
    yieldKind: 'none',
    typeId: 42831,
  },
]

export const DEFAULT_MINING_FOREMAN_BURST: MiningForemanBurstId = 'miningLaserOptimization'
export const DEFAULT_MINING_BURST_TECH: MiningBurstTech = 't2'
export const DEFAULT_MINING_UPGRADE: MiningUpgradeId = 'none'
export const DEFAULT_MINING_SURVEY_CHIPSET: MiningSurveyChipsetId = 'msc2'
export const DEFAULT_MINING_CRYSTAL: MiningCrystalId = 'none'
export const DEFAULT_MINING_MINER: MiningMinerModuleId = 'strip'
export const MAX_MINING_UPGRADE_COUNT = 3

/** SDE type IDs for fleet fit icons. */
export const MINING_FIT_TYPE_IDS = {
  stripMinerI: 17482,
  modulatedStripMinerII: 17912,
  modulatedDeepCoreStripMinerII: 24305,
  iceHarvesterI: 16278,
  iceHarvesterII: 22229,
  /** Simple asteroid crystals (matching ore tier assumed in rankings). */
  oreCrystalA1: 60276,
  oreCrystalA2: 60281,
  oreCrystalB1: 60279,
  oreCrystalB2: 60283,
  oreCrystalC1: 60280,
  oreCrystalC2: 60284,
  mercoxitCrystalA1: 18054,
  mercoxitCrystalA2: 18608,
  /** Ubiquitous moon tier (matching moon ore tier assumed in rankings). */
  moonCrystalA1: 46355,
  moonCrystalA2: 46356,
  moonCrystalB1: 61197,
  moonCrystalB2: 61199,
  moonCrystalC1: 61198,
  moonCrystalC2: 61200,
  mlu1: 22542,
  mlu2: 28576,
  msc1: 444,
  msc2: 2333,
  ihu1: 22576,
  ihu2: 28578,
  burstI: 42528,
  burstII: 43551,
  largeIndustrialCore: 58945,
  capitalIndustrialCore: 28583,
  mindlink: 22559,
} as const

/** ESI attr 782 specializationAsteroidYieldMultiplier (same across ore/moon tiers for A/B/C). */
const CRYSTAL_YIELD_MULT: Record<Exclude<MiningCrystalId, 'none'>, number> = {
  a1: 1.5,
  a2: 1.8,
  b1: 1.5,
  b2: 1.8,
  c1: 0.25,
  c2: 0.2,
}

const CRYSTAL_DURATION_MULT: Record<Exclude<MiningCrystalId, 'none'>, number> = {
  a1: 1,
  a2: 1,
  b1: 0.9,
  b2: 0.8,
  c1: 1,
  c2: 1,
}

const MINING_CRYSTAL_BASE_CYCLE_SECONDS = 45

export const MINING_CRYSTAL_OPTIONS: readonly {
  id: Exclude<MiningCrystalId, 'none'>
  label: string
  yieldMultiplier: number
  durationMultiplier: number
  residueProbabilityBonus: number
  residueVolumeBonus: number
  asteroidVolatilityPct: number
  moonVolatilityPct: number
  hint: string
}[] = [
  {
    id: 'a1',
    label: 'Type A I',
    yieldMultiplier: 1.5,
    durationMultiplier: 1,
    residueProbabilityBonus: 0,
    residueVolumeBonus: 0,
    asteroidVolatilityPct: 2.5,
    moonVolatilityPct: 2.5,
    hint:
      'Use for everyday mining when preserving the asteroid or moon field matters. It adds yield without adding residue chance.',
  },
  {
    id: 'a2',
    label: 'Type A II',
    yieldMultiplier: 1.8,
    durationMultiplier: 1,
    residueProbabilityBonus: 3.6,
    residueVolumeBonus: 0,
    asteroidVolatilityPct: 3,
    moonVolatilityPct: 3,
    hint:
      'Use for efficient everyday mining with Tech II skills. It gives more yield than Type A I with only a small residue increase.',
  },
  {
    id: 'b1',
    label: 'Type B I',
    yieldMultiplier: 1.5,
    durationMultiplier: 0.9,
    residueProbabilityBonus: 20,
    residueVolumeBonus: 0,
    asteroidVolatilityPct: 2.5,
    moonVolatilityPct: 3.75,
    hint:
      'Use when finishing a rock or site quickly matters more than recovering every unit. Faster cycles create more residue.',
  },
  {
    id: 'b2',
    label: 'Type B II',
    yieldMultiplier: 1.8,
    durationMultiplier: 0.8,
    residueProbabilityBonus: 30,
    residueVolumeBonus: 0,
    asteroidVolatilityPct: 5,
    moonVolatilityPct: 5,
    hint:
      'Use for maximum extraction speed. It clears valuable rocks quickly but leaves more of the deposit as residue.',
  },
  {
    id: 'c1',
    label: 'Type C I',
    yieldMultiplier: 0.25,
    durationMultiplier: 1,
    residueProbabilityBonus: 40,
    residueVolumeBonus: 18,
    asteroidVolatilityPct: 2.5,
    moonVolatilityPct: 6,
    hint:
      'Use to remove unwanted or hostile rocks, not to maximize ore collected. It recovers little ore and destroys more of the deposit.',
  },
  {
    id: 'c2',
    label: 'Type C II',
    yieldMultiplier: 0.2,
    durationMultiplier: 1,
    residueProbabilityBonus: 59,
    residueVolumeBonus: 28,
    asteroidVolatilityPct: 7.5,
    moonVolatilityPct: 7.5,
    hint:
      'Use for aggressive field clearance. It removes deposits while recovering very little ore, so it is unsuitable for normal mining.',
  },
]

export function miningCrystalLabel(crystal: MiningCrystalId): string {
  if (crystal === 'none') return 'No crystal'
  const opt = MINING_CRYSTAL_OPTIONS.find((o) => o.id === crystal)
  return opt?.label ?? crystal
}

/**
 * Average base lifespan before volatility modifiers such as Equipment Preservation.
 * Uses the displayed Simple Asteroid or Ubiquitous Moon crystal's live ESI volatility.
 * Crystal HP is 1 and volatility damage is 0.05 HP per damage event.
 */
export function miningCrystalExpectedCycles(
  subtype: MiningSubtype,
  crystal: MiningCrystalId,
  lifespanMultiplier = 1,
): number | null {
  const xtal = normalizeMiningCrystal(crystal)
  if (xtal === 'none') return null
  const option = MINING_CRYSTAL_OPTIONS.find((entry) => entry.id === xtal)
  if (!option) return null
  const volatilityPct =
    subtype === 'moon' ? option.moonVolatilityPct : option.asteroidVolatilityPct
  return Math.round((1 / ((volatilityPct / 100) * 0.05)) * Math.max(1, lifespanMultiplier))
}

/** Base elapsed lifetime before hull, skill, and fleet cycle-time reductions. */
export function miningCrystalExpectedDurationSeconds(
  subtype: MiningSubtype,
  crystal: MiningCrystalId,
  lifespanMultiplier = 1,
): number | null {
  const xtal = normalizeMiningCrystal(crystal)
  if (xtal === 'none') return null
  const cycles = miningCrystalExpectedCycles(subtype, xtal, lifespanMultiplier)
  if (cycles == null) return null
  return Math.round(cycles * MINING_CRYSTAL_BASE_CYCLE_SECONDS * CRYSTAL_DURATION_MULT[xtal])
}

export function miningCrystalTypeId(
  subtype: MiningSubtype,
  crystal: MiningCrystalId,
): number | null {
  const xtal = normalizeMiningCrystal(crystal)
  if (xtal === 'none') return null
  const letter = xtal[0] as 'a' | 'b' | 'c'
  const tier = xtal[1] === '2' ? 2 : 1
  const key = `${letter}${tier}` as 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
  if (subtype === 'moon') {
    const map = {
      a1: MINING_FIT_TYPE_IDS.moonCrystalA1,
      a2: MINING_FIT_TYPE_IDS.moonCrystalA2,
      b1: MINING_FIT_TYPE_IDS.moonCrystalB1,
      b2: MINING_FIT_TYPE_IDS.moonCrystalB2,
      c1: MINING_FIT_TYPE_IDS.moonCrystalC1,
      c2: MINING_FIT_TYPE_IDS.moonCrystalC2,
    } as const
    return map[key]
  }
  if (subtype === 'ore' || subtype === 'ice') {
    const map = {
      a1: MINING_FIT_TYPE_IDS.oreCrystalA1,
      a2: MINING_FIT_TYPE_IDS.oreCrystalA2,
      b1: MINING_FIT_TYPE_IDS.oreCrystalB1,
      b2: MINING_FIT_TYPE_IDS.oreCrystalB2,
      c1: MINING_FIT_TYPE_IDS.oreCrystalC1,
      c2: MINING_FIT_TYPE_IDS.oreCrystalC2,
    } as const
    return map[key]
  }
  return null
}

export function miningCrystalMercoxitTypeId(crystal: MiningCrystalId): number | null {
  const xtal = normalizeMiningCrystal(crystal)
  if (xtal === 'none' || xtal[0] !== 'a') return null
  return xtal[1] === '2'
    ? MINING_FIT_TYPE_IDS.mercoxitCrystalA2
    : MINING_FIT_TYPE_IDS.mercoxitCrystalA1
}
/** Hull m³/hr tables assume these skill levels. */
export const BAKED_MINING_SKILL_LEVEL = 4
/**
 * Live SDE cycle amounts (Tranquility ESI).
 * Strip Miner I 17482: attr 77 = 150 m³.
 * Modulated Strip Miner II 17912: attr 77 = 120 m³.
 * Modulated Deep Core Strip Miner II 24305: attr 77 = 80 m³.
 * Crystal attr 782 modifies the module mining amount; attr 3161 modifies cycle duration.
 * Do not use hidden attr 789 as another per-cycle base after Catalyst's 4× cycle-speed change.
 * Mercoxit Type A I 18054 / II 18608: same 1.5 / 1.8 on MDCSM only (MSM II cannot load Mercoxit crystals).
 * MLU I 22542 / MLU II 28576: attr 434 miningAmountBonus = 5 / 9 (stacking).
 * Mining Survey Chipset I 444 / II 2333: attr 6049/6050 = +12% / +20% crit chance and crit yield.
 */
const STRIP_CYCLE_M3 = 150
const MODULATED_CYCLE_M3 = 120
const DEEP_CORE_CYCLE_M3 = 80
/** Ice Harvester I 16278 / II 22229: attr 73 = 240s / 200s. */
const ICE_HARVESTER_I_CYCLE_S = 240
const ICE_HARVESTER_II_CYCLE_S = 200
/** MLU attr 434 per module (stacking in miningUpgradeMultiplier). */
const MLU1_YIELD_BONUS = 0.05
const MLU2_YIELD_BONUS = 0.09
const BASE_MINING_CRIT_CHANCE = 0.01
const BASE_MINING_CRIT_BONUS_YIELD = 2
const MSC1_CRIT_BONUS = 0.12
const MSC2_CRIT_BONUS = 0.2

export type MiningYieldContext = {
  boosterHull?: MiningBoosterHullId | null
  foremanBurst?: MiningForemanBurstId
  foremanBursts?: MiningForemanBurstId[]
  burstTech?: MiningBurstTech
  industrialCore?: boolean
  miner?: MiningMinerModuleId
  upgrade?: MiningUpgradeId
  upgradeCount?: number
  surveyChipset?: MiningSurveyChipsetId
  crystal?: MiningCrystalId
  skills?: Partial<SkillLevels>
}

export type MiningFleetLineDefaults = {
  miner?: MiningMinerModuleId
  crystal?: MiningCrystalId
  upgrade?: MiningUpgradeId
  upgradeCount?: number
  surveyChipset?: MiningSurveyChipsetId
}

export function normalizeMiningUpgrade(id: MiningUpgradeId | undefined): MiningUpgradeId {
  return id === 'mlu1' || id === 'mlu2' ? id : 'none'
}

export function normalizeMiningUpgradeCount(count: number | undefined, upgrade: MiningUpgradeId): number {
  if (upgrade === 'none') return 0
  const n = Math.floor(Number(count))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_MINING_UPGRADE_COUNT)
}

export function normalizeMiningSurveyChipset(
  id: MiningSurveyChipsetId | undefined,
): MiningSurveyChipsetId {
  return id === 'msc1' || id === 'msc2' ? id : 'none'
}

export function normalizeMiningCrystal(id: MiningCrystalId | string | undefined): MiningCrystalId {
  if (id === 't1') return 'a1'
  if (id === 't2') return 'a2'
  if (
    id === 'a1' ||
    id === 'a2' ||
    id === 'b1' ||
    id === 'b2' ||
    id === 'c1' ||
    id === 'c2'
  ) {
    return id
  }
  return 'none'
}

export function normalizeMiningMiner(
  miner: MiningMinerModuleId | undefined,
  crystal: MiningCrystalId = 'none',
): MiningMinerModuleId {
  if (miner === 'strip' || miner === 'modulated' || miner === 'deepCore') return miner
  return crystal === 'none' ? DEFAULT_MINING_MINER : 'modulated'
}

/** Mercoxit is the only standard belt ore that requires Modulated Deep Core Strip Miner II. */
export const MERCOXIT_ORE_GROUP = 'Mercoxit'

export function oreRequiresDeepCoreMiner(oreGroup: string): boolean {
  return oreGroup === MERCOXIT_ORE_GROUP
}

/** Effective gun + crystal for a specific ore group (rankings assume matching Type A tier). */
export function effectiveMinerForOre(
  miner: MiningMinerModuleId | undefined,
  crystal: MiningCrystalId | undefined,
  oreGroup: string,
): { miner: MiningMinerModuleId; crystal: MiningCrystalId } | null {
  const gun = normalizeMiningMiner(miner, crystal)
  const xtal = normalizeMiningCrystal(crystal)
  if (oreRequiresDeepCoreMiner(oreGroup)) {
    if (gun !== 'deepCore') return null
    return { miner: 'deepCore', crystal: xtal === 'none' ? 'a1' : xtal }
  }
  if (gun === 'deepCore') {
    return { miner: 'deepCore', crystal: xtal === 'none' ? 'a1' : xtal }
  }
  return { miner: gun, crystal: xtal }
}

/** True when at least one fleet line can mine this ore with its selected module. */
export function fleetCanMineOreGroup(
  subtype: MiningSubtype,
  fleet: readonly MiningFleetLine[],
  ctx: MiningYieldContext,
  oreGroup: string,
): boolean {
  const normalized = normalizeMiningFleet(fleet, subtype)
  if (normalized.length === 0) return false

  const miners = normalized.map((line) =>
    normalizeMiningMiner(line.miner ?? ctx.miner, line.crystal ?? ctx.crystal),
  )
  const hasDeepCore = miners.some((m) => m === 'deepCore')
  const hasStandard = miners.some((m) => m === 'strip' || m === 'modulated')
  const needsDeep = oreRequiresDeepCoreMiner(oreGroup)

  if (hasDeepCore && !hasStandard) {
    return needsDeep
  }
  if (hasStandard && !hasDeepCore) {
    return !needsDeep
  }

  for (const line of normalized) {
    if (
      effectiveMinerForOre(
        line.miner ?? ctx.miner,
        line.crystal ?? ctx.crystal,
        oreGroup,
      )
    ) {
      return true
    }
  }
  return false
}

export function miningBurstSlotCount(hull: MiningBoosterHullId | null | undefined): number {
  if (hull === 'porpoise') return 2
  if (hull === 'orca' || hull === 'rorqual') return 3
  return 0
}

export function normalizeMiningForemanBursts(
  hull: MiningBoosterHullId | null | undefined,
  bursts: readonly MiningForemanBurstId[] | undefined,
  legacySingle?: MiningForemanBurstId,
): MiningForemanBurstId[] {
  const max = miningBurstSlotCount(hull)
  if (!hull || max < 1) return []
  const raw =
    bursts && bursts.length > 0
      ? bursts
      : [normalizeMiningForemanBurst(legacySingle)]
  const seen = new Set<MiningForemanBurstId>()
  const out: MiningForemanBurstId[] = []
  for (const burst of raw) {
    const id = normalizeMiningForemanBurst(burst)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= max) break
  }
  return out
}

export function toggleForemanBurst(
  hull: MiningBoosterHullId | null | undefined,
  current: readonly MiningForemanBurstId[],
  id: MiningForemanBurstId,
): MiningForemanBurstId[] {
  const max = miningBurstSlotCount(hull)
  const next = normalizeMiningForemanBursts(hull, current)
  if (next.includes(id)) return next.filter((b) => b !== id)
  if (next.length >= max) return next
  return [...next, id]
}

export function normalizeMiningBurstTech(tech: MiningBurstTech | undefined): MiningBurstTech {
  return tech === 't1' ? 't1' : DEFAULT_MINING_BURST_TECH
}

/** EVE stacking penalty on module bonuses. */
function stackingProduct(bonus: number, count: number): number {
  let m = 1
  for (let i = 0; i < count; i++) {
    m *= 1 + bonus * Math.exp(-(i * i) / 7.1289)
  }
  return m
}

export function miningUpgradeMultiplier(
  subtype: MiningSubtype,
  ship: MiningShipPreset,
  upgrade: MiningUpgradeId,
  count: number,
): number {
  if (upgrade === 'none' || count < 1) return 1
  if (subtype === 'gas') return 1
  if (ship.tier !== 'barge' && ship.tier !== 'exhumer') return 1
  if (subtype === 'ice') {
    const cut = upgrade === 'mlu2' ? MLU2_YIELD_BONUS : MLU1_YIELD_BONUS
    let duration = 1
    for (let i = 0; i < count; i++) {
      duration *= 1 - cut * Math.exp(-(i * i) / 7.1289)
    }
    return 1 / duration
  }
  const bonus = upgrade === 'mlu2' ? MLU2_YIELD_BONUS : MLU1_YIELD_BONUS
  return stackingProduct(bonus, count)
}

export function miningCrystalMultiplier(
  subtype: MiningSubtype,
  ship: MiningShipPreset,
  crystal: MiningCrystalId,
  miner: MiningMinerModuleId = crystal === 'none' ? 'strip' : 'modulated',
): number {
  if (subtype === 'gas') return 1
  if (ship.tier !== 'barge' && ship.tier !== 'exhumer') return 1
  const gun = normalizeMiningMiner(miner, crystal)
  if (gun === 'strip') return 1
  if (subtype === 'ice') return ICE_HARVESTER_I_CYCLE_S / ICE_HARVESTER_II_CYCLE_S
  const xtal = normalizeMiningCrystal(crystal)
  if (gun === 'deepCore') {
    if (xtal !== 'none') {
      return (
        (DEEP_CORE_CYCLE_M3 * CRYSTAL_YIELD_MULT[xtal]) /
        CRYSTAL_DURATION_MULT[xtal] /
        STRIP_CYCLE_M3
      )
    }
    return DEEP_CORE_CYCLE_M3 / STRIP_CYCLE_M3
  }
  if (xtal !== 'none') {
    return (
      (MODULATED_CYCLE_M3 * CRYSTAL_YIELD_MULT[xtal]) /
      CRYSTAL_DURATION_MULT[xtal] /
      STRIP_CYCLE_M3
    )
  }
  return MODULATED_CYCLE_M3 / STRIP_CYCLE_M3
}

function skillOrBaked(skills: Partial<SkillLevels> | undefined, key: keyof SkillLevels): number {
  const n = skills?.[key]
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(5, Math.floor(n))) : BAKED_MINING_SKILL_LEVEL
}

/** Relative to hull tables baked at skill IV. */
export function miningSkillYieldMultiplier(
  subtype: MiningSubtype,
  skills: Partial<SkillLevels> | undefined,
): number {
  const baked = 1 + 0.05 * BAKED_MINING_SKILL_LEVEL
  if (subtype === 'ore' || subtype === 'moon') {
    const mining = 1 + 0.05 * skillOrBaked(skills, 'mining')
    const astro = 1 + 0.05 * skillOrBaked(skills, 'astrogeology')
    return (mining * astro) / (baked * baked)
  }
  if (subtype === 'gas') return 1
  const level = skillOrBaked(skills, 'iceHarvesting')
  const atLevel = 1 / (1 - 0.05 * level)
  const atBaked = 1 / (1 - 0.05 * BAKED_MINING_SKILL_LEVEL)
  return atLevel / atBaked
}

function hullSkillRateAtLevels(
  subtype: MiningSubtype,
  ship: MiningShipPreset,
  miningBargeLevel: number,
  exhumersLevel: number,
): number {
  if (subtype === 'ore' || subtype === 'moon') {
    const yieldMultiplier =
      1 +
      ((ship.roleOreYieldPct ?? 0) +
        (ship.miningBargeOreYieldPct ?? 0) * miningBargeLevel +
        (ship.exhumersOreYieldPct ?? 0) * exhumersLevel) /
        100
    const durationMultiplier =
      (1 - (ship.roleOreDurationReductionPct ?? 0) / 100) *
      (1 - ((ship.exhumersOreDurationReductionPct ?? 0) * exhumersLevel) / 100)
    return yieldMultiplier / Math.max(0.01, durationMultiplier)
  }
  if (subtype === 'ice') {
    const durationMultiplier =
      (1 - (ship.roleIceDurationReductionPct ?? 0) / 100) *
      (1 - ((ship.miningBargeIceDurationReductionPct ?? 0) * miningBargeLevel) / 100) *
      (1 - ((ship.exhumersIceDurationReductionPct ?? 0) * exhumersLevel) / 100)
    return 1 / Math.max(0.01, durationMultiplier)
  }
  return 1
}

/** Mining Barge and Exhumers hull bonuses relative to the skill-IV rates in the hull table. */
export function miningHullSkillYieldMultiplier(
  subtype: MiningSubtype,
  ship: MiningShipPreset,
  skills: Partial<SkillLevels> | undefined,
): number {
  if (ship.tier !== 'barge' && ship.tier !== 'exhumer') return 1
  const atSelectedLevels = hullSkillRateAtLevels(
    subtype,
    ship,
    skillOrBaked(skills, 'miningBarge'),
    ship.tier === 'exhumer' ? skillOrBaked(skills, 'exhumers') : 0,
  )
  const atBakedLevels = hullSkillRateAtLevels(
    subtype,
    ship,
    BAKED_MINING_SKILL_LEVEL,
    ship.tier === 'exhumer' ? BAKED_MINING_SKILL_LEVEL : 0,
  )
  return atSelectedLevels / atBakedLevels
}

/**
 * Typical mining buffs by space.
 * Fleet yield uses miningBoosterHull + miningForemanBurst (not legacy boost chips).
 * @see https://wiki.eveuniversity.org/Perfect_mining
 */
export const MINING_BUFFS: MiningBuffPreset[] = [
  {
    id: 'highwall',
    label: 'Highwall Mining implant G5',
    shortLabel: 'Highwall G5',
    multiplier: 1.05,
    category: 'fit',
    hint: 'Inherent Implants "Highwall" Mining (+5% ore yield). Standard on ore/mining alts.',
    typeId: 22535,
    applies: (_ship, subtype) => subtype === 'ore' || subtype === 'moon',
  },
  {
    id: 'yeti',
    label: 'Yeti Ice Harvesting implant G5',
    shortLabel: 'Yeti G5',
    multiplier: 1.05,
    category: 'fit',
    hint: 'Inherent Implants "Yeti" Ice Harvesting (−5% ice harvester cycle time).',
    typeId: 22571,
    applies: (_ship, subtype) => subtype === 'ice',
  },
  {
    id: 'gasHarvesting',
    label: 'Gas Harvesting implant G5',
    shortLabel: 'Gas G5',
    multiplier: 1.05,
    category: 'fit',
    hint: 'Eifyr and Co. "Alchemist" Gas Harvesting (−5% gas harvester cycle time).',
    typeId: 27239,
    applies: (_ship, subtype) => subtype === 'gas',
  },
  {
    id: 'mindlink',
    label: 'Mining Foreman Mindlink',
    shortLabel: 'Mindlink',
    multiplier: 1.25,
    category: 'fleet',
    hint: '+25% Mining Foreman burst strength on the booster pilot.',
    typeId: 22559,
    applies: (_ship, _subtype, boostSpace, _activeBuffIds, boosterHull) =>
      boostSpace !== 'solo' && boosterHull != null,
  },
]

/** Legacy buff ids migrated to miningBoosterHull + miningForemanBurst. */
export const LEGACY_FLEET_BURST_BUFF_IDS: readonly MiningBuffId[] = [
  'orcaBoost',
  'rorqualBoost',
  'porpoiseBoost',
]

export const DEFAULT_MINING_SHIP_ID: MiningShipId = 'retriever'
export const DEFAULT_MINING_BOOST_SPACE: MiningBoostSpace = 'highsec'

const SHIP_BY_ID = new Map(MINING_SHIPS.map((s) => [s.id, s]))
const BUFF_BY_ID = new Map(MINING_BUFFS.map((b) => [b.id, b]))
const BOOSTER_HULL_BY_ID = new Map(MINING_BOOSTER_HULLS.map((h) => [h.id, h]))
const FOREMAN_BURST_BY_ID = new Map(MINING_FOREMAN_BURSTS.map((b) => [b.id, b]))

const VALID_BUFF_IDS = new Set<MiningBuffId>(MINING_BUFFS.map((b) => b.id))
const VALID_BOOST_SPACES = new Set<MiningBoostSpace>(MINING_BOOST_SPACES.map((s) => s.id))
const LEGACY_BURST_SET = new Set<MiningBuffId>(LEGACY_FLEET_BURST_BUFF_IDS)

export function getMiningBoosterHull(id: MiningBoosterHullId | undefined | null): MiningBoosterHullPreset | null {
  if (!id) return null
  return BOOSTER_HULL_BY_ID.get(id) ?? null
}

export function normalizeMiningBoosterHull(
  hull: MiningBoosterHullId | null | undefined,
): MiningBoosterHullId | null {
  if (!hull) return null
  return BOOSTER_HULL_BY_ID.has(hull) ? hull : null
}

export function normalizeMiningForemanBurst(
  burst: MiningForemanBurstId | undefined,
): MiningForemanBurstId {
  if (burst && FOREMAN_BURST_BY_ID.has(burst)) return burst
  return DEFAULT_MINING_FOREMAN_BURST
}

export function miningBoosterHullsForSpace(_boostSpace?: MiningBoostSpace): MiningBoosterHullPreset[] {
  return MINING_BOOSTER_HULLS
}

function foremanBurstStrength(
  hull: MiningBoosterHullId,
  skills?: Partial<SkillLevels>,
  burstTech: MiningBurstTech = DEFAULT_MINING_BURST_TECH,
  industrialCore = true,
  mindlink = false,
): number {
  const ics = skillOrBaked(skills, 'industrialCommandShips')
  const cis = skillOrBaked(skills, 'capitalIndustrialShips')
  const hullBonus =
    hull === 'porpoise' ? 0.02 * ics : hull === 'orca' ? 0.03 * ics : hull === 'rorqual' ? 0.05 * cis : 0
  let strength = 1 + hullBonus
  if (normalizeMiningBurstTech(burstTech) === 't2') strength *= 1.25
  if (mindlink) strength *= 1.25
  if (industrialCore && (hull === 'orca' || hull === 'rorqual')) strength *= 1.3
  return strength
}

/** Expected crystal-life multiplier from a loaded Equipment Preservation burst. */
export function miningCrystalLifeMultiplier(
  ctx: MiningYieldContext,
  buffIds: readonly MiningBuffId[] = [],
): number {
  const hull = normalizeMiningBoosterHull(ctx.boosterHull)
  if (!hull) return 1
  const loaded = normalizeMiningForemanBursts(hull, ctx.foremanBursts, ctx.foremanBurst)
  if (!loaded.includes('miningEquipmentPreservation')) return 1
  const strength = foremanBurstStrength(
    hull,
    ctx.skills,
    ctx.burstTech,
    ctx.industrialCore !== false,
    buffIds.includes('mindlink'),
  )
  const volatilityReduction = Math.min(0.95, 0.15 * strength)
  return 1 / (1 - volatilityReduction)
}

function burstChargeYieldMultiplier(yieldKind: MiningForemanYieldKind, strength: number): number {
  if (yieldKind === 'cycle') {
    const cycleCut = Math.min(0.85, 0.15 * strength)
    return 1 / (1 - cycleCut)
  }
  if (yieldKind === 'crit') {
    // Crit yield is computed per fit (survey chipset + efficiency burst) in miningCritYieldMultiplier.
    return 1
  }
  return 1
}

function surveyChipsetCritBonuses(chipset: MiningSurveyChipsetId): { chanceMult: number; bonusMult: number } {
  switch (normalizeMiningSurveyChipset(chipset)) {
    case 'msc1':
      return { chanceMult: 1 + MSC1_CRIT_BONUS, bonusMult: 1 + MSC1_CRIT_BONUS }
    case 'msc2':
      return { chanceMult: 1 + MSC2_CRIT_BONUS, bonusMult: 1 + MSC2_CRIT_BONUS }
    default:
      return { chanceMult: 1, bonusMult: 1 }
  }
}

/** Expected m³/hr from mining crits (chipset + optional Efficiency burst). */
export function miningCritYieldMultiplier(
  subtype: MiningSubtype,
  ship: MiningShipPreset,
  ctx: MiningYieldContext,
  buffIds: readonly MiningBuffId[] = [],
): number {
  if (subtype === 'gas') return 1
  if (ship.tier !== 'barge' && ship.tier !== 'exhumer') return 1

  const chipset = normalizeMiningSurveyChipset(ctx.surveyChipset)
  let hasEffBurst = false
  if (ctx.boosterHull) {
    const loaded = normalizeMiningForemanBursts(ctx.boosterHull, ctx.foremanBursts, ctx.foremanBurst)
    hasEffBurst = loaded.includes('miningLaserEfficiency')
  }
  if (chipset === 'none' && !hasEffBurst) return 1

  const { chanceMult, bonusMult } = surveyChipsetCritBonuses(chipset)
  let critChance = BASE_MINING_CRIT_CHANCE * chanceMult

  if (hasEffBurst && ctx.boosterHull) {
    const strength = foremanBurstStrength(
      ctx.boosterHull,
      ctx.skills,
      ctx.burstTech,
      ctx.industrialCore !== false,
      buffIds.includes('mindlink'),
    )
    critChance = Math.min(0.25, critChance * (1 + 0.5 * strength))
  }

  const critBonus = BASE_MINING_CRIT_BONUS_YIELD * bonusMult
  return 1 + critChance * critBonus
}

/** @deprecated Use miningCritYieldMultiplier; kept for burst tests comparing strength only. */
export function burstEfficiencyCritMultiplier(strength: number, chipset: MiningSurveyChipsetId = 'none'): number {
  const { chanceMult, bonusMult } = surveyChipsetCritBonuses(chipset)
  const critChance = Math.min(0.25, BASE_MINING_CRIT_CHANCE * chanceMult * (1 + 0.5 * strength))
  return 1 + critChance * (BASE_MINING_CRIT_BONUS_YIELD * bonusMult)
}

/** Yield from loaded Foreman charges. Optimization and Efficiency stack. */
export function fleetBurstsYieldMultiplier(
  hull: MiningBoosterHullId | null | undefined,
  bursts: readonly MiningForemanBurstId[] | undefined,
  skills?: Partial<SkillLevels>,
  burstTech: MiningBurstTech = DEFAULT_MINING_BURST_TECH,
  industrialCore = true,
  mindlink = false,
  legacyBurst?: MiningForemanBurstId,
): number {
  if (!hull) return 1
  const loaded = normalizeMiningForemanBursts(hull, bursts, legacyBurst)
  if (loaded.length === 0) return 1
  const strength = foremanBurstStrength(hull, skills, burstTech, industrialCore, mindlink)
  let m = 1
  for (const id of loaded) {
    const kind = FOREMAN_BURST_BY_ID.get(id)?.yieldKind ?? 'none'
    m *= burstChargeYieldMultiplier(kind, strength)
  }
  return m
}

/** Yield from a single Foreman charge (tests and legacy single-burst settings). */
export function fleetBurstYieldMultiplier(
  hull: MiningBoosterHullId | null | undefined,
  burst: MiningForemanBurstId | undefined,
  skills?: Partial<SkillLevels>,
  burstTech: MiningBurstTech = DEFAULT_MINING_BURST_TECH,
  industrialCore = true,
  mindlink = false,
): number {
  return fleetBurstsYieldMultiplier(hull, burst ? [burst] : [], skills, burstTech, industrialCore, mindlink)
}

export function migrateBoosterFromLegacyBuffIds(buffIds: readonly MiningBuffId[]): {
  hull: MiningBoosterHullId | null
  burst: MiningForemanBurstId
  buffIds: MiningBuffId[]
  upgrade: MiningUpgradeId
  upgradeCount: number
} {
  let hull: MiningBoosterHullId | null = null
  let upgrade: MiningUpgradeId = 'none'
  let upgradeCount = 0
  const remaining: MiningBuffId[] = []
  for (const id of buffIds) {
    if (id === 'porpoiseBoost') hull = 'porpoise'
    else if (id === 'orcaBoost') hull = 'orca'
    else if (id === 'rorqualBoost') hull = 'rorqual'
    else if (id === 'mlu3') {
      upgrade = 'mlu1'
      upgradeCount = 3
    } else if (LEGACY_BURST_SET.has(id)) continue
    else if (VALID_BUFF_IDS.has(id)) remaining.push(id)
  }
  return {
    hull,
    burst: DEFAULT_MINING_FOREMAN_BURST,
    buffIds: remaining,
    upgrade,
    upgradeCount,
  }
}

function stripLegacyBurstBuffIds(ids: MiningBuffId[]): MiningBuffId[] {
  return ids.filter((id) => !LEGACY_BURST_SET.has(id))
}

/** Toggle a fit or mindlink buff. */
export function toggleMiningBuffId(
  buffIds: readonly MiningBuffId[],
  id: MiningBuffId,
): MiningBuffId[] {
  if (buffIds.includes(id)) return buffIds.filter((b) => b !== id)
  return [...buffIds, id]
}

export function getMiningShip(id: MiningShipId | undefined): MiningShipPreset {
  return SHIP_BY_ID.get(id ?? DEFAULT_MINING_SHIP_ID) ?? MINING_SHIPS[0]
}

export function normalizeMiningBoostSpace(
  space: MiningBoostSpace | undefined,
): MiningBoostSpace {
  if (space && VALID_BOOST_SPACES.has(space)) return space
  return DEFAULT_MINING_BOOST_SPACE
}

export function miningBoostSpaceLabel(space: MiningBoostSpace): string {
  return MINING_BOOST_SPACES.find((s) => s.id === space)?.label ?? space
}

/** Derive boost context from booster hull or legacy buff ids. */
export function inferMiningBoostSpace(
  buffIds: readonly MiningBuffId[],
  fallback: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
  boosterHull?: MiningBoosterHullId | null,
): MiningBoostSpace {
  if (boosterHull === 'orca') return 'highsec'
  if (boosterHull === 'rorqual') {
    return fallback === 'solo' || fallback === 'highsec' ? 'nullsec' : fallback
  }
  if (boosterHull === 'porpoise') {
    return fallback === 'solo' ? 'wormhole' : fallback
  }
  for (const id of buffIds) {
    if (id === 'orcaBoost') return 'highsec'
    if (id === 'rorqualBoost') {
      return fallback === 'solo' || fallback === 'highsec' ? 'nullsec' : fallback
    }
    if (id === 'porpoiseBoost') {
      return fallback === 'solo' ? 'wormhole' : fallback
    }
  }
  return 'solo'
}

export function miningShipSupportsSubtype(
  ship: MiningShipPreset,
  subtype: MiningSubtype,
): boolean {
  return ship.subtypes.includes(subtype)
}

export function miningShipsForSubtype(subtype: MiningSubtype): MiningShipPreset[] {
  return MINING_SHIPS.filter((s) => s.subtypes.includes(subtype))
}

const MINING_SUBTYPE_LABELS: Record<MiningSubtype, string> = {
  ore: 'ore',
  moon: 'moon',
  ice: 'ice',
  gas: 'gas',
}

export function miningShipSubtypeHint(ship: MiningShipPreset): string {
  return ship.subtypes.map((s) => MINING_SUBTYPE_LABELS[s]).join(', ')
}

export const MINING_SHIP_GROUPS: MiningShipGroup[] = [
  { id: 'barge-t1', label: 'Barge T1', tier: 'barge', tech: 't1' },
  { id: 'exhumer-t2', label: 'Exhumer T2', tier: 'exhumer', tech: 't2' },
  { id: 'frigate-t1', label: 'Frigate T1', tier: 'frigate', tech: 't1' },
  { id: 'expedition-t2', label: 'Expedition T2', tier: 'expedition', tech: 't2' },
]

export function miningShipGroupsForSubtype(subtype: MiningSubtype): {
  group: MiningShipGroup
  ships: MiningShipPreset[]
}[] {
  const ships = miningShipsForSubtype(subtype)
  return MINING_SHIP_GROUPS.map((group) => ({
    group,
    ships: ships.filter((s) => s.tier === group.tier && s.tech === group.tech),
  })).filter((row) => row.ships.length > 0)
}

export function defaultMiningShipForSubtype(subtype: MiningSubtype): MiningShipId {
  const ships = miningShipsForSubtype(subtype)
  const preferred = ships.find((s) => s.id === DEFAULT_MINING_SHIP_ID)
  return preferred?.id ?? ships[0]?.id ?? DEFAULT_MINING_SHIP_ID
}

export function normalizeMiningShipId(
  id: MiningShipId | undefined,
  subtype: MiningSubtype,
): MiningShipId {
  const ship = getMiningShip(id)
  if (ship.subtypes.includes(subtype)) return ship.id
  return defaultMiningShipForSubtype(subtype)
}

/** Migrate legacy fleetBoost and drop buffs invalid for the current boost space. */
export function normalizeMiningBuffIds(
  ids: MiningBuffId[] | undefined,
  boostSpace: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
): MiningBuffId[] {
  if (!ids?.length) return []
  const space = normalizeMiningBoostSpace(boostSpace)
  const expanded = ids.flatMap((id): MiningBuffId[] => {
    if (id === ('fleetBoost' as MiningBuffId)) {
      return space === 'highsec' ? ['orcaBoost'] : space === 'solo' ? [] : ['rorqualBoost']
    }
    if (LEGACY_BURST_SET.has(id)) return []
    return VALID_BUFF_IDS.has(id) ? [id] : []
  })
  return stripLegacyBurstBuffIds([...new Set(expanded)])
}

export function miningBuffApplies(
  buffId: MiningBuffId,
  ship: MiningShipPreset,
  subtype: MiningSubtype,
  boostSpace: MiningBoostSpace,
  activeBuffIds: readonly MiningBuffId[],
  boosterHull?: MiningBoosterHullId | null,
): boolean {
  const buff = BUFF_BY_ID.get(buffId)
  if (!buff) return false
  return buff.applies(ship, subtype, boostSpace, activeBuffIds, boosterHull)
}

export function applicableMiningBuffIds(
  shipId: MiningShipId | undefined,
  subtype: MiningSubtype,
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace,
  boosterHull?: MiningBoosterHullId | null,
): MiningBuffId[] {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const space = normalizeMiningBoostSpace(boostSpace)
  const normalized = normalizeMiningBuffIds([...buffIds], space)
  return normalized.filter((id) =>
    miningBuffApplies(id, ship, subtype, space, normalized, boosterHull),
  )
}

export function miningBuffsForContext(
  shipId: MiningShipId | undefined,
  subtype: MiningSubtype,
  boostSpace: MiningBoostSpace,
  activeBuffIds: readonly MiningBuffId[],
  boosterHull?: MiningBoosterHullId | null,
): { fit: MiningBuffPreset[]; fleet: MiningBuffPreset[] } {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const space = normalizeMiningBoostSpace(boostSpace)
  const fit: MiningBuffPreset[] = []
  const fleet: MiningBuffPreset[] = []
  for (const buff of MINING_BUFFS) {
    if (!buff.applies(ship, subtype, space, activeBuffIds, boosterHull)) continue
    if (buff.category === 'fit') fit.push(buff)
    else if (space !== 'solo') fleet.push(buff)
  }
  return { fit, fleet }
}

/** All fit buffs to show in the setup UI (mindlink when booster is set). */
export function miningBuffsForSetup(
  shipId: MiningShipId | undefined,
  subtype: MiningSubtype,
  activeBuffIds: readonly MiningBuffId[],
  boosterHull?: MiningBoosterHullId | null,
): MiningBuffPreset[] {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const result: MiningBuffPreset[] = []
  for (const buff of MINING_BUFFS) {
    if (buff.category === 'fit') {
      if (buff.applies(ship, subtype, 'solo', activeBuffIds, boosterHull)) result.push(buff)
      continue
    }
    if (buff.id === 'mindlink' && boosterHull) {
      result.push(buff)
    }
  }
  return result
}

export function miningFitBuffMultiplier(buffIds: readonly MiningBuffId[]): number {
  let mult = 1
  for (const id of buffIds) {
    const buff = BUFF_BY_ID.get(id)
    if (buff && buff.category === 'fit') mult *= buff.multiplier
  }
  return mult
}

export function miningBuffMultiplier(
  buffIds: readonly MiningBuffId[],
  ctx: MiningYieldContext = {},
): number {
  const mindlink = buffIds.includes('mindlink')
  return (
    miningFitBuffMultiplier(buffIds) *
    fleetBurstsYieldMultiplier(
      ctx.boosterHull,
      ctx.foremanBursts,
      ctx.skills,
      ctx.burstTech,
      ctx.industrialCore !== false,
      mindlink,
      ctx.foremanBurst,
    )
  )
}

export function miningFitYieldMultiplier(
  subtype: MiningSubtype,
  ship: MiningShipPreset,
  ctx: MiningYieldContext = {},
  buffIds: readonly MiningBuffId[] = [],
): number {
  const upgrade = normalizeMiningUpgrade(ctx.upgrade)
  const count = normalizeMiningUpgradeCount(ctx.upgradeCount, upgrade)
  const crystal = normalizeMiningCrystal(ctx.crystal)
  const miner = normalizeMiningMiner(ctx.miner, crystal)
  return (
    miningUpgradeMultiplier(subtype, ship, upgrade, count) *
    miningCrystalMultiplier(subtype, ship, crystal, miner) *
    miningSkillYieldMultiplier(subtype, ctx.skills) *
    miningHullSkillYieldMultiplier(subtype, ship, ctx.skills) *
    miningCritYieldMultiplier(subtype, ship, ctx, buffIds)
  )
}

export function formatBuffPercent(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 1000) / 10
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

export const DEFAULT_MINING_FLEET_SIZE = 1
export const MAX_MINING_FLEET_SIZE = 99

export function normalizeMiningFleetSize(size: number | undefined): number {
  const n = Math.floor(Number(size))
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MINING_FLEET_SIZE
  return Math.min(n, MAX_MINING_FLEET_SIZE)
}

function capFleetTotal(lines: MiningFleetLine[]): MiningFleetLine[] {
  const result = lines.map((l) => ({
    ...l,
    count: normalizeMiningFleetSize(l.count),
  }))
  let total = result.reduce((sum, l) => sum + l.count, 0)
  while (total > MAX_MINING_FLEET_SIZE && result.length > 0) {
    const last = result[result.length - 1]
    if (last.count > 1) {
      last.count--
      total--
    } else {
      result.pop()
      total--
    }
  }
  return result
}

function fleetLineKey(line: MiningFleetLine): string {
  const crystal = normalizeMiningCrystal(line.crystal)
  const miner = normalizeMiningMiner(line.miner, crystal)
  const upgrade = normalizeMiningUpgrade(line.upgrade)
  const upgradeCount = normalizeMiningUpgradeCount(line.upgradeCount, upgrade)
  const surveyChipset = normalizeMiningSurveyChipset(line.surveyChipset)
  const buffs = (line.buffIds ?? []).slice().sort().join(',')
  const skills = line.skills
    ? Object.keys(line.skills)
        .sort()
        .map((k) => `${k}:${line.skills?.[k] ?? ''}`)
        .join(',')
    : ''
  return `${line.shipId}|${miner}|${crystal}|${upgrade}|${upgradeCount}|${surveyChipset}|${buffs}|${skills}`
}

function coerceFleetLineForSubtype(
  line: MiningFleetLine,
  subtype: MiningSubtype,
): MiningFleetLine {
  let crystal = normalizeMiningCrystal(line.crystal)
  let miner = normalizeMiningMiner(line.miner, crystal)
  if (subtype === 'ice') {
    crystal = 'none'
  }
  if (subtype !== 'ore' && miner === 'deepCore') {
    miner = 'modulated'
  }
  return { ...line, miner, crystal }
}

function hydrateFleetLine(
  line: MiningFleetLine,
  subtype: MiningSubtype,
  defaults?: MiningFleetLineDefaults,
): MiningFleetLine {
  const crystal = normalizeMiningCrystal(line.crystal ?? defaults?.crystal)
  const miner = normalizeMiningMiner(line.miner ?? defaults?.miner, crystal)
  const upgrade = normalizeMiningUpgrade(line.upgrade ?? defaults?.upgrade)
  const surveyChipset = normalizeMiningSurveyChipset(
    line.surveyChipset ?? defaults?.surveyChipset ?? DEFAULT_MINING_SURVEY_CHIPSET,
  )
  return coerceFleetLineForSubtype(
    {
      ...line,
      miner,
      crystal,
      upgrade,
      surveyChipset,
      upgradeCount: normalizeMiningUpgradeCount(
        line.upgradeCount ?? defaults?.upgradeCount,
        upgrade,
      ),
    },
    subtype,
  )
}

export function yieldCtxForLine(
  line: MiningFleetLine,
  ctx: MiningYieldContext,
): MiningYieldContext {
  return {
    ...ctx,
    miner: line.miner ?? ctx.miner,
    crystal: line.crystal ?? ctx.crystal,
    upgrade: line.upgrade ?? ctx.upgrade,
    upgradeCount: line.upgradeCount ?? ctx.upgradeCount,
    surveyChipset: line.surveyChipset ?? ctx.surveyChipset,
    skills: { ...ctx.skills, ...line.skills },
  }
}

export function buffIdsForLine(
  line: MiningFleetLine,
  fleetBuffIds: readonly MiningBuffId[],
): MiningBuffId[] {
  if (line.buffIds) return [...line.buffIds, ...fleetBuffIds.filter((id) => id === 'mindlink')]
  return [...fleetBuffIds]
}

/** Merge identical fits, drop invalid ships, migrate legacy single-ship settings. */
export function normalizeMiningFleet(
  fleet: readonly MiningFleetLine[] | undefined,
  subtype: MiningSubtype,
  legacyShip?: MiningShipId,
  legacySize?: number,
  defaults?: MiningFleetLineDefaults,
): MiningFleetLine[] {
  const merged = new Map<string, MiningFleetLine>()

  function addLine(line: MiningFleetLine) {
    let ship = getMiningShip(line.shipId)
    if (!miningShipSupportsSubtype(ship, subtype)) {
      ship = getMiningShip(defaultMiningShipForSubtype(subtype))
    }
    const hydrated = hydrateFleetLine({ ...line, shipId: ship.id }, subtype, defaults)
    hydrated.count = normalizeMiningFleetSize(hydrated.count)
    const key = fleetLineKey(hydrated)
    const prev = merged.get(key)
    if (prev) {
      prev.count = normalizeMiningFleetSize(prev.count + hydrated.count)
      return
    }
    merged.set(key, hydrated)
  }

  if (fleet?.length) {
    for (const line of fleet) addLine(line)
  } else if (legacyShip) {
    addLine({
      shipId: normalizeMiningShipId(legacyShip, subtype),
      count: normalizeMiningFleetSize(legacySize),
    })
  }

  let lines = [...merged.values()]
  if (lines.length === 0) {
    lines = [
      hydrateFleetLine(
        { shipId: defaultMiningShipForSubtype(subtype), count: DEFAULT_MINING_FLEET_SIZE },
        subtype,
        defaults,
      ),
    ]
  }

  return capFleetTotal(lines)
}

export function resolveUserMiningM3PerHrFromFleet(
  subtype: MiningSubtype,
  fleet: readonly MiningFleetLine[],
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
  ctx: MiningYieldContext = {},
): number {
  const normalized = normalizeMiningFleet(fleet, subtype)
  let sum = 0
  for (const line of normalized) {
    sum += resolveUserMiningM3PerHr(
      subtype,
      line.shipId,
      buffIdsForLine(line, buffIds),
      boostSpace,
      line.count,
      yieldCtxForLine(line, ctx),
    )
  }
  return sum
}

/** Fleet m³/hr for one ore row, using the module + crystal that ore actually needs. */
export function resolveUserMiningM3PerHrForOre(
  subtype: MiningSubtype,
  fleet: readonly MiningFleetLine[],
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace,
  ctx: MiningYieldContext,
  oreGroup: string,
): number {
  const normalized = normalizeMiningFleet(fleet, subtype)
  let sum = 0
  for (const line of normalized) {
    const lineCrystal = normalizeMiningCrystal(line.crystal ?? ctx.crystal)
    const effective = effectiveMinerForOre(line.miner ?? ctx.miner, lineCrystal, oreGroup)
    if (!effective) continue
    sum += resolveUserMiningM3PerHr(
      subtype,
      line.shipId,
      buffIdsForLine(line, buffIds),
      boostSpace,
      line.count,
      {
        ...yieldCtxForLine(line, ctx),
        miner: effective.miner,
        crystal: effective.crystal,
      },
    )
  }
  return sum
}

export function formatBoosterBurstLabel(
  boosterHull: MiningBoosterHullId | null | undefined,
  foremanBurst: MiningForemanBurstId | undefined,
  foremanBursts?: readonly MiningForemanBurstId[],
): string | null {
  if (!boosterHull) return null
  const hull = getMiningBoosterHull(boosterHull)
  if (!hull) return null
  const loaded = normalizeMiningForemanBursts(boosterHull, foremanBursts, foremanBurst)
  if (loaded.length === 0) return hull.label
  const names = loaded
    .map((id) => FOREMAN_BURST_BY_ID.get(id)?.label)
    .filter((s): s is string => Boolean(s))
  return names.length ? `${hull.label} · ${names.join(', ')}` : hull.label
}

export function formatMiningFleetSummary(
  subtype: MiningSubtype,
  fleet: readonly MiningFleetLine[],
  buffIds: readonly MiningBuffId[],
  m3PerHr: number,
  boostSpace: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
  ctx: MiningYieldContext = {},
): string {
  const normalized = normalizeMiningFleet(fleet, subtype)
  const space = normalizeMiningBoostSpace(boostSpace)
  const fleetPart = normalized
    .map((line) => {
      const ship = getMiningShip(line.shipId)
      return line.count > 1 ? `${line.count}× ${ship.label}` : ship.label
    })
    .join(' + ')
  const labels: string[] = []
  const boosterLabel = formatBoosterBurstLabel(ctx.boosterHull, ctx.foremanBurst, ctx.foremanBursts)
  if (boosterLabel) labels.push(boosterLabel)
  const upgrade = normalizeMiningUpgrade(ctx.upgrade)
  const upgradeCount = normalizeMiningUpgradeCount(ctx.upgradeCount, upgrade)
  if (upgrade !== 'none' && upgradeCount > 0) {
    labels.push(
      `${upgradeCount}× ${upgrade === 'mlu2' ? 'Mining Laser Upgrade II' : 'Mining Laser Upgrade I'}`,
    )
  }
  const surveyChipset = normalizeMiningSurveyChipset(ctx.surveyChipset)
  if (surveyChipset === 'msc2') labels.push('Mining Survey Chipset II')
  else if (surveyChipset === 'msc1') labels.push('Mining Survey Chipset I')
  const crystal = normalizeMiningCrystal(ctx.crystal)
  const miner = normalizeMiningMiner(ctx.miner, crystal)
  if (crystal !== 'none') {
    const crystalLabel = miningCrystalLabel(crystal)
    if (miner === 'deepCore') {
      labels.push(`MDCSM II + ${crystalLabel} crystal`)
    } else {
      labels.push(`MSM II + ${crystalLabel} crystal`)
    }
  }
  const activeIds = new Set<MiningBuffId>()
  for (const line of normalized) {
    for (const id of applicableMiningBuffIds(
      line.shipId,
      subtype,
      buffIds,
      space,
      ctx.boosterHull,
    )) {
      activeIds.add(id)
    }
  }
  for (const id of activeIds) {
    const name = BUFF_BY_ID.get(id)?.label
    if (name) labels.push(name)
  }
  const buffPart = labels.length > 0 ? labels.join(' + ') : 'Hull only'
  return `${fleetPart} · ${buffPart} · ${m3PerHr.toLocaleString()} m³/hr`
}

/** Buff chips for a mixed fleet: union of fit buffs across all hulls. */
export function miningBuffsForFleetSetup(
  fleet: readonly MiningFleetLine[],
  subtype: MiningSubtype,
  activeBuffIds: readonly MiningBuffId[],
  boosterHull?: MiningBoosterHullId | null,
): MiningBuffPreset[] {
  const normalized = normalizeMiningFleet(fleet, subtype)
  const seen = new Set<MiningBuffId>()
  const result: MiningBuffPreset[] = []
  for (const line of normalized) {
    for (const buff of miningBuffsForSetup(line.shipId, subtype, activeBuffIds, boosterHull)) {
      if (!seen.has(buff.id)) {
        seen.add(buff.id)
        result.push(buff)
      }
    }
  }
  const order = new Map(MINING_BUFFS.map((b, i) => [b.id, i]))
  result.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return result
}

export function resolveUserMiningM3PerHr(
  subtype: MiningSubtype,
  shipId: MiningShipId | undefined,
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
  fleetSize: number = DEFAULT_MINING_FLEET_SIZE,
  ctx: MiningYieldContext = {},
): number {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const base = ship.m3PerHrBySubtype[subtype] ?? DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE[subtype]
  const active = applicableMiningBuffIds(shipId, subtype, buffIds, boostSpace, ctx.boosterHull)
  const perShip = base * miningFitYieldMultiplier(subtype, ship, ctx, active) * miningBuffMultiplier(active, ctx)
  return Math.round(perShip * normalizeMiningFleetSize(fleetSize))
}

export function resolveUserMiningBaseM3PerHr(
  subtype: MiningSubtype,
  shipId: MiningShipId | undefined,
): number {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  return ship.m3PerHrBySubtype[subtype] ?? DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE[subtype]
}

export function formatMiningSetupSummary(
  subtype: MiningSubtype,
  shipId: MiningShipId | undefined,
  buffIds: readonly MiningBuffId[],
  m3PerHr: number,
  boostSpace: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
  fleetSize: number = DEFAULT_MINING_FLEET_SIZE,
): string {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const space = normalizeMiningBoostSpace(boostSpace)
  const active = applicableMiningBuffIds(shipId, subtype, buffIds, space)
  const buffLabels = active
    .map((id) => BUFF_BY_ID.get(id)?.label)
    .filter(Boolean) as string[]
  const buffPart = buffLabels.length > 0 ? buffLabels.join(' + ') : 'Hull only'
  const fleet = normalizeMiningFleetSize(fleetSize)
  const fleetPart = fleet > 1 ? `${fleet}× ` : ''
  return `${fleetPart}${ship.label} · ${buffPart} · ${m3PerHr.toLocaleString()} m³/hr`
}

export function miningBuffIdsForBoostSpace(
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace,
  boosterHull?: MiningBoosterHullId | null,
): MiningBuffId[] {
  const space = normalizeMiningBoostSpace(boostSpace)
  let normalized = normalizeMiningBuffIds([...buffIds], space)
  if (space === 'solo' || !boosterHull) {
    normalized = normalized.filter((id) => BUFF_BY_ID.get(id)?.category === 'fit')
    return normalized.filter((id) => id !== 'mindlink')
  }
  const hull = getMiningBoosterHull(boosterHull)
  if (!hull?.boostSpaces.includes(space)) {
    return normalized.filter((id) => BUFF_BY_ID.get(id)?.category === 'fit')
  }
  return normalized
}
