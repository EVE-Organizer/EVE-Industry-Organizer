import type { MiningSubtype, MiningBuffId, MiningShipId, MiningBoostSpace } from '@/types'
import { DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE } from '@/lib/miningIph'
import { MINING_SPACES } from '@/lib/miningIph'

export type { MiningShipId, MiningBuffId, MiningBoostSpace } from '@/types'

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
}

export type MiningBuffCategory = 'fit' | 'fleet'

export interface MiningBuffPreset {
  id: MiningBuffId
  label: string
  shortLabel: string
  multiplier: number
  category: MiningBuffCategory
  hint: string
  /** Which boost-space contexts show this buff (fleet buffs only). */
  boostSpaces?: readonly MiningBoostSpace[]
  applies: (
    ship: MiningShipPreset,
    subtype: MiningSubtype,
    boostSpace: MiningBoostSpace,
    activeBuffIds: readonly MiningBuffId[],
  ) => boolean
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

/** Reference m³/hr — @see https://wiki.eveuniversity.org/Mining_yield */
export const MINING_SHIPS: MiningShipPreset[] = [
  {
    id: 'retriever',
    label: 'Retriever',
    typeId: 17478,
    tier: 'barge',
    tech: 't1',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: 50_400, moon: 50_400, ice: 37_500 },
  },
  {
    id: 'covetor',
    label: 'Covetor',
    typeId: 17476,
    tier: 'barge',
    tech: 't1',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: 58_000, moon: 58_000, ice: 37_500 },
  },
  {
    id: 'procurer',
    label: 'Procurer',
    typeId: 17480,
    tier: 'barge',
    tech: 't1',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: 50_400, moon: 50_400, ice: 37_500 },
  },
  {
    id: 'hulk',
    label: 'Hulk',
    typeId: 22544,
    tier: 'exhumer',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: 87_000, moon: 87_000, ice: 42_000 },
  },
  {
    id: 'mackinaw',
    label: 'Mackinaw',
    typeId: 22548,
    tier: 'exhumer',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: 82_000, moon: 82_000, ice: 50_000 },
  },
  {
    id: 'skiff',
    label: 'Skiff',
    typeId: 22546,
    tier: 'exhumer',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice'],
    m3PerHrBySubtype: { ore: 75_000, moon: 75_000, ice: 45_000 },
  },
  {
    id: 'venture',
    label: 'Venture',
    typeId: 32880,
    tier: 'frigate',
    tech: 't1',
    subtypes: ['ore', 'moon', 'gas'],
    m3PerHrBySubtype: { ore: 15_000, moon: 15_000, gas: 2_400 },
  },
  {
    id: 'prospect',
    label: 'Prospect',
    typeId: 33697,
    tier: 'expedition',
    tech: 't2',
    subtypes: ['ore', 'moon', 'gas'],
    m3PerHrBySubtype: { ore: 18_000, moon: 18_000, gas: 3_000 },
  },
  {
    id: 'endurance',
    label: 'Endurance',
    typeId: 37135,
    tier: 'expedition',
    tech: 't2',
    subtypes: ['ore', 'moon', 'ice', 'gas'],
    m3PerHrBySubtype: { ore: 12_000, moon: 12_000, ice: 22_000, gas: 2_800 },
  },
]

/**
 * Typical mining buffs by space.
 * Fleet values: EVE Uni "normal" Orca/Rorqual with Mining Laser Optimization burst
 * (not perfect mindlink + T2 core max).
 * @see https://wiki.eveuniversity.org/Perfect_mining
 */
