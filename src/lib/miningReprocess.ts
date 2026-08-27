import type {
  MiningItem,
  MiningReprocessFacility,
  MiningReprocessHull,
  MiningReprocessRig,
  MiningReprocessSpace,
  MiningSubtype,
  ProductionLocationKind,
  SkillLevels,
} from '@/types'
import { displayedSystemSecurity } from '@/lib/manufacturingRigs'
import { skillLevel, type SkillFieldDef } from '@/lib/skillFields'

const NPC_STATION_YIELD = 0.5

export const MINING_REPROCESS_HULLS: {
  id: MiningReprocessHull
  typeId: number
  label: string
  hint: string
}[] = [
  { id: 'npc', typeId: 1529, label: 'NPC station', hint: '50% equipment. No Upwell hull or standup rig.' },
  {
    id: 'upwell',
    typeId: 35833,
    label: 'Citadel / EC',
    hint: 'Other Upwell hulls (Fortizar, Keepstar, Azbel). No refine hull bonus. L/XL Reprocessing Monitor if fitted.',
  },
  { id: 'athanor', typeId: 35835, label: 'Athanor', hint: '+2% refine hull bonus. Medium M-Set processors are ore-type specific.' },
  { id: 'tatara', typeId: 35836, label: 'Tatara', hint: '+5.5% refine hull bonus. Large L-Set Reprocessing Monitor covers ore and ice.' },
]

export const MINING_REPROCESS_SPACES: { id: MiningReprocessSpace; label: string }[] = [
  { id: 'highsec', label: 'HS' },
  { id: 'lowsec', label: 'LS' },
  { id: 'nullsec', label: 'NS/WH' },
]

const RIG_TYPE_IDS = {
  asteroid: { t1: 46633, t2: 46634 },
  ice: { t1: 46635, t2: 46636 },
  moon: { t1: 46637, t2: 46638 },
  lSet: { t1: 46639, t2: 46640 },
} as const

export function miningReprocessHullFromLocation(
  kind: ProductionLocationKind,
  structureTypeId?: number,
): MiningReprocessHull {
  if (kind === 'station') return 'npc'
  if (structureTypeId === 35835) return 'athanor'
  if (structureTypeId === 35836) return 'tatara'
  return 'upwell'
}

export function miningReprocessSpaceFromSecurity(security: number): MiningReprocessSpace {
  const shown = displayedSystemSecurity(security)
  if (shown >= 0.5) return 'highsec'
  if (shown > 0) return 'lowsec'
  return 'nullsec'
}

export function miningReprocessSpaceFromSystem(
  systems: { systemId: number; security: number }[] | undefined,
  systemId: number,
  fallback: MiningReprocessSpace = 'highsec',
): MiningReprocessSpace {
  const system = systems?.find((row) => row.systemId === systemId)
  return system ? miningReprocessSpaceFromSecurity(system.security) : fallback
}

export function miningReprocessHullLabel(hull: MiningReprocessHull): string {
  return MINING_REPROCESS_HULLS.find((row) => row.id === hull)?.label ?? 'NPC station'
}

export function normalizeMiningReprocessFacility(
  facility?: Partial<MiningReprocessFacility> | null,
): MiningReprocessFacility {
  const hull: MiningReprocessHull =
    facility?.hull === 'upwell' || facility?.hull === 'athanor' || facility?.hull === 'tatara'
      ? facility.hull
      : 'npc'
  const rig: MiningReprocessRig =
    hull === 'npc' ? 'none' : facility?.rig === 't1' || facility?.rig === 't2' ? facility.rig : 'none'
  const space: MiningReprocessSpace =
    facility?.space === 'lowsec' || facility?.space === 'nullsec' ? facility.space : 'highsec'
  return { hull, rig, space }
}

export function miningReprocessRigTypeId(
  hull: MiningReprocessHull,
  subtype: MiningSubtype,
  rig: Exclude<MiningReprocessRig, 'none'>,
): number {
  if (hull === 'athanor') {
    if (subtype === 'ice') return RIG_TYPE_IDS.ice[rig]
    if (subtype === 'moon') return RIG_TYPE_IDS.moon[rig]
    return RIG_TYPE_IDS.asteroid[rig]
  }
  return RIG_TYPE_IDS.lSet[rig]
}

