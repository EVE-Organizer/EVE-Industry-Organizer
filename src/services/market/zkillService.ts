import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'

import {

  batchProcess,

  dedupe,

  noteEsiResponse,

  throttle,

  throttleZkill,

} from '@/services/market/requestQueue'



const ZKILL_BASE = 'https://zkillboard.com/api'

const ESI_BASE = 'https://esi.evetech.net/latest'

const USER_AGENT = 'EVE-Industry-Organizer/1.0 (frontend haul camp check)'



const CAMP_PAST_SECONDS = 7200

/** Enough to classify camp (Likely at 2+); fewer ESI calls than checking 20 kills. */

const MAX_HAULER_CHECKS = 8

const HAULER_CAMP_THRESHOLD = 2

/** zKill caps system kill lists at ~200 entries per request. */
const MAX_WAR_REFS_PER_SYSTEM = 200

const ESI_BATCH_SIZE = 4

const ZKILL_BATCH_SIZE = 4



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



interface EsiKillmail {

  killmail_time?: string

  victim: {

    ship_type_id: number

    character_id?: number

    corporation_id?: number

    alliance_id?: number

  }

  attackers?: { character_id?: number; ship_type_id?: number }[]

}



export interface KillmailDetails {

  shipTypeId: number

  killmailTime: string | null

  attackerCount: number

  victimCorpId: number | null

  victimAllianceId: number | null

}



function zkillSystemKey(systemId: number, pastSeconds: number): string {

  return cacheKey('zkill', 'systemKills', { systemId, pastSeconds })

}



function esiKillmailKey(killmailId: number, hash: string): string {

  return cacheKey('esi', 'killmail', { killmailId, hash })

}



function warRefsCacheKey(systemId: number, pastSeconds: number): string {

  return cacheKey('zkill', 'warRefs', { systemId, pastSeconds })

}



