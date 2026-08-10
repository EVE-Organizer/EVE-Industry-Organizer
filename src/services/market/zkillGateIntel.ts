import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'
import {
  classifySystemGateIntel,
  emptySystemGateIntel,
  type GateKillInput,
  type SystemGateIntel,
} from '@/lib/gateIntel'
import type { GateIntelLookup } from '@/services/data/gateIntelLoader'
import {
  batchProcess,
  dedupe,
  noteEsiResponse,
  throttle,
  throttleZkill,
} from '@/services/market/requestQueue'
import { shouldCheckCamp } from '@/lib/routeCamp'
import { getSystemWarKillRefs, type ZkillKillRef } from '@/services/market/zkillService'

const ZKILL_BASE = 'https://zkillboard.com/api'
const ESI_BASE = 'https://esi.evetech.net/latest'
const USER_AGENT = 'EVE-Industry-Organizer/1.0 (frontend gate intel)'

export const GATE_INTEL_PAST_SECONDS = 3600
const MAX_GATE_DETAIL_CHECKS = 4
const ZKILL_BATCH_SIZE = 8
const ZKILL_BATCH_DELAY_MS = 0

interface ZkillAttackerRow {
  ship_type_id?: number
  weapon_type_id?: number
}

interface ZkillKillListRow extends ZkillKillRef {
  attackers?: ZkillAttackerRow[]
}

function zkillGateIntelKey(systemId: number): string {
  return cacheKey('zkill', 'gateIntel', { systemId, pastSeconds: GATE_INTEL_PAST_SECONDS })
}

function refLocationId(ref: ZkillKillListRow): number | null {
  const locationId = ref.zkb?.locationID
  return locationId != null && Number.isFinite(locationId) ? locationId : null
}

function refAttackers(ref: ZkillKillListRow): GateKillInput['attackers'] {
  if (!ref.attackers?.length) return undefined
  return ref.attackers.map((a) => ({
    shipTypeId: a.ship_type_id,
    weaponTypeId: a.weapon_type_id,
  }))
}

function refToGateKillInput(ref: ZkillKillListRow): GateKillInput {
  return {
    locationId: refLocationId(ref),
    attackers: refAttackers(ref),
  }
}

function needsAttackerDetail(ref: ZkillKillListRow, lookup: GateIntelLookup): boolean {
  const locationId = refLocationId(ref)
  if (locationId == null || !lookup.gatesByLocationId.has(locationId)) return false
  const attackers = refAttackers(ref)
  if (!attackers?.length) return true
  return attackers.every((a) => a.shipTypeId == null && a.weaponTypeId == null)
}

/** Skip zKill when highsec is quiet; still check lowsec, pipes, and active systems. */
export function shouldFetchGateIntel(
  systemId: number,
  security: number,
  shipKills24h: number,
): boolean {
  if (shouldCheckCamp(systemId, security)) return true
  return shipKills24h > 0
}

