import type { HubId } from '@/types'
import type { MapGraph, WarActivityResult, WarKillEvidence, WarTheater } from '@/types/map'
import { cacheKey, getCached } from '@/services/cache/cacheStore'
import { isValidKillRef, getCachedKillmailDetails, type KillmailDetails, type ZkillKillRef } from '@/services/market/zkillService'
import { classifyCampLevel } from '@/lib/routeCamp'
import { formatRelativeOffset } from '@/lib/liveTimelineAdapter'
import { jumpDistance } from '@/lib/nearestPublicHub'

export const WAR_MIN_FLEET_KILLS = 3
export const WAR_MIN_ISK_DESTROYED = 500_000_000
export const WAR_MIN_KILL_VALUE = 50_000_000
/** Connect war systems this many jumps apart into one theater. */
export const WAR_THEATER_MAX_JUMPS = 2
export const WAR_BR_CREATE_URL = 'https://br.evetools.org/create'
/** Top kills to enrich via ESI when a theater modal opens. */
export const WAR_ENRICH_PER_THEATER = 8
/** Skip gap refresh when cache is newer than this. */
export const WAR_INTEL_GAP_MIN_SECONDS = 60
/** zKill API returns at most ~200 kills per system request; keep full payload for merge/cache. */
export const WAR_STORE_MAX_REFS_PER_SYSTEM = 200

/** Compare enriched theater payloads to avoid redundant list/map updates. */
export function theaterEnrichmentSignature(theater: WarTheater): string {
  return theater.kills
    .slice(0, WAR_ENRICH_PER_THEATER)
    .map(
      (k) =>
        `${k.killmailId}:${k.shipTypeId ?? ''}:${k.killmailTime ?? ''}:${k.victimCorpId ?? ''}`,
    )
    .join('|')
}

/** Collect cached ESI/zKill killmail details for a set of kills (sync, no network). */
export function collectCachedKillDetailsForKills(
  kills: { killmailId: number; hash: string }[],
): Map<number, KillmailDetails> {
  const details = new Map<number, KillmailDetails>()
  for (const kill of kills) {
    const cached = getCachedKillmailDetails(kill.killmailId, kill.hash)
    if (cached) details.set(kill.killmailId, cached)
  }
  return details
}

/** Apply any cached killmail details to a theater for list/modal display. */
export function enrichTheaterFromKillCache(
  theater: WarTheater,
  typeNames?: Map<number, string>,
  maxKills = WAR_ENRICH_PER_THEATER,
): WarTheater {
  const details = collectCachedKillDetailsForKills(
    theater.kills.slice(0, maxKills).map((k) => ({ killmailId: k.killmailId, hash: k.hash })),
  )
  if (details.size === 0) return theater
  const kills = applyKillDetails(theater.kills, details, typeNames)
  const withTime = kills.find((k) => k.killmailTime)
  return {
    ...theater,
    kills,
    zkillRelatedUrl: withTime?.killmailTime
      ? zkillRelatedUrl(theater.focalSystemId, withTime.killmailTime)
      : theater.zkillRelatedUrl,
  }
}

export interface WarScoreInput {
  systemId: number
  systemName: string
  security: number
  refs: ZkillKillRef[]
  shipKills24h?: number
  haulerKillCount?: number
  campLikely?: boolean
}

export interface WarScoreResult {
  systemId: number
  systemName: string
  security: number
  isWar: boolean
  fleetKills: number
  iskDestroyed: number
  haulerShare: number
  soloShare: number
  reason: string
  shipKills24h: number
  qualifyingKillValues: number[]
  killmailIds: number[]
  kills: WarKillEvidence[]
}

/** zKill pastSeconds for incremental refresh since the last overlay cache write. */
export function warIntelGapSeconds(cachedFetchedAt: number, windowSeconds: number): number {
  const gapSec = Math.ceil((Date.now() - cachedFetchedAt) / 1000)
  return Math.min(windowSeconds, Math.max(WAR_INTEL_GAP_MIN_SECONDS, gapSec))
}

