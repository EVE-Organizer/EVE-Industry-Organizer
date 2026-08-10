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
import { getSystemWarKillRefs, type ZkillKillRef } from '@/services/market/zkillService'

const ZKILL_BASE = 'https://zkillboard.com/api'
const ESI_BASE = 'https://esi.evetech.net/latest'
const USER_AGENT = 'EVE-Industry-Organizer/1.0 (frontend gate intel)'

export const GATE_INTEL_PAST_SECONDS = 3600
const MAX_GATE_DETAIL_CHECKS = 12
const ZKILL_BATCH_SIZE = 4

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

function routeGateIntelBatchKey(systemIds: number[]): string {
  return cacheKey('zkill', 'routeGateIntelBatch', { systemIds })
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
  return !attackers.some(
    (a) =>
      (a.weaponTypeId != null && lookup.smartBombTypeIds.has(a.weaponTypeId)) ||
      (a.shipTypeId != null &&
        (lookup.interdictorTypeIds.has(a.shipTypeId) || lookup.hicTypeIds.has(a.shipTypeId))),
  )
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

export async function getRouteGateIntel(
  systemIds: number[],
  lookup: GateIntelLookup,
): Promise<Map<number, SystemGateIntel>> {
  if (systemIds.length === 0) return new Map()

  const sortedIds = [...new Set(systemIds)].sort((a, b) => a - b)
  const batchKey = routeGateIntelBatchKey(sortedIds)

  return dedupe(batchKey, async () => {
    const intelBySystem = new Map<number, SystemGateIntel>()
    await batchProcess(
      sortedIds,
      ZKILL_BATCH_SIZE,
      80,
      async (systemId) => {
        const intel = await getSystemGateIntel(systemId, lookup)
        intelBySystem.set(systemId, intel)
      },
      throttleZkill,
    )
    return intelBySystem
  })
}