export const MINING_BUFFS: MiningBuffPreset[] = [
  {
    id: 'mlu3',
    label: '3× Mining Laser Upgrade I',
    shortLabel: '3× MLU I',
    multiplier: 1.167,
    category: 'fit',
    hint: 'Common T1 barge fit (EVE Uni Retriever: ~840 → ~980 m³/min). Exhumers usually fit MLU II instead.',
    applies: (ship, subtype) =>
      (ship.tier === 'barge' || ship.tier === 'exhumer') &&
      (subtype === 'ore' || subtype === 'moon'),
  },
  {
    id: 'highwall',
    label: 'Highwall Mining implant G5',
    shortLabel: 'Highwall G5',
    multiplier: 1.05,
    category: 'fit',
    hint: 'Inherent Implants "Highwall" Mining (+5% ore yield). Standard on ore/mining alts.',
    applies: (_ship, subtype) => subtype === 'ore' || subtype === 'moon',
  },
  {
    id: 'yeti',
    label: 'Yeti Ice Harvesting implant G5',
    shortLabel: 'Yeti G5',
    multiplier: 1.05,
    category: 'fit',
    hint: 'Inherent Implants "Yeti" Ice Harvesting (−5% ice harvester cycle time).',
    applies: (_ship, subtype) => subtype === 'ice',
  },
  {
    id: 'gasHarvesting',
    label: 'Gas Harvesting implant G5',
    shortLabel: 'Gas G5',
    multiplier: 1.05,
    category: 'fit',
    hint: 'Eifyr and Co. "Alchemist" Gas Harvesting (−5% gas harvester cycle time).',
    applies: (_ship, subtype) => subtype === 'gas',
  },
  {
    id: 'porpoiseBoost',
    label: 'Porpoise · Mining Laser Optimization',
    shortLabel: 'Porpoise boost',
    multiplier: 1.3,
    category: 'fleet',
    boostSpaces: ['highsec', 'lowsec', 'nullsec', 'wormhole'],
    hint: 'Weaker than Orca/Rorqual (~30% more yield). Common for small gangs, WH, and mobile ops.',
    applies: (_ship, _subtype, boostSpace) => boostSpace !== 'solo',
  },
  {
    id: 'orcaBoost',
    label: 'Orca · Mining Laser Optimization',
    shortLabel: 'Orca boost',
    multiplier: 1.38,
    category: 'fleet',
    boostSpaces: ['highsec'],
    hint: 'Mining Foreman burst from an Orca in highsec (~38% more ore yield; typical skills, no mindlink).',
    applies: (_ship, _subtype, boostSpace) => boostSpace === 'highsec',
  },
  {
    id: 'rorqualBoost',
    label: 'Rorqual · Mining Laser Optimization',
    shortLabel: 'Rorqual boost',
    multiplier: 1.58,
    category: 'fleet',
    boostSpaces: ['lowsec', 'nullsec', 'wormhole'],
    hint: 'Mining Foreman burst from a Rorqual (~58% more yield). Standard for moon, null, and WH mining.',
    applies: (_ship, _subtype, boostSpace) =>
      boostSpace === 'lowsec' || boostSpace === 'nullsec' || boostSpace === 'wormhole',
  },
  {
    id: 'mindlink',
    label: 'Mining Foreman Mindlink',
    shortLabel: 'Mindlink',
    multiplier: 1.1,
    category: 'fleet',
    hint: '+25% burst strength on the booster pilot. ~10% more yield on top of Orca/Rorqual burst.',
    applies: (_ship, _subtype, boostSpace, activeBuffIds) =>
      boostSpace !== 'solo' &&
      (activeBuffIds.includes('orcaBoost') ||
        activeBuffIds.includes('rorqualBoost') ||
        activeBuffIds.includes('porpoiseBoost')),
  },
]

export const FLEET_BURST_BUFF_IDS: readonly MiningBuffId[] = [
  'orcaBoost',
  'rorqualBoost',
  'porpoiseBoost',
]

export const DEFAULT_MINING_SHIP_ID: MiningShipId = 'retriever'
export const DEFAULT_MINING_BOOST_SPACE: MiningBoostSpace = 'highsec'

const SHIP_BY_ID = new Map(MINING_SHIPS.map((s) => [s.id, s]))
const BUFF_BY_ID = new Map(MINING_BUFFS.map((b) => [b.id, b]))

const VALID_BUFF_IDS = new Set<MiningBuffId>(MINING_BUFFS.map((b) => b.id))
const VALID_BOOST_SPACES = new Set<MiningBoostSpace>(MINING_BOOST_SPACES.map((s) => s.id))
const FLEET_BURST_SET = new Set<MiningBuffId>(FLEET_BURST_BUFF_IDS)

function pickFleetBurst(ids: readonly MiningBuffId[]): MiningBuffId | undefined {
  const bursts = ids.filter((id) => FLEET_BURST_SET.has(id))
  if (bursts.length === 0) return undefined
  if (bursts.length === 1) return bursts[0]
  return bursts.reduce((best, id) => {
    const bestMult = BUFF_BY_ID.get(best)?.multiplier ?? 1
    const idMult = BUFF_BY_ID.get(id)?.multiplier ?? 1
    return idMult > bestMult ? id : best
  })
}

function dedupeFleetBursts(ids: MiningBuffId[]): MiningBuffId[] {
  const keep = pickFleetBurst(ids)
  if (!keep) return ids
  return ids.filter((id) => !FLEET_BURST_SET.has(id) || id === keep)
}

/** Toggle a buff; fleet burst boosters are mutually exclusive. */
export function toggleMiningBuffId(
  buffIds: readonly MiningBuffId[],
  id: MiningBuffId,
): MiningBuffId[] {
  if (buffIds.includes(id)) return buffIds.filter((b) => b !== id)
  let next = [...buffIds, id]
  if (FLEET_BURST_SET.has(id)) {
    next = next.filter((b) => b === id || !FLEET_BURST_SET.has(b))
  }
  return next
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

/** Derive boost context from selected fleet buffs (no separate space picker needed). */
export function inferMiningBoostSpace(
  buffIds: readonly MiningBuffId[],
  fallback: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
): MiningBoostSpace {
  const ids = normalizeMiningBuffIds([...buffIds])
  if (ids.includes('orcaBoost')) return 'highsec'
  if (ids.includes('rorqualBoost')) {
    return fallback === 'solo' || fallback === 'highsec' ? 'nullsec' : fallback
  }
  if (ids.includes('porpoiseBoost')) {
    return fallback === 'solo' ? 'wormhole' : fallback
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
    return VALID_BUFF_IDS.has(id) ? [id] : []
  })
  return [...new Set(expanded)]
}