export function miningReprocessRigLabel(
  hull: MiningReprocessHull,
  subtype: MiningSubtype,
): string {
  if (hull === 'athanor') {
    if (subtype === 'ice') return 'Ice Grading Processor'
    if (subtype === 'moon') return 'Moon Ore Grading Processor'
    return 'Asteroid Ore Grading Processor'
  }
  if (hull === 'tatara') return 'L-Set Reprocessing Monitor'
  return 'Reprocessing Monitor'
}

/** EVE Uni: (50 + Rm) × (1 + Sec) × (1 + Sm) / 100. Sec only if a rig is fitted. */
export function reprocessStructureBase(
  facility?: Partial<MiningReprocessFacility> | null,
): number {
  const next = normalizeMiningReprocessFacility(facility)
  if (next.hull === 'npc') return NPC_STATION_YIELD
  const rm = next.rig === 't2' ? 3 : next.rig === 't1' ? 1 : 0
  const sec =
    rm === 0 ? 0 : next.space === 'nullsec' ? 0.12 : next.space === 'lowsec' ? 0.06 : 0
  const sm = next.hull === 'tatara' ? 0.055 : next.hull === 'athanor' ? 0.02 : 0
  return ((50 + rm) * (1 + sec) * (1 + sm)) / 100
}

const SIMPLE_ORE_GROUPS = new Set([
  'Veldspar',
  'Scordite',
  'Pyroxeres',
  'Plagioclase',
  'Mordunium',
])

const COHERENT_ORE_GROUPS = new Set([
  'Omber',
  'Kernite',
  'Jaspet',
  'Hemorphite',
  'Hedbergite',
  'Ytirium',
  'Griemeer',
  'Nocxite',
])

const VARIEGATED_ORE_GROUPS = new Set(['Gneiss', 'Dark Ochre', 'Crokite', 'Kylixium'])

const COMPLEX_ORE_GROUPS = new Set([
  'Arkonor',
  'Bistot',
  'Spodumain',
  'Eifyrium',
  'Ducinium',
  'Hezorime',
  'Ueganite',
])

const MERCOXIT_ORE_GROUPS = new Set(['Mercoxit'])
const ABYSSAL_ORE_GROUPS = new Set(['Bezdnacine', 'Rakovene', 'Talassonite'])
const ERRATIC_ORE_GROUPS = new Set(['Prismaticite'])

const MOON_GROUP_TO_SKILL: Record<string, SkillFieldDef['key']> = {
  'Ubiquitous Moon Asteroids': 'ubiquitousMoonOreProcessing',
  'Common Moon Asteroids': 'commonMoonOreProcessing',
  'Uncommon Moon Asteroids': 'uncommonMoonOreProcessing',
  'Rare Moon Asteroids': 'rareMoonOreProcessing',
  'Exceptional Moon Asteroids': 'exceptionalMoonOreProcessing',
}

/** Core reprocessing skills always shown on the mining page (non-gas). */
export const REPROCESS_CORE_SKILL_KEYS: SkillFieldDef['key'][] = [
  'reprocessing',
  'reprocessingEfficiency',
]

/** Group processing skills by mining subtype (shown alongside core skills). */
export const REPROCESS_GROUP_SKILL_KEYS: Record<
  Exclude<MiningSubtype, 'gas'>,
  SkillFieldDef['key'][]
> = {
  ore: [
    'simpleOreProcessing',
    'coherentOreProcessing',
    'variegatedOreProcessing',
    'complexOreProcessing',
    'mercoxitOreProcessing',
    'abyssalOreProcessing',
    'erraticOreProcessing',
  ],
  moon: [
    'ubiquitousMoonOreProcessing',
    'commonMoonOreProcessing',
    'uncommonMoonOreProcessing',
    'rareMoonOreProcessing',
    'exceptionalMoonOreProcessing',
  ],
  ice: ['iceProcessing'],
}

export function reprocessSkillKeysForSubtype(
  subtype: MiningSubtype,
): SkillFieldDef['key'][] {
  if (subtype === 'gas') return []
  return [...REPROCESS_CORE_SKILL_KEYS, ...REPROCESS_GROUP_SKILL_KEYS[subtype]]
}

const REPROCESS_GROUP_LABEL: Record<Exclude<MiningSubtype, 'gas'>, string> = {
  ore: 'Ore',
  moon: 'Moon',
  ice: 'Ice',
}