function qualifiesForFleetEvidence(ref: ZkillKillRef): boolean {
  return (
    !ref.zkb.npc && !ref.zkb.solo && (ref.zkb.totalValue ?? 0) >= WAR_MIN_KILL_VALUE
  )
}

/** Cap refs for scoring. Keep fleet-qualifying kills (newest first), then other recent kills. */
export function trimWarKillRefs(refs: ZkillKillRef[], maxRefs: number): ZkillKillRef[] {
  const valid = refs.filter((r) => isValidKillRef(r))
  if (valid.length <= maxRefs) return valid
  const byRecency = (a: ZkillKillRef, b: ZkillKillRef) => b.killmail_id - a.killmail_id
  const fleet = valid.filter(qualifiesForFleetEvidence).sort(byRecency)
  const rest = valid.filter((r) => !qualifiesForFleetEvidence(r)).sort(byRecency)
  return [...fleet, ...rest].slice(0, maxRefs)
}

export function mergeKillRefs(
  cached: ZkillKillRef[],
  fresh: ZkillKillRef[],
  maxRefs = WAR_STORE_MAX_REFS_PER_SYSTEM,
): ZkillKillRef[] {
  const seen = new Set<number>()
  const merged: ZkillKillRef[] = []
  for (const ref of [...fresh, ...cached]) {
    if (!isValidKillRef(ref)) continue
    const id = ref.killmail_id
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(ref)
  }
  return trimWarKillRefs(merged, maxRefs)
}

const SHORTER_WAR_WINDOW_SECONDS = [12 * 3600, 86_400, 3 * 86_400, 7 * 86_400]

/** Pull zKill refs from shorter lookback caches so 3d scoring still includes 1d fights. */
export function mergeShorterWindowCachedRefs(
  systemId: number,
  windowSeconds: number,
  refs: ZkillKillRef[],
  maxRefs = WAR_STORE_MAX_REFS_PER_SYSTEM,
): ZkillKillRef[] {
  let merged = refs
  for (const pastSeconds of SHORTER_WAR_WINDOW_SECONDS) {
    if (pastSeconds >= windowSeconds) continue
    const cached = getCached<ZkillKillRef[]>(
      cacheKey('zkill', 'warRefs', { systemId, pastSeconds }),
    )
    if (!cached?.data?.length) continue
    merged = mergeKillRefs(cached.data, merged, maxRefs)
  }
  return merged
}

export function zkillSystemUrl(systemId: number): string {
  return `https://zkillboard.com/system/${systemId}/`
}

export function zkillKillUrl(killmailId: number): string {
  return `https://zkillboard.com/kill/${killmailId}/`
}

