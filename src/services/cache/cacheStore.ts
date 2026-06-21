interface CacheEntry<T> {
  fetchedAt: number
  expiresAt: number
  maxStaleAt: number
  payload: T
  source: string
  etag?: string
}

const PREFIX = 'eveio:cache:'
const MAX_ENTRIES = 500

export function cacheKey(source: string, endpoint: string, params: Record<string, unknown>): string {
  const hash = btoa(JSON.stringify(params)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
  return `${PREFIX}${source}:${endpoint}:${hash}`
}

export function getCached<T>(
  key: string,
): { data: T; stale: boolean; fetchedAt: number; etag?: string } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    const now = Date.now()
    if (now > entry.maxStaleAt) {
      localStorage.removeItem(key)
      return null
    }
    return {
      data: entry.payload,
      stale: now > entry.expiresAt,
      fetchedAt: entry.fetchedAt,
      etag: entry.etag,
    }
  } catch {
    return null
  }
}

export function setCached<T>(
  key: string,
  payload: T,
  source: string,
  ttlMs: number,
  maxStaleMs: number,
  etag?: string,
): void {
  const now = Date.now()
  const entry: CacheEntry<T> = {
    fetchedAt: now,
    expiresAt: now + ttlMs,
    maxStaleAt: now + maxStaleMs,
    payload,
    source,
    ...(etag ? { etag } : {}),
  }
  localStorage.setItem(key, JSON.stringify(entry))
  pruneCache()
}

export function clearPriceCache(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

export function getCacheStats(): { count: number; sizeKb: number } {
  let count = 0
  let size = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) {
      count++
      size += (localStorage.getItem(key)?.length ?? 0)
    }
  }
  return { count, sizeKb: Math.round(size / 1024) }
}

function pruneCache(): void {
  const entries: { key: string; fetchedAt: number }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as CacheEntry<unknown>
      if (Date.now() > entry.maxStaleAt) {
        localStorage.removeItem(key)
      } else {
        entries.push({ key, fetchedAt: entry.fetchedAt })
      }
    } catch {
      localStorage.removeItem(key!)
    }
  }
  if (entries.length <= MAX_ENTRIES) return
  entries.sort((a, b) => a.fetchedAt - b.fetchedAt)
  entries.slice(0, entries.length - MAX_ENTRIES).forEach((e) => localStorage.removeItem(e.key))
}

export const TTL = {
  price: { fresh: 15 * 60 * 1000, stale: 24 * 60 * 60 * 1000 },
  history: { fresh: 20 * 60 * 60 * 1000, stale: 7 * 24 * 60 * 60 * 1000 },
  costIndex: { fresh: 24 * 60 * 60 * 1000, stale: 7 * 24 * 60 * 60 * 1000 },
  systemKills: { fresh: 10 * 60 * 1000, stale: 60 * 60 * 1000 },
  route: { fresh: 24 * 60 * 60 * 1000, stale: 7 * 24 * 60 * 60 * 1000 },
  zkillCamp: { fresh: 8 * 60 * 1000, stale: 30 * 60 * 1000 },
  failed: { fresh: 5 * 60 * 1000, stale: 5 * 60 * 1000 },
} as const