/** Skill groups for the mining page reprocess collapsible (matches fleet skill layout). */
export function reprocessSkillGroupsForSubtype(
  subtype: MiningSubtype,
): { label: string; keys: SkillFieldDef['key'][] }[] {
  if (subtype === 'gas') return []
  return [
    { label: 'Core', keys: REPROCESS_CORE_SKILL_KEYS },
    { label: REPROCESS_GROUP_LABEL[subtype], keys: REPROCESS_GROUP_SKILL_KEYS[subtype] },
  ]
}

export function reprocessGroupSkillKey(
  group: string,
  subtype: MiningSubtype,
): SkillFieldDef['key'] | null {
  if (subtype === 'ice' && group === 'Ice') return 'iceProcessing'
  if (subtype === 'moon') return MOON_GROUP_TO_SKILL[group] ?? null
  if (subtype !== 'ore') return null
  if (SIMPLE_ORE_GROUPS.has(group)) return 'simpleOreProcessing'
  if (COHERENT_ORE_GROUPS.has(group)) return 'coherentOreProcessing'
  if (VARIEGATED_ORE_GROUPS.has(group)) return 'variegatedOreProcessing'
  if (COMPLEX_ORE_GROUPS.has(group)) return 'complexOreProcessing'
  if (MERCOXIT_ORE_GROUPS.has(group)) return 'mercoxitOreProcessing'
  if (ABYSSAL_ORE_GROUPS.has(group)) return 'abyssalOreProcessing'
  if (ERRATIC_ORE_GROUPS.has(group)) return 'erraticOreProcessing'
  return null
}

/** NPC station base × Reprocessing × Efficiency × matching group skill. */
export function reprocessCoreYield(
  skills: Partial<SkillLevels> | undefined,
  structureBase = NPC_STATION_YIELD,
): number {
  const reprocessing = skillLevel(skills, 'reprocessing')
  const efficiency = skillLevel(skills, 'reprocessingEfficiency')
  return structureBase * (1 + 0.03 * reprocessing) * (1 + 0.02 * efficiency)
}

function reprocessMaxGroupMultiplier(
  subtype: Exclude<MiningSubtype, 'gas'>,
  skills: Partial<SkillLevels> | undefined,
): number {
  let max = 1
  for (const key of REPROCESS_GROUP_SKILL_KEYS[subtype]) {
    max = Math.max(max, 1 + 0.02 * skillLevel(skills, key))
  }
  return max
}

/** Core and best-case group yield for the current subtype skills. */
export function reprocessYieldStatusForSubtype(
  subtype: MiningSubtype,
  skills: Partial<SkillLevels> | undefined,
  facility?: Partial<MiningReprocessFacility> | null,
): { core: number; max: number } | null {
  if (subtype === 'gas') return null
  const core = reprocessCoreYield(skills, reprocessStructureBase(facility))
  const max = core * reprocessMaxGroupMultiplier(subtype, skills)
  return { core, max }
}

/** Human-readable refine yield for the mining page header. */
export function formatReprocessYieldStatus(
  subtype: MiningSubtype,
  skills: Partial<SkillLevels> | undefined,
  facility?: Partial<MiningReprocessFacility> | null,
): string | null {
  const status = reprocessYieldStatusForSubtype(subtype, skills, facility)
  if (!status) return null

  const corePct = Math.round(status.core * 1000) / 10
  const maxPct = Math.round(status.max * 1000) / 10
  if (Math.abs(maxPct - corePct) < 0.05) {
    return `${corePct}% refine`
  }
  return `${corePct}–${maxPct}% refine`
}

export function reprocessYieldForItem(
  item: MiningItem,
  skills: Partial<SkillLevels> | undefined,
  structureBase = NPC_STATION_YIELD,
): number {
  const reprocessing = skillLevel(skills, 'reprocessing')
  const efficiency = skillLevel(skills, 'reprocessingEfficiency')
  let yieldFactor =
    structureBase * (1 + 0.03 * reprocessing) * (1 + 0.02 * efficiency)
  const groupKey = reprocessGroupSkillKey(item.group, item.subtype)
  if (groupKey) {
    yieldFactor *= 1 + 0.02 * skillLevel(skills, groupKey)
  }
  return yieldFactor
}