/** Format an ISO timestamp in the user's local timezone. */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/** zKill related bucket (YYYYMMDDHHMM, UTC) shown in local time. */
export function formatZkillRelatedTime(relatedTime: number): string {
  const s = String(relatedTime).padStart(12, '0')
  const d = new Date(
    Date.UTC(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
      Number(s.slice(8, 10)),
      Number(s.slice(10, 12)),
    ),
  )
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/** zKill related/BR window for a system + UTC hour bucket. */
export function zkillRelatedUrl(systemId: number, killmailTimeIso: string): string {
  const d = new Date(killmailTimeIso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  return `https://zkillboard.com/related/${systemId}/${y}${m}${day}${h}00/`
}

/** Parse `/related/{systemId}/{YYYYMMDDHHMM}/` from a zKill related URL. */
export function parseZkillRelatedUrl(
  url: string | null | undefined,
): { systemId: number; relatedTime: number } | null {
  if (!url) return null
  const match = url.match(/\/related\/(\d+)\/(\d+)\/?/)
  if (!match) return null
  const systemId = Number(match[1])
  const relatedTime = Number(match[2])
  if (Number.isNaN(systemId) || Number.isNaN(relatedTime)) return null
  return { systemId, relatedTime }
}

export function relatedParamsFromTheater(theater: WarTheater): {
  systemId: number
  relatedTime: number
} | null {
  const parsed = parseZkillRelatedUrl(theater.zkillRelatedUrl)
  if (parsed) return parsed
  const withTime = theater.kills.find((k) => k.killmailTime)
  if (!withTime?.killmailTime) return null
  const d = new Date(withTime.killmailTime)
  const relatedTime = Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}00`,
  )
  return { systemId: theater.focalSystemId, relatedTime }
}

export function buildKillEvidenceFromRefs(
  systemId: number,
  systemName: string,
  refs: ZkillKillRef[],
): WarKillEvidence[] {
  return refs
    .filter((r): r is ZkillKillRef => {
      if (!isValidKillRef(r)) return false
      const zkb = r.zkb
      return !zkb.npc && !zkb.solo && (zkb.totalValue ?? 0) >= WAR_MIN_KILL_VALUE
    })
    .map((r) => ({
      killmailId: r.killmail_id,
      hash: r.zkb.hash,
      totalValue: r.zkb.totalValue ?? 0,
      zkillUrl: zkillKillUrl(r.killmail_id),
      systemId,
      systemName,
      shipTypeId: null,
      shipName: null,
      killmailTime: null,
      attackerCount: null,
      victimCorpId: null,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
}

export function applyKillDetails(
  kills: WarKillEvidence[],
  detailsById: Map<number, KillmailDetails>,
  typeNames?: Map<number, string>,
): WarKillEvidence[] {
  return kills.map((kill) => {
    const details = detailsById.get(kill.killmailId)
    if (!details) return kill
    return {
      ...kill,
      shipTypeId: details.shipTypeId,
      shipName: typeNames?.get(details.shipTypeId) ?? kill.shipName,
      killmailTime: details.killmailTime,
      attackerCount: details.attackerCount,
      victimCorpId: details.victimCorpId ?? kill.victimCorpId,
    }
  })
}

export function scoreWarActivity(input: WarScoreInput): WarScoreResult {
  const playerRefs = input.refs.filter((r) => isValidKillRef(r) && !r.zkb.npc)
  const kills = buildKillEvidenceFromRefs(input.systemId, input.systemName, input.refs)
  const fleetKills = kills.length
  const iskDestroyed = kills.reduce((sum, k) => sum + k.totalValue, 0)
  const qualifyingKillValues = kills.map((k) => k.totalValue)
  const killmailIds = kills.map((k) => k.killmailId)
  const haulerKills = input.haulerKillCount ?? 0
  const totalPlayerKills = Math.max(playerRefs.length, 1)
  const haulerShare = haulerKills / totalPlayerKills
  const soloCount = playerRefs.filter((r) => r.zkb?.solo).length
  const soloShare = soloCount / totalPlayerKills
  const shipKills24h = input.shipKills24h ?? 0

  const campLevel = classifyCampLevel(
    input.systemId,
    input.security,
    haulerKills,
    shipKills24h,
  )
  const campLikely = input.campLikely ?? campLevel === 'Likely'

  let isWar = false
  let reason = 'Insufficient combat activity'

  if (campLikely && haulerShare > 0.5) {
    reason = 'Gate camp / hauler gank pattern'
  } else if (
    (fleetKills >= WAR_MIN_FLEET_KILLS || iskDestroyed >= WAR_MIN_ISK_DESTROYED) &&
    haulerShare < 0.5
  ) {
    isWar = true
    const byKills = fleetKills >= WAR_MIN_FLEET_KILLS
    const byIsk = iskDestroyed >= WAR_MIN_ISK_DESTROYED
    if (byKills && byIsk) {
      reason = `Fleet fight: ${fleetKills} kills (≥${WAR_MIN_FLEET_KILLS}) and ${formatShortIsk(iskDestroyed)} ISK (≥${formatShortIsk(WAR_MIN_ISK_DESTROYED)})`
    } else if (byKills) {
      reason = `Fleet fight: ${fleetKills} non-solo kills ≥${formatShortIsk(WAR_MIN_KILL_VALUE)} each`
    } else {
      reason = `Fleet fight: ${formatShortIsk(iskDestroyed)} ISK destroyed in non-solo kills`
    }
  } else if (haulerShare >= 0.5) {
    reason = 'Hauler-dominated kills (not war)'
  }

  return {
    systemId: input.systemId,
    systemName: input.systemName,
    security: input.security,
    isWar,
    fleetKills,
    iskDestroyed,
    haulerShare,
    soloShare,
    reason,
    shipKills24h,
    qualifyingKillValues,
    killmailIds,
    kills,
  }
}

function formatShortIsk(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`
  return String(Math.round(value))
}

export function pickWarCandidates(
  systemKills: Record<number, { shipKills: number; podKills: number }>,
  withinSystemIds: Set<number>,
  minShipKills = 5,
): number[] {
  return [...withinSystemIds]
    .filter((id) => (systemKills[id]?.shipKills ?? 0) >= minShipKills)
    .sort(
      (a, b) =>
        (systemKills[b]?.shipKills ?? 0) - (systemKills[a]?.shipKills ?? 0),
    )
}

function buildTheaterSummary(
  systemNames: string[],
  fleetKills: number,
  iskDestroyed: number,
  kills: WarKillEvidence[],
): string {
  const area =
    systemNames.length > 1
      ? `${systemNames[0]} +${systemNames.length - 1} systems`
      : (systemNames[0] ?? 'Unknown')
  const ships = [...new Set(kills.map((k) => k.shipName).filter(Boolean))]
  const shipBit =
    ships.length > 0
      ? ` · ships: ${ships.slice(0, 4).join(', ')}${ships.length > 4 ? '…' : ''}`
      : ''
  return `${area} · ${fleetKills} kills · ${formatShortIsk(iskDestroyed)} ISK destroyed${shipBit}`
}

function timeWindowLabel(kills: WarKillEvidence[]): string | null {
  const times = kills
    .map((k) => k.killmailTime)
    .filter((t): t is string => Boolean(t))
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
  if (times.length === 0) return null
  const start = new Date(times[0]!)
  const end = new Date(times[times.length - 1]!)
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  if (times.length === 1) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

/** Most recent enriched kill time in a theater, if any. */
export function latestKillTimeMs(kills: WarKillEvidence[]): number | null {
  let latest: number | null = null
  for (const kill of kills) {
    if (!kill.killmailTime) continue
    const ms = new Date(kill.killmailTime).getTime()
    if (Number.isNaN(ms)) continue
    if (latest === null || ms > latest) latest = ms
  }
  return latest
}

export function formatTheaterLastActivity(
  kills: WarKillEvidence[],
  nowMs: number = Date.now(),
): string | null {
  const latest = latestKillTimeMs(kills)
  if (latest === null) return null
  return formatRelativeOffset(latest, nowMs)
}

function relatedUrlForKills(focalSystemId: number, kills: WarKillEvidence[]): string | null {
  const withTime = kills.find((k) => k.killmailTime)
  if (!withTime?.killmailTime) return null
  return zkillRelatedUrl(focalSystemId, withTime.killmailTime)
}

/**
 * Group nearby war systems into theaters. Wars rarely sit in a single system.
 */
export function clusterWarTheaters(
  graph: MapGraph,
  wars: WarActivityResult[],
  killWindowLabel = '1 day',
): WarTheater[] {
  const active = wars.filter((w) => w.isWar)
  if (active.length === 0) return []

  const parent = new Map<number, number>()
  for (const w of active) parent.set(w.systemId, w.systemId)

  function find(id: number): number {
    let cur = id
    while (parent.get(cur) !== cur) cur = parent.get(cur)!
    let walk = id
    while (walk !== cur) {
      const next = parent.get(walk)!
      parent.set(walk, cur)
      walk = next
    }
    return cur
  }

  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!
      const b = active[j]!
      const jumps = jumpDistance(graph, a.systemId, b.systemId)
      if (jumps !== null && jumps <= WAR_THEATER_MAX_JUMPS) {
        union(a.systemId, b.systemId)
      }
    }
  }

  const groups = new Map<number, WarActivityResult[]>()
  for (const w of active) {
    const root = find(w.systemId)
    const list = groups.get(root) ?? []
    list.push(w)
    groups.set(root, list)
  }

  const theaters: WarTheater[] = []
  let index = 0
  for (const members of groups.values()) {
    members.sort((a, b) => b.iskDestroyed - a.iskDestroyed)
    const focal = members[0]!
    const systemIds = members.map((m) => m.systemId)
    const systemNames = members.map((m) => m.systemName)
    const fleetKills = members.reduce((sum, m) => sum + m.fleetKills, 0)
    const iskDestroyed = members.reduce((sum, m) => sum + m.iskDestroyed, 0)
    const kills = members
      .flatMap((m) => m.kills)
      .sort((a, b) => b.totalValue - a.totalValue)
    const regionIds = [
      ...new Set(
        systemIds
          .map((id) => graph.systems.get(id)?.regionId)
          .filter((id): id is number => id !== undefined),
      ),
    ]

    theaters.push({
      id: `theater-${index++}-${focal.systemId}`,
      systemIds,
      systemNames,
      focalSystemId: focal.systemId,
      focalSystemName: focal.systemName,
      fleetKills,
      iskDestroyed,
      nearestHubId: focal.nearestHubId,
      nearestHubSystemId: focal.nearestHubSystemId,
      nearestHubJumps: focal.nearestHubJumps,
      regionIds,
      reason: theaterReason(members, fleetKills, iskDestroyed, killWindowLabel),
      summary: buildTheaterSummary(systemNames, fleetKills, iskDestroyed, kills),
      kills,
      zkillSystemUrl: zkillSystemUrl(focal.systemId),
      zkillRelatedUrl: relatedUrlForKills(focal.systemId, kills),
      brCreateUrl: WAR_BR_CREATE_URL,
      timeWindowLabel: timeWindowLabel(kills),
      killWindowLabel,
    })
  }

  return theaters.sort((a, b) => b.iskDestroyed - a.iskDestroyed)
}

