import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'
import { dedupe, throttleZkill } from '@/services/market/requestQueue'

const ZKILL_BASE = 'https://zkillboard.com/api'
const USER_AGENT = 'EVE-Industry-Organizer/1.0 (frontend gate intel)'
const MAX_WAR_REFS_PER_SYSTEM = 200

export interface ZkillKillRef {
  killmail_id: number
  zkb: {
    hash: string
    locationID?: number
    npc?: boolean
    solo?: boolean
    totalValue?: number
  }
}

export function isValidKillRef(ref: ZkillKillRef | null | undefined): ref is ZkillKillRef {
  return ref != null && typeof ref.killmail_id === 'number' && Boolean(ref.zkb?.hash)
}

export function sanitizeKillRefs(refs: (ZkillKillRef | null | undefined)[]): ZkillKillRef[] {
  return refs.filter(isValidKillRef)
}

function warRefsCacheKey(systemId: number, pastSeconds: number): string {
  return cacheKey('zkill', 'warRefs', { systemId, pastSeconds })
}

async function fetchSystemKillRefs(systemId: number, pastSeconds: number): Promise<ZkillKillRef[]> {
  await throttleZkill()
  const url = `${ZKILL_BASE}/kills/systemID/${systemId}/pastSeconds/${pastSeconds}/`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`zKill system kills failed: ${res.status}`)
  const rows = (await res.json()) as (ZkillKillRef | null)[]
  return sanitizeKillRefs(Array.isArray(rows) ? rows : [])
}

export async function getSystemWarKillRefs(
  systemId: number,
  pastSeconds: number,
): Promise<ZkillKillRef[]> {
  const key = warRefsCacheKey(systemId, pastSeconds)
  const cached = getCached<ZkillKillRef[]>(key)
  if (cached && !cached.stale) return sanitizeKillRefs(cached.data)

  return dedupe(key, async () => {
    const latest = getCached<ZkillKillRef[]>(key)
    if (latest && !latest.stale) return sanitizeKillRefs(latest.data)
    try {
      const refs = await fetchSystemKillRefs(systemId, pastSeconds)
      const trimmed = refs.slice(0, MAX_WAR_REFS_PER_SYSTEM)
      setCached(key, trimmed, 'zkill', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)
      return trimmed
    } catch {
      return sanitizeKillRefs(latest?.data ?? [])
    }
  })
}