function routeHaulerBatchKey(systemIds: number[]): string {

  return cacheKey('zkill', 'routeHaulerBatch', { systemIds })

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



export async function getWarKillRefsForSystems(

  systemIds: number[],

  pastSeconds: number,

): Promise<Map<number, ZkillKillRef[]>> {

  return getWarKillRefsForSystemsWithPast(

    systemIds.map((systemId) => ({ systemId, pastSeconds })),

  )

}



export async function getWarKillRefsForSystemsWithPast(

  requests: { systemId: number; pastSeconds: number }[],

  onProgress?: (completed: number, total: number) => void,

): Promise<Map<number, ZkillKillRef[]>> {

  const result = new Map<number, ZkillKillRef[]>()

  const total = requests.length

  let completed = 0

  onProgress?.(completed, total)



  const pending: { systemId: number; pastSeconds: number }[] = []

  for (const request of requests) {

    const key = warRefsCacheKey(request.systemId, request.pastSeconds)

    const cached = getCached<ZkillKillRef[]>(key)

    if (cached && !cached.stale) {

      result.set(request.systemId, sanitizeKillRefs(cached.data))

      completed++

      onProgress?.(completed, total)

      continue

    }

    pending.push(request)

  }



  await batchProcess(

    pending,

    ZKILL_BATCH_SIZE,

    80,

    async ({ systemId, pastSeconds }) => {

      const refs = await getSystemWarKillRefs(systemId, pastSeconds)

      result.set(systemId, refs)

      completed++

      onProgress?.(completed, total)

    },

    throttleZkill,

  )

  return result

}



async function fetchSystemKillRefs(systemId: number, pastSeconds: number): Promise<ZkillKillRef[]> {

  await throttleZkill()

  const url = `${ZKILL_BASE}/kills/systemID/${systemId}/pastSeconds/${pastSeconds}/`

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

  if (!res.ok) throw new Error(`zKill system kills failed: ${res.status}`)

  const rows = (await res.json()) as (ZkillKillRef | null)[]

  return sanitizeKillRefs(Array.isArray(rows) ? rows : [])

}



function normalizeCachedDetails(

  data: KillmailDetails | number | undefined,

): KillmailDetails | null {

  if (data == null) return null

  if (typeof data === 'number') {

    return {

      shipTypeId: data,

      killmailTime: null,

      attackerCount: 0,

      victimCorpId: null,

      victimAllianceId: null,

    }

  }

  return data

}



/** Read killmail details from localStorage only (no network). */
export function getCachedKillmailDetails(
  killmailId: number,
  hash: string,
): KillmailDetails | null {
  const esiCached = getCached<KillmailDetails | number>(esiKillmailKey(killmailId, hash))
  if (esiCached) {
    const details = normalizeCachedDetails(esiCached.data)
    if (details) return details
  }
  const zkillCached = getCached<KillmailDetails>(zkillKillDetailKey(killmailId))
  if (zkillCached) return zkillCached.data
  return null
}



function zkillKillDetailKey(killmailId: number): string {

  return cacheKey('zkill', 'killDetail', { killmailId })

}



interface ZkillKillIdResponse {

  killmail_time?: string

  attackers?: unknown[]

  victim?: {

    ship_type_id?: number

    corporation_id?: number

    alliance_id?: number

  }

}



async function fetchKillmailDetailsFromZkill(killmailId: number): Promise<KillmailDetails | null> {

  const key = zkillKillDetailKey(killmailId)

  const cached = getCached<KillmailDetails>(key)

  if (cached && !cached.stale) return cached.data



  try {

    await throttleZkill()

    const res = await fetch(`${ZKILL_BASE}/killID/${killmailId}/`, {

      headers: { 'User-Agent': USER_AGENT },

    })

    if (!res.ok) return null

    const data = (await res.json()) as ZkillKillIdResponse

    const shipTypeId = data.victim?.ship_type_id

    if (shipTypeId == null) return null

    const details: KillmailDetails = {

      shipTypeId,

      killmailTime: data.killmail_time ?? null,

      attackerCount: Array.isArray(data.attackers) ? data.attackers.length : 0,

      victimCorpId: data.victim?.corporation_id ?? null,

      victimAllianceId: data.victim?.alliance_id ?? null,

    }

    setCached(key, details, 'zkill', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)

    return details

  } catch {

    return null

  }

}



async function fetchKillmailDetailsFromNetwork(

  killmailId: number,

  hash: string,

): Promise<KillmailDetails | null> {

  const key = esiKillmailKey(killmailId, hash)

  const stale = getCached<KillmailDetails | number>(key)



  const fromZkill = await fetchKillmailDetailsFromZkill(killmailId)

  if (fromZkill) {

    setCached(key, fromZkill, 'esi', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)

    return fromZkill

  }



  try {

    await throttle()

    const res = await fetch(`${ESI_BASE}/killmails/${killmailId}/${hash}/`, {

      headers: { 'User-Agent': USER_AGENT },

    })

    noteEsiResponse(res)

    if (!res.ok) throw new Error(`killmail failed: ${res.status}`)

    const data = (await res.json()) as EsiKillmail

    const shipTypeId = data.victim?.ship_type_id

    if (shipTypeId == null) {

      return normalizeCachedDetails(stale?.data)

    }

    const details: KillmailDetails = {

      shipTypeId,

      killmailTime: data.killmail_time ?? null,

      attackerCount: Array.isArray(data.attackers) ? data.attackers.length : 0,

      victimCorpId: data.victim?.corporation_id ?? null,

      victimAllianceId: data.victim?.alliance_id ?? null,

    }

    setCached(key, details, 'esi', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)

    return details

  } catch {

    return normalizeCachedDetails(stale?.data)

  }

}



async function fetchKillmailDetails(

  killmailId: number,

  hash: string,

): Promise<KillmailDetails | null> {

  const key = esiKillmailKey(killmailId, hash)

  const cached = getCached<KillmailDetails | number>(key)

  if (cached && !cached.stale) {

    return normalizeCachedDetails(cached.data)

  }



  const zkillCached = getCached<KillmailDetails>(zkillKillDetailKey(killmailId))

  if (zkillCached && !zkillCached.stale) {

    const details = zkillCached.data

    setCached(key, details, 'esi', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)

    return details

  }



  if (cached?.stale) {

    void dedupe(key, () => fetchKillmailDetailsFromNetwork(killmailId, hash)).catch(() => {})

    return normalizeCachedDetails(cached.data)

  }



  return dedupe(key, () => fetchKillmailDetailsFromNetwork(killmailId, hash))

}



async function fetchKillmailShipType(killmailId: number, hash: string): Promise<number | null> {

  const details = await fetchKillmailDetails(killmailId, hash)

  return details?.shipTypeId ?? null

}



/** Enrich war kill refs with ESI ship/time for BR-style summaries. */

export async function enrichWarKillDetails(

  kills: { killmailId: number; hash: string }[],

  onProgress?: (completed: number, total: number) => void,

): Promise<Map<number, KillmailDetails>> {

  const result = new Map<number, KillmailDetails>()

  const pending: { killmailId: number; hash: string }[] = []

  for (const kill of kills) {

    const key = esiKillmailKey(kill.killmailId, kill.hash)

    const cached = getCached<KillmailDetails | number>(key)

    if (cached && !cached.stale) {

      const details = normalizeCachedDetails(cached.data)

      if (details) result.set(kill.killmailId, details)

      continue

    }

    pending.push(kill)

  }



  const total = kills.length

  let completed = kills.length - pending.length

  onProgress?.(completed, total)



  await Promise.all(

    pending.map(async (kill) => {

      const details = await fetchKillmailDetails(kill.killmailId, kill.hash)

      if (details) result.set(kill.killmailId, details)

      completed++

      onProgress?.(completed, total)

    }),

  )

  return result

}



async function countHaulerKillsFromRefs(

  refs: ZkillKillRef[],

  haulerTypeIds: Set<number>,

): Promise<number> {

  const playerRefs = sanitizeKillRefs(refs).filter((r) => !r.zkb.npc).slice(0, MAX_HAULER_CHECKS)

  let haulerKills = 0



  for (let i = 0; i < playerRefs.length; i += ESI_BATCH_SIZE) {

    const batch = playerRefs.slice(i, i + ESI_BATCH_SIZE)

    const shipTypes = await Promise.all(

      batch.map((ref) => fetchKillmailShipType(ref.killmail_id, ref.zkb.hash)),

    )

    for (const shipTypeId of shipTypes) {

      if (shipTypeId !== null && haulerTypeIds.has(shipTypeId)) {

        haulerKills++

      }

    }

    if (haulerKills >= HAULER_CAMP_THRESHOLD) break

  }

  return haulerKills

}



async function computeSystemHaulerKillCount(

  systemId: number,

  haulerTypeIds: Set<number>,

  pastSeconds: number,

): Promise<number> {

  const refs = await getSystemWarKillRefs(systemId, pastSeconds)

  return countHaulerKillsFromRefs(refs, haulerTypeIds)

}



export async function getSystemHaulerKillCount(

  systemId: number,

  haulerTypeIds: Set<number>,

  pastSeconds = CAMP_PAST_SECONDS,

): Promise<number> {

  const key = zkillSystemKey(systemId, pastSeconds)

  const cached = getCached<number>(key)

  if (cached && !cached.stale) return cached.data



  if (cached?.stale) {

    void dedupe(key, async () => {

      try {

        const count = await computeSystemHaulerKillCount(systemId, haulerTypeIds, pastSeconds)

        setCached(key, count, 'zkill', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)

        return count

      } catch {

        return cached.data

      }

    }).catch(() => {})

    return cached.data

  }



  return dedupe(key, async () => {

    const latest = getCached<number>(key)

    if (latest && !latest.stale) return latest.data

    try {

      const haulerKills = await computeSystemHaulerKillCount(systemId, haulerTypeIds, pastSeconds)

      setCached(key, haulerKills, 'zkill', TTL.zkillCamp.fresh, TTL.zkillCamp.stale)

      return haulerKills

    } catch {

      return latest?.data ?? 0

    }

  })

}



export async function getRouteHaulerKillCounts(

  systemIds: number[],

  haulerTypeIds: Set<number>,

): Promise<Map<number, number>> {

  if (systemIds.length === 0) return new Map()



  const sortedIds = [...systemIds].sort((a, b) => a - b)

  const batchKey = routeHaulerBatchKey(sortedIds)



  return dedupe(batchKey, async () => {

    const counts = new Map<number, number>()

    await batchProcess(

      sortedIds,

      ZKILL_BATCH_SIZE,

      80,

      async (systemId) => {

        const count = await getSystemHaulerKillCount(systemId, haulerTypeIds)

        counts.set(systemId, count)

      },

      throttleZkill,

    )

    return counts

  })

}



// --- zKill related report (battle report window) ---



export interface ZkillRelatedPilot {

  characterId: number

  characterName: string

  corporationId: number

  corporationName: string

  corpTicker: string | null

  allianceId: number | null

  allianceName: string | null

  allianceTicker: string | null

  shipTypeId: number

  shipName: string

  groupName: string

  finalBlow: boolean

}



export interface ZkillRelatedKillRow {

  killmailId: number

  hash: string

  killmailTime: string

  systemId: number

  systemName: string

  victimCharacterName: string

  victimCorpId: number | null

  victimCorpName: string

  victimCorpTicker: string | null

  victimAllianceName: string | null

  victimAllianceTicker: string | null

  shipTypeId: number

  shipName: string

  groupName: string

  totalValue: number

  points: number

  attackerCount: number

  solo: boolean

  npc: boolean

  zkillUrl: string

}



export interface ZkillRelatedTeam {

  pilots: ZkillRelatedPilot[]

  killCount: number

  iskDestroyed: number

  points: number

}



export interface ZkillRelatedReport {

  systemId: number

  systemName: string

  regionName: string

  timeLabel: string

  relatedTime: number

  windowHours: number

  complete: boolean

  teamA: ZkillRelatedTeam

  teamB: ZkillRelatedTeam

  kills: ZkillRelatedKillRow[]

  relatedUrl: string

}



interface ZkillRelatedApiPilot {

  characterID?: number

  characterName?: string

  corporationID?: number

  corporationName?: string

  cticker?: string

  allianceID?: number

  allianceName?: string

  aticker?: string

  shipTypeID?: number

  shipName?: string

  groupName?: string

  finalBlow?: boolean

}



interface ZkillRelatedApiKill {

  killID?: number

  attackerCount?: number

  solo?: boolean

  npc?: boolean

  dttm?: { $date?: { $numberLong?: string } }

  victim?: ZkillRelatedApiPilot

  system?: { solarSystemID?: number; solarSystemName?: string }

  zkb?: { hash?: string; totalValue?: number; points?: number }

}



interface ZkillRelatedApiTeam {

  list?: ZkillRelatedApiPilot[]

  kills?: Record<string, ZkillRelatedApiKill>

  totals?: { total_price?: number; total_points?: number; totalShips?: number }

}



interface ZkillRelatedApiResponse {

  systemID?: number

  solarSystemID?: number

  systemName?: string

  regionName?: string

  time?: string

  relatedTime?: number

  exHours?: number

  complete?: boolean

  summary?: { teamA?: ZkillRelatedApiTeam; teamB?: ZkillRelatedApiTeam }

}



function zkillRelatedCacheKey(systemId: number, relatedTime: number): string {

  return cacheKey('zkill', 'related', { systemId, relatedTime })

}



function zkillRelatedWebUrl(systemId: number, relatedTime: number): string {

  return `https://zkillboard.com/related/${systemId}/${relatedTime}/`

}



function parseZkillDttm(dttm: ZkillRelatedApiKill['dttm']): string | null {

  const ms = dttm?.$date?.$numberLong

  if (!ms) return null

  const n = Number(ms)

  if (Number.isNaN(n)) return null

  return new Date(n).toISOString()

}



function parsePilot(row: ZkillRelatedApiPilot): ZkillRelatedPilot | null {

  if (row.characterID == null || row.shipTypeID == null) return null

  return {

    characterId: row.characterID,

    characterName: row.characterName ?? 'Unknown',

    corporationId: row.corporationID ?? 0,

    corporationName: row.corporationName ?? 'Unknown',

    corpTicker: row.cticker ?? null,

    allianceId: row.allianceID ?? null,

    allianceName: row.allianceName ?? null,

    allianceTicker: row.aticker ?? null,

    shipTypeId: row.shipTypeID,

    shipName: row.shipName ?? 'Unknown',

    groupName: row.groupName ?? '',

    finalBlow: row.finalBlow === true,

  }

}



function parseTeam(team: ZkillRelatedApiTeam | undefined): ZkillRelatedTeam {

  const pilots = (team?.list ?? [])

    .map(parsePilot)

    .filter((p): p is ZkillRelatedPilot => p !== null)

  const totals = team?.totals

  return {

    pilots,

    killCount: totals?.totalShips ?? Object.keys(team?.kills ?? {}).length,

    iskDestroyed: totals?.total_price ?? 0,

    points: totals?.total_points ?? 0,

  }

}



function parseKillRow(kill: ZkillRelatedApiKill): ZkillRelatedKillRow | null {

  const killmailId = kill.killID

  const hash = kill.zkb?.hash

  const victim = kill.victim

  if (killmailId == null || !hash || victim?.shipTypeID == null) return null

  const killmailTime = parseZkillDttm(kill.dttm)

  if (!killmailTime) return null

  return {

    killmailId,

    hash,

    killmailTime,

    systemId: kill.system?.solarSystemID ?? 0,

    systemName: kill.system?.solarSystemName ?? 'Unknown',

    victimCharacterName: victim.characterName ?? 'Unknown',

    victimCorpId: victim.corporationID ?? null,

    victimCorpName: victim.corporationName ?? 'Unknown',

    victimCorpTicker: victim.cticker ?? null,

    victimAllianceName: victim.allianceName ?? null,

    victimAllianceTicker: victim.aticker ?? null,

    shipTypeId: victim.shipTypeID,

    shipName: victim.shipName ?? 'Unknown',

    groupName: victim.groupName ?? '',

    totalValue: kill.zkb?.totalValue ?? 0,

    points: kill.zkb?.points ?? 0,

    attackerCount: kill.attackerCount ?? 0,

    solo: kill.solo === true,

    npc: kill.npc === true,

    zkillUrl: `https://zkillboard.com/kill/${killmailId}/`,

  }

}



function collectKills(summary: ZkillRelatedApiResponse['summary']): ZkillRelatedKillRow[] {

  const raw: ZkillRelatedApiKill[] = []

  for (const team of [summary?.teamA, summary?.teamB]) {

    if (!team?.kills) continue

    raw.push(...Object.values(team.kills))

  }

  return raw

    .map(parseKillRow)

    .filter((k): k is ZkillRelatedKillRow => k !== null)

    .sort((a, b) => b.killmailTime.localeCompare(a.killmailTime))

}



function parseRelatedResponse(

  data: ZkillRelatedApiResponse,

  systemId: number,

  relatedTime: number,

): ZkillRelatedReport {

  const resolvedSystemId = data.solarSystemID ?? data.systemID ?? systemId

  return {

    systemId: resolvedSystemId,

    systemName: data.systemName ?? 'Unknown',

    regionName: data.regionName ?? '',

    timeLabel: data.time ?? String(relatedTime),

    relatedTime: data.relatedTime ?? relatedTime,

    windowHours: data.exHours ?? 1,

    complete: data.complete !== false,

    teamA: parseTeam(data.summary?.teamA),

    teamB: parseTeam(data.summary?.teamB),

    kills: collectKills(data.summary),

    relatedUrl: zkillRelatedWebUrl(resolvedSystemId, data.relatedTime ?? relatedTime),

  }

}



async function fetchZkillRelatedRaw(

  systemId: number,

  relatedTime: number,

): Promise<ZkillRelatedApiResponse> {

  await throttleZkill()

  const url = `${ZKILL_BASE}/related/${systemId}/${relatedTime}/`

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

  if (!res.ok) throw new Error(`zKill related failed: ${res.status}`)

  return (await res.json()) as ZkillRelatedApiResponse

}



const RELATED_POLL_MS = 600



async function fetchZkillRelatedReport(

  systemId: number,

  relatedTime: number,

): Promise<ZkillRelatedReport> {

  const first = await fetchZkillRelatedRaw(systemId, relatedTime)

  const firstReport = parseRelatedResponse(first, systemId, relatedTime)

  if (first.complete !== false || firstReport.kills.length > 0) {

    return firstReport

  }



  await new Promise((r) => setTimeout(r, RELATED_POLL_MS))

  const second = await fetchZkillRelatedRaw(systemId, relatedTime)

  return parseRelatedResponse(

    second.complete !== false ? second : first,

    systemId,

    relatedTime,

  )

}



export async function getZkillRelatedReport(

  systemId: number,

  relatedTime: number,

): Promise<ZkillRelatedReport> {

  const key = zkillRelatedCacheKey(systemId, relatedTime)

  const cached = getCached<ZkillRelatedReport>(key)

  if (cached && !cached.stale) return cached.data



  if (cached?.stale) {

    void dedupe(key, () => fetchZkillRelatedReport(systemId, relatedTime)).catch(() => {})

    return cached.data

  }



  return dedupe(key, () => fetchZkillRelatedReport(systemId, relatedTime))

}