function theaterReason(
  members: WarActivityResult[],
  fleetKills: number,
  iskDestroyed: number,
  killWindowLabel: string,
): string {
  if (members.length === 1) {
    return members[0]!.reason
  }
  return `${members.length} systems · ${fleetKills} fleet kills · ${formatShortIsk(iskDestroyed)} ISK (${killWindowLabel})`
}

export function attachTheatersToWars(
  wars: WarActivityResult[],
  theaters: WarTheater[],
): WarActivityResult[] {
  const theaterBySystem = new Map<number, WarTheater>()
  for (const theater of theaters) {
    for (const systemId of theater.systemIds) {
      theaterBySystem.set(systemId, theater)
    }
  }
  return wars.map((w) => {
    const theater = theaterBySystem.get(w.systemId)
    return {
      ...w,
      theaterId: theater?.id ?? null,
      theaterSystemIds: theater?.systemIds ?? (w.isWar ? [w.systemId] : []),
      theaterSystemNames: theater?.systemNames ?? (w.isWar ? [w.systemName] : []),
    }
  })
}

export function findTheaterForSystem(
  theaters: WarTheater[],
  systemId: number,
): WarTheater | null {
  return theaters.find((t) => t.systemIds.includes(systemId)) ?? null
}

export function theaterNearestHub(
  theaters: WarTheater[],
  sellHubId: HubId,
): WarTheater | null {
  return theaters.find((t) => t.nearestHubId === sellHubId) ?? null
}

export function topCorpsFromKills(
  kills: WarKillEvidence[],
  limit = 2,
): { corporationId: number; killCount: number; iskDestroyed: number }[] {
  const byCorp = new Map<number, { killCount: number; iskDestroyed: number }>()
  for (const kill of kills) {
    if (!kill.victimCorpId) continue
    const cur = byCorp.get(kill.victimCorpId) ?? { killCount: 0, iskDestroyed: 0 }
    cur.killCount++
    cur.iskDestroyed += kill.totalValue
    byCorp.set(kill.victimCorpId, cur)
  }
  return [...byCorp.entries()]
    .sort((a, b) => b[1].iskDestroyed - a[1].iskDestroyed || b[1].killCount - a[1].killCount)
    .slice(0, limit)
    .map(([corporationId, stats]) => ({ corporationId, ...stats }))
}

export function killUrlsForClipboard(kills: WarKillEvidence[]): string {
  return kills.map((k) => k.zkillUrl).join('\n')
}