async function fetchKillmailAttackers(
  killmailId: number,
  hash: string,
): Promise<GateKillInput['attackers']> {
  const key = cacheKey('zkill', 'gateKillAttackers', { killmailId })
  const cached = getCached<GateKillInput['attackers']>(key)
  if (cached && !cached.stale) return cached.data

  try {
    await throttleZkill()
    const res = await fetch(`${ZKILL_BASE}/killID/${killmailId}/`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (res.ok) {
      const data = (await res.json()) as { attackers?: ZkillAttackerRow[] }
      const attackers =
        data.attackers?.map((a) => ({
          shipTypeId: a.ship_type_id,
          weaponTypeId: a.weapon_type_id,
        })) ?? []
      setCached(key, attackers, 'zkill', TTL.zkillGateIntel.fresh, TTL.zkillGateIntel.stale)
      return attackers
    }
  } catch {
    // fall through to ESI
  }

  try {
    await throttle()
    const res = await fetch(`${ESI_BASE}/killmails/${killmailId}/${hash}/`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    noteEsiResponse(res)
    if (!res.ok) return []
    const data = (await res.json()) as { attackers?: ZkillAttackerRow[] }
    const attackers =
      data.attackers?.map((a) => ({
        shipTypeId: a.ship_type_id,
        weaponTypeId: a.weapon_type_id,
      })) ?? []
    setCached(key, attackers, 'zkill', TTL.zkillGateIntel.fresh, TTL.zkillGateIntel.stale)
    return attackers
  } catch {
    return cached?.data ?? []
  }
}

async function buildGateKillInputs(
  refs: ZkillKillListRow[],
  lookup: GateIntelLookup,
): Promise<GateKillInput[]> {
  const inputs: GateKillInput[] = refs.map(refToGateKillInput)
  const detailCandidates = refs
    .map((ref, index) => ({ ref, index }))
    .filter(({ ref }) => needsAttackerDetail(ref, lookup))
    .slice(0, MAX_GATE_DETAIL_CHECKS)

  await batchProcess(
    detailCandidates,
    3,
    60,
    async ({ ref, index }) => {
      const attackers = await fetchKillmailAttackers(ref.killmail_id, ref.zkb.hash)
      inputs[index] = {
        locationId: refLocationId(ref),
        attackers,
      }
    },
    throttleZkill,
  )

  return inputs
}

async function computeSystemGateIntel(
  systemId: number,
  lookup: GateIntelLookup,
): Promise<SystemGateIntel> {
  const refs = (await getSystemWarKillRefs(systemId, GATE_INTEL_PAST_SECONDS)) as ZkillKillListRow[]
  if (!refs.length) return emptySystemGateIntel()
  const kills = await buildGateKillInputs(refs, lookup)
  return classifySystemGateIntel(systemId, kills, lookup)
}

export async function getSystemGateIntel(
  systemId: number,
  lookup: GateIntelLookup,
): Promise<SystemGateIntel> {
  const key = zkillGateIntelKey(systemId)
  const cached = getCached<SystemGateIntel>(key)
  if (cached && !cached.stale) return cached.data

  if (cached?.stale) {
    void dedupe(key, async () => {
      try {
        const intel = await computeSystemGateIntel(systemId, lookup)
        setCached(key, intel, 'zkill', TTL.zkillGateIntel.fresh, TTL.zkillGateIntel.stale)
        return intel
      } catch {
        return cached.data
      }
    }).catch(() => {})
    return cached.data
  }

  return dedupe(key, async () => {
    const latest = getCached<SystemGateIntel>(key)
    if (latest && !latest.stale) return latest.data
    try {
      const intel = await computeSystemGateIntel(systemId, lookup)
      setCached(key, intel, 'zkill', TTL.zkillGateIntel.fresh, TTL.zkillGateIntel.stale)
      return intel
    } catch {
      return latest?.data ?? emptySystemGateIntel()
    }
  })
}

export interface RouteGateIntelOptions {
  securities?: Map<number, number>
  shipKillsBySystem?: Map<number, number>
  onSystemIntel?: (systemId: number, intel: SystemGateIntel) => void
}

export async function getRouteGateIntel(
  systemIds: number[],
  lookup: GateIntelLookup,
  options: RouteGateIntelOptions = {},
): Promise<Map<number, SystemGateIntel>> {
  if (systemIds.length === 0) return new Map()

  const { securities, shipKillsBySystem, onSystemIntel } = options
  const sortedIds = [...new Set(systemIds)].sort((a, b) => a - b)
  const intelBySystem = new Map<number, SystemGateIntel>()
  const fetchIds: number[] = []

  for (const systemId of sortedIds) {
    const security = securities?.get(systemId) ?? 0
    const shipKills = shipKillsBySystem?.get(systemId) ?? 0
    if (!shouldFetchGateIntel(systemId, security, shipKills)) {
      const empty = emptySystemGateIntel()
      intelBySystem.set(systemId, empty)
      onSystemIntel?.(systemId, empty)
      continue
    }
    fetchIds.push(systemId)
  }

  await batchProcess(
    fetchIds,
    ZKILL_BATCH_SIZE,
    ZKILL_BATCH_DELAY_MS,
    async (systemId) => {
      const intel = await getSystemGateIntel(systemId, lookup)
      intelBySystem.set(systemId, intel)
      onSystemIntel?.(systemId, intel)
    },
    throttleZkill,
  )

  return intelBySystem
}
