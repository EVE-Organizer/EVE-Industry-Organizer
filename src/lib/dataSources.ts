import { TTL } from '@/services/cache/cacheStore'

export type DataSourceKind = 'esi-character' | 'esi-public' | 'market-live' | 'static-snapshot'

export interface DataSourceDef {
  id: string
  label: string
  kind: DataSourceKind
  fallbackFreshMs: number
  fallbackStaleMs: number
}

/** Single TTL table. React Query stale times come from the cache entry, not a second constant. */
export const DATA_SOURCES = {
  characterJobs: {
    id: 'character-jobs',
    label: 'Industry jobs',
    kind: 'esi-character',
    fallbackFreshMs: TTL.characterData.fresh,
    fallbackStaleMs: TTL.characterData.stale,
  },
  characterAssets: {
    id: 'character-assets',
    label: 'Station assets',
    kind: 'esi-character',
    fallbackFreshMs: TTL.characterData.fresh,
    fallbackStaleMs: TTL.characterData.stale,
  },
  characterSkills: {
    id: 'character-skills',
    label: 'Skills',
    kind: 'esi-character',
    fallbackFreshMs: TTL.characterData.fresh,
    fallbackStaleMs: TTL.characterData.stale,
  },
  characterBlueprints: {
    id: 'character-blueprints',
    label: 'Blueprints',
    kind: 'esi-character',
    fallbackFreshMs: TTL.characterData.fresh,
    fallbackStaleMs: TTL.characterData.stale,
  },
  prices: {
    id: 'prices',
    label: 'Live prices',
    kind: 'market-live',
    fallbackFreshMs: TTL.price.fresh,
    fallbackStaleMs: TTL.price.stale,
  },
  snapshot: {
    id: 'snapshot',
    label: 'Price snapshot',
    kind: 'static-snapshot',
    fallbackFreshMs: 15 * 60 * 1000,
    fallbackStaleMs: 24 * 60 * 60 * 1000,
  },
  costIndex: {
    id: 'cost-index',
    label: 'Cost index',
    kind: 'esi-public',
    fallbackFreshMs: TTL.costIndex.fresh,
    fallbackStaleMs: TTL.costIndex.stale,
  },
} as const satisfies Record<string, DataSourceDef>

/** Remaining freshness of a cache entry, used as React Query staleTime. */
export function staleTimeFromExpiry(expiresAt: number | undefined, now = Date.now()): number {
  if (expiresAt == null || !Number.isFinite(expiresAt)) return 0
  return Math.max(0, expiresAt - now)
}

export interface DataVersion {
  generatedAt: string
  marketGeneratedAt: string
  sdeBuild: number | null
}

/** Next daily price snapshot, 04:00 UTC (11:00 Asia/Bangkok). */
export function nextSnapshotUpdate(now = new Date()): Date {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0, 0),
  )
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatStamp(date: Date): string {
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Label for snapshot-driven prices (Plan, Blueprints, Item). */
export function snapshotPriceLabel(generatedAt: string | undefined, now = new Date()): string {
  if (!generatedAt) return 'Prices from the daily snapshot'
  const at = new Date(generatedAt)
  if (Number.isNaN(at.getTime())) return 'Prices from the daily snapshot'
  return `Prices as of ${formatStamp(at)} (snapshot) · next ~${formatStamp(nextSnapshotUpdate(now))}`
}
