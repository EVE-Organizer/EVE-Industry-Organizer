import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'
import { batchProcess, dedupe, throttle } from '@/services/market/requestQueue'

const ZKILL_BASE = 'https://zkillboard.com/api'
const ESI_BASE = 'https://esi.evetech.net/latest'
const USER_AGENT = 'EVE-Industry-Organizer/1.0 (frontend haul camp check)'

const CAMP_PAST_SECONDS = 7200
const MAX_KILLMAILS_PER_SYSTEM = 20

interface ZkillKillRef {
  killmail_id: number
  zkb: { hash: string; npc?: boolean }
}

interface EsiKillmail {
  victim: { ship_type_id: number }
}

function zkillSystemKey(systemId: number, pastSeconds: number): string {
  return cacheKey('zkill', 'systemKills', { systemId, pastSeconds })
}

function esiKillmailKey(killmailId: number, hash: string): string {
  return cacheKey('esi', 'killmail', { killmailId, hash })
}

async function fetchSystemKillRefs(systemId: number, pastSeconds: number): Promise<ZkillKillRef[]> {
  await throttle()
  const url = `${ZKILL_BASE}/kills/systemID/${systemId}/pastSeconds/${pastSeconds}/`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`zKill system kills failed: ${res.status}`)
  const rows = (await res.json()) as ZkillKillRef[]
  return Array.isArray(rows) ? rows : []
}

async function fetchKillmailShipType(killmailId: number, hash: string): Promise<number | null> {
  const key = esiKillmailKey(killmailId, hash)
  const cached = getCached<number>(key)
  if (cached && !cached.stale) return cached.data

  return dedupe(key, async () => {
    const stale = getCached<number>(key)
    try {
      await throttle()
      const res = await fetch(`${ESI_BASE}/killmails/${killmailId}/${hash}/`, {
        headers: { 'User-Agent': USER_AGENT },
      })
      if (!res.ok) throw new Error(`killmail failed: ${res.status}`)
      const data = (await res.json()) as EsiKillmail
      const shipTypeId = data.victim?.ship_type_id ?? null
      if (shipTypeId !== null) {
        setCached(key, shipTypeId, 'esi', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)
      }
      return shipTypeId
    } catch {
      return stale?.data ?? null
    }
  })
}

export async function getSystemHaulerKillCount(
  systemId: number,
  haulerTypeIds: Set<number>,
  pastSeconds = CAMP_PAST_SECONDS,
): Promise<number> {
  const key = zkillSystemKey(systemId, pastSeconds)

  return dedupe(key, async () => {
    const cached = getCached<number>(key)
    if (cached && !cached.stale) return cached.data

    try {
      const refs = await fetchSystemKillRefs(systemId, pastSeconds)
      const playerRefs = refs.filter((r) => !r.zkb?.npc).slice(0, MAX_KILLMAILS_PER_SYSTEM)

      const hits = await batchProcess(playerRefs, 3, 100, async (ref) => {
        const shipTypeId = await fetchKillmailShipType(ref.killmail_id, ref.zkb.hash)
        return shipTypeId !== null && haulerTypeIds.has(shipTypeId) ? 1 : 0
      })
      const haulerKills = hits.reduce<number>((sum, hit) => sum + hit, 0)

      setCached(key, haulerKills, 'zkill', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)
      return haulerKills
    } catch {
      return cached?.data ?? 0
    }
  })
}

export async function getRouteHaulerKillCounts(
  systemIds: number[],
  haulerTypeIds: Set<number>,
): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  await batchProcess(systemIds, 2, 200, async (systemId) => {
    const count = await getSystemHaulerKillCount(systemId, haulerTypeIds)
    counts.set(systemId, count)
  })
  return counts
}