export function miningBuffApplies(
  buffId: MiningBuffId,
  ship: MiningShipPreset,
  subtype: MiningSubtype,
  boostSpace: MiningBoostSpace,
  activeBuffIds: readonly MiningBuffId[],
): boolean {
  const buff = BUFF_BY_ID.get(buffId)
  if (!buff) return false
  return buff.applies(ship, subtype, boostSpace, activeBuffIds)
}

export function applicableMiningBuffIds(
  shipId: MiningShipId | undefined,
  subtype: MiningSubtype,
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace,
): MiningBuffId[] {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const space = normalizeMiningBoostSpace(boostSpace)
  const normalized = dedupeFleetBursts(normalizeMiningBuffIds([...buffIds], space))
  return normalized.filter((id) => miningBuffApplies(id, ship, subtype, space, normalized))
}

export function miningBuffsForContext(
  shipId: MiningShipId | undefined,
  subtype: MiningSubtype,
  boostSpace: MiningBoostSpace,
  activeBuffIds: readonly MiningBuffId[],
): { fit: MiningBuffPreset[]; fleet: MiningBuffPreset[] } {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const space = normalizeMiningBoostSpace(boostSpace)
  const fit: MiningBuffPreset[] = []
  const fleet: MiningBuffPreset[] = []
  for (const buff of MINING_BUFFS) {
    if (!buff.applies(ship, subtype, space, activeBuffIds)) continue
    if (buff.category === 'fit') fit.push(buff)
    else if (space !== 'solo') fleet.push(buff)
  }
  return { fit, fleet }
}

/** All buffs to show in the setup UI (fit + fleet, no space grouping). */
export function miningBuffsForSetup(
  shipId: MiningShipId | undefined,
  subtype: MiningSubtype,
  activeBuffIds: readonly MiningBuffId[],
): MiningBuffPreset[] {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const result: MiningBuffPreset[] = []
  for (const buff of MINING_BUFFS) {
    if (buff.category === 'fit') {
      if (buff.applies(ship, subtype, 'solo', activeBuffIds)) result.push(buff)
      continue
    }
    if (buff.id === 'mindlink') {
      if (FLEET_BURST_BUFF_IDS.some((id) => activeBuffIds.includes(id))) result.push(buff)
      continue
    }
    result.push(buff)
  }
  return result
}

export function miningBuffMultiplier(buffIds: readonly MiningBuffId[]): number {
  let mult = 1
  for (const id of buffIds) {
    const buff = BUFF_BY_ID.get(id)
    if (buff) mult *= buff.multiplier
  }
  return mult
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

export function resolveUserMiningM3PerHr(
  subtype: MiningSubtype,
  shipId: MiningShipId | undefined,
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace = DEFAULT_MINING_BOOST_SPACE,
  fleetSize: number = DEFAULT_MINING_FLEET_SIZE,
): number {
  const ship = getMiningShip(normalizeMiningShipId(shipId, subtype))
  const base = ship.m3PerHrBySubtype[subtype] ?? DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE[subtype]
  const active = applicableMiningBuffIds(shipId, subtype, buffIds, boostSpace)
  const perShip = base * miningBuffMultiplier(active)
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
    .map((id) => BUFF_BY_ID.get(id)?.shortLabel)
    .filter(Boolean) as string[]
  const buffPart = buffLabels.length > 0 ? buffLabels.join(' + ') : 'Hull only'
  const fleet = normalizeMiningFleetSize(fleetSize)
  const fleetPart = fleet > 1 ? `${fleet}× ` : ''
  return `${fleetPart}${ship.label} · ${buffPart} · ${m3PerHr.toLocaleString()} m³/hr`
}

/** Clear fleet buffs that do not apply after a boost-space change. */
export function miningBuffIdsForBoostSpace(
  buffIds: readonly MiningBuffId[],
  boostSpace: MiningBoostSpace,
): MiningBuffId[] {
  const space = normalizeMiningBoostSpace(boostSpace)
  let normalized = normalizeMiningBuffIds([...buffIds], space)
  if (space === 'solo') {
    return normalized.filter((id) => BUFF_BY_ID.get(id)?.category === 'fit')
  }
  normalized = normalized.filter((id) => {
    const buff = BUFF_BY_ID.get(id)
    if (!buff) return false
    if (buff.category === 'fit') return true
    if (buff.id === 'mindlink') return false
    return buff.boostSpaces?.includes(space) ?? false
  })
  const hasFleetBurst = FLEET_BURST_BUFF_IDS.some((id) => normalized.includes(id))
  if (!hasFleetBurst) {
    return normalized.filter((id) => id !== 'mindlink')
  }
  return normalized
}
