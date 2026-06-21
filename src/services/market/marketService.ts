import type { HubId, MarketHistoryEntry, TimeRange } from '@/types'
import { REGION_IDS } from '@/types'
import { daysForRange, trimHistoryByDays, WIDER_TIME_RANGES } from '@/lib/profit'
import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'
import { batchProcess, dedupe, throttle } from '@/services/market/requestQueue'

const ESI_BASE = 'https://esi.evetech.net/latest'
const FUZZWORK_BASE = 'https://market.fuzzwork.co.uk/aggregates'

function trimHistoryForRange(history: MarketHistoryEntry[], range: TimeRange): MarketHistoryEntry[] {
  const days = daysForRange(range)
  if (days === null) return history
  return trimHistoryByDays(history, days)
}

function historyCacheKey(typeId: number, regionId: number, range: TimeRange): string {
  return cacheKey('history', 'market', { typeId, regionId, range })
}

function esiFetchKey(typeId: number, regionId: number): string {
  return cacheKey('history', 'esi-fetch', { typeId, regionId })
}

async function fetchEsiPrice(typeId: number, regionId: number): Promise<number> {
  await throttle()
  const url = `${ESI_BASE}/markets/${regionId}/orders/?type_id=${typeId}&order_type=sell`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESI orders failed: ${res.status}`)
  const orders = (await res.json()) as { price: number }[]
  if (!orders.length) return 0
  return Math.min(...orders.map((o) => o.price))
}

async function fetchFuzzworkPrice(typeId: number, regionId: number): Promise<number> {
  await throttle()
  const url = `${FUZZWORK_BASE}/?types=${typeId}&region=${regionId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fuzzwork failed: ${res.status}`)
  const data = (await res.json()) as Record<string, { sell?: { min?: number } }>
  return data[String(typeId)]?.sell?.min ?? 0
}

async function fetchEsiHistoryRaw(
  typeId: number,
  regionId: number,
  ifNoneMatch?: string,
): Promise<{ history: MarketHistoryEntry[]; etag?: string; notModified: boolean }> {
  await throttle()
  const url = `${ESI_BASE}/markets/${regionId}/history/?type_id=${typeId}`
  const headers: HeadersInit = {}
  if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch

  const res = await fetch(url, { headers })
  if (res.status === 304) {
    return { history: [], etag: ifNoneMatch, notModified: true }
  }
  if (!res.ok) throw new Error(`ESI history failed: ${res.status}`)

  const etag = res.headers.get('etag') ?? undefined
  const history = (await res.json()) as MarketHistoryEntry[]
  return { history, etag, notModified: false }
}

function tryHistoryFromWiderCache(
  typeId: number,
  regionId: number,
  range: TimeRange,
): { history: MarketHistoryEntry[]; source: string; fetchedAt: number } | null {
  for (const wider of WIDER_TIME_RANGES[range]) {
    const cached = getCached<MarketHistoryEntry[]>(historyCacheKey(typeId, regionId, wider))
    if (cached && !cached.stale) {
      return {
        history: trimHistoryForRange(cached.data, range),
        source: 'cache-slice',
        fetchedAt: cached.fetchedAt,
      }
    }
  }
  return null
}

function findEtagForHistory(typeId: number, regionId: number): string | undefined {
  const ranges: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']
  for (const range of ranges) {
    const cached = getCached<MarketHistoryEntry[]>(historyCacheKey(typeId, regionId, range))
    if (cached?.etag) return cached.etag
  }
  return undefined
}

export async function getPrice(
  typeId: number,
  hub: HubId = 'jita',
  forceRefresh = false,
): Promise<{ price: number; source: string; fetchedAt: number }> {
  const regionId = REGION_IDS[hub]
  const key = cacheKey('price', 'sell', { typeId, regionId })

  if (!forceRefresh) {
    const cached = getCached<number>(key)
    if (cached && !cached.stale) {
      return { price: cached.data, source: 'cache', fetchedAt: cached.fetchedAt }
    }
  }

  return dedupe(key, async () => {
    const cached = getCached<number>(key)
    let price: number
    let source: string

    try {
      price = await fetchEsiPrice(typeId, regionId)
      source = 'esi'
    } catch {
      try {
        price = await fetchFuzzworkPrice(typeId, regionId)
        source = 'fuzzwork'
      } catch {
        if (cached) return { price: cached.data, source: 'cache-stale', fetchedAt: cached.fetchedAt }
        return { price: 0, source: 'none', fetchedAt: Date.now() }
      }
    }

    setCached(key, price, source, TTL.price.fresh, TTL.price.stale)
    return { price, source, fetchedAt: Date.now() }
  })
}

async function fetchRawHistory(
  typeId: number,
  regionId: number,
  forceRefresh: boolean,
): Promise<{ raw: MarketHistoryEntry[]; etag?: string; source: string; fetchedAt: number }> {
  return dedupe(esiFetchKey(typeId, regionId), async () => {
    const allKey = historyCacheKey(typeId, regionId, 'all')
    const allCached = getCached<MarketHistoryEntry[]>(allKey)
    if (!forceRefresh && allCached && !allCached.stale) {
      return { raw: allCached.data, etag: allCached.etag, source: 'cache', fetchedAt: allCached.fetchedAt }
    }

    const etag = forceRefresh ? undefined : (allCached?.etag ?? findEtagForHistory(typeId, regionId))
    let { history, etag: newEtag, notModified } = await fetchEsiHistoryRaw(typeId, regionId, etag)

    if (notModified) {
      if (allCached) {
        setCached(allKey, allCached.data, 'esi', TTL.history.fresh, TTL.history.stale, newEtag)
        return { raw: allCached.data, etag: newEtag, source: 'cache', fetchedAt: Date.now() }
      }
      const retry = await fetchEsiHistoryRaw(typeId, regionId)
      history = retry.history
      newEtag = retry.etag
      notModified = retry.notModified
    }

    return { raw: history, etag: newEtag, source: 'esi', fetchedAt: Date.now() }
  })
}

export async function getMarketHistory(
  typeId: number,
  hub: HubId = 'jita',
  range: TimeRange = '1d',
  forceRefresh = false,
): Promise<{ history: MarketHistoryEntry[]; source: string; fetchedAt: number }> {
  const regionId = REGION_IDS[hub]
  const key = historyCacheKey(typeId, regionId, range)

  if (!forceRefresh) {
    const cached = getCached<MarketHistoryEntry[]>(key)
    if (cached && !cached.stale) {
      return { history: cached.data, source: 'cache', fetchedAt: cached.fetchedAt }
    }

    const fromWider = tryHistoryFromWiderCache(typeId, regionId, range)
    if (fromWider) {
      setCached(key, fromWider.history, fromWider.source, TTL.history.fresh, TTL.history.stale)
      return fromWider
    }
  }

  try {
    const { raw, etag, source, fetchedAt } = await fetchRawHistory(typeId, regionId, forceRefresh)
    const trimmed = trimHistoryForRange(raw, range)
    setCached(key, trimmed, source, TTL.history.fresh, TTL.history.stale, etag)

    if (range === 'all') {
      setCached(historyCacheKey(typeId, regionId, 'all'), raw, source, TTL.history.fresh, TTL.history.stale, etag)
    }

    return { history: trimmed, source, fetchedAt }
  } catch {
    const cached = getCached<MarketHistoryEntry[]>(key)
    if (cached) {
      return { history: cached.data, source: 'cache-stale', fetchedAt: cached.fetchedAt }
    }
    const fromWider = tryHistoryFromWiderCache(typeId, regionId, range)
    if (fromWider) return fromWider
    return { history: [], source: 'none', fetchedAt: Date.now() }
  }
}

export async function getCostIndices(forceRefresh = false): Promise<Record<number, number>> {
  const key = cacheKey('esi', 'costIndices', {})

  if (!forceRefresh) {
    const cached = getCached<Record<number, number>>(key)
    if (cached && !cached.stale) return cached.data
  }

  return dedupe(key, async () => {
    const cached = getCached<Record<number, number>>(key)
    try {
      await throttle()
      const res = await fetch(`${ESI_BASE}/industry/systems/`)
      if (!res.ok) throw new Error('cost index fetch failed')
      const systems = (await res.json()) as { solar_system_id: number; cost_indices: { activity: string; cost_index: number }[] }[]
      const map: Record<number, number> = {}
      for (const sys of systems) {
        const mfg = sys.cost_indices.find((c) => c.activity === 'manufacturing')
        if (mfg) map[sys.solar_system_id] = mfg.cost_index
      }
      setCached(key, map, 'esi', TTL.costIndex.fresh, TTL.costIndex.stale)
      return map
    } catch {
      return cached?.data ?? {}
    }
  })
}

async function fetchFuzzworkPrices(
  typeIds: number[],
  regionId: number,
): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  if (!typeIds.length) return map

  for (let i = 0; i < typeIds.length; i += 100) {
    const chunk = typeIds.slice(i, i + 100)
    await throttle()
    const url = `${FUZZWORK_BASE}/?types=${chunk.join(',')}&region=${regionId}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fuzzwork bulk failed: ${res.status}`)
    const data = (await res.json()) as Record<string, { sell?: { min?: number } }>
    for (const typeId of chunk) {
      map.set(typeId, data[String(typeId)]?.sell?.min ?? 0)
    }
  }
  return map
}

export async function getPricesForTypes(
  typeIds: number[],
  hub: HubId = 'jita',
  forceRefresh = false,
): Promise<Map<number, number>> {
  const regionId = REGION_IDS[hub]
  const map = new Map<number, number>()
  const missing: number[] = []

  for (const typeId of typeIds) {
    const key = cacheKey('price', 'sell', { typeId, regionId })
    if (!forceRefresh) {
      const cached = getCached<number>(key)
      if (cached && !cached.stale) {
        map.set(typeId, cached.data)
        continue
      }
    }
    missing.push(typeId)
  }

  if (missing.length) {
    try {
      const bulk = await fetchFuzzworkPrices(missing, regionId)
      for (const typeId of missing) {
        const price = bulk.get(typeId) ?? 0
        map.set(typeId, price)
        setCached(
          cacheKey('price', 'sell', { typeId, regionId }),
          price,
          'fuzzwork',
          TTL.price.fresh,
          TTL.price.stale,
        )
      }
    } catch {
      await batchProcess(missing, 5, 0, async (typeId) => {
        const { price } = await getPrice(typeId, hub, forceRefresh)
        map.set(typeId, price)
      })
    }
  }

  return map
}

export interface SystemKillsMap {
  [systemId: number]: { shipKills: number; podKills: number }
}

export async function getSystemKills(forceRefresh = false): Promise<{
  kills: SystemKillsMap
  source: string
  fetchedAt: number
}> {
  const key = cacheKey('esi', 'systemKills', {})

  if (!forceRefresh) {
    const cached = getCached<SystemKillsMap>(key)
    if (cached && !cached.stale) {
      return { kills: cached.data, source: 'cache', fetchedAt: cached.fetchedAt }
    }
  }

  return dedupe(key, async () => {
    const cached = getCached<SystemKillsMap>(key)
    try {
      await throttle()
      const res = await fetch(`${ESI_BASE}/universe/system_kills/`)
      if (!res.ok) throw new Error(`system_kills failed: ${res.status}`)
      const rows = (await res.json()) as {
        system_id: number
        ship_kills: number
        pod_kills: number
      }[]
      const kills: SystemKillsMap = {}
      for (const row of rows) {
        kills[row.system_id] = { shipKills: row.ship_kills, podKills: row.pod_kills }
      }
      setCached(key, kills, 'esi', TTL.systemKills.fresh, TTL.systemKills.stale)
      return { kills, source: 'esi', fetchedAt: Date.now() }
    } catch {
      if (cached) {
        return { kills: cached.data, source: 'cache-stale', fetchedAt: cached.fetchedAt }
      }
      return { kills: {}, source: 'none', fetchedAt: Date.now() }
    }
  })
}

export async function getRoute(
  originSystemId: number,
  destinationSystemId: number,
  forceRefresh = false,
): Promise<{ route: number[]; source: string; fetchedAt: number }> {
  const key = cacheKey('esi', 'route', { originSystemId, destinationSystemId })

  if (!forceRefresh) {
    const cached = getCached<number[]>(key)
    if (cached && !cached.stale) {
      return { route: cached.data, source: 'cache', fetchedAt: cached.fetchedAt }
    }
  }

  return dedupe(key, async () => {
    const cached = getCached<number[]>(key)
    try {
      await throttle()
      const url = `${ESI_BASE}/route/${originSystemId}/${destinationSystemId}/?flag=secure`
      const res = await fetch(url)
      if (res.status === 404) {
        const empty: number[] = []
        setCached(key, empty, 'esi', TTL.route.fresh, TTL.route.stale)
        return { route: empty, source: 'esi', fetchedAt: Date.now() }
      }
      if (!res.ok) throw new Error(`route failed: ${res.status}`)
      const route = (await res.json()) as number[]
      setCached(key, route, 'esi', TTL.route.fresh, TTL.route.stale)
      return { route, source: 'esi', fetchedAt: Date.now() }
    } catch {
      if (cached) {
        return { route: cached.data, source: 'cache-stale', fetchedAt: cached.fetchedAt }
      }
      return { route: [], source: 'none', fetchedAt: Date.now() }
    }
  })
}

export async function getSystemInfo(
  systemId: number,
  forceRefresh = false,
): Promise<{ systemId: number; name: string; security: number }> {
  const key = cacheKey('esi', 'systemInfo', { systemId })

  if (!forceRefresh) {
    const cached = getCached<{ systemId: number; name: string; security: number }>(key)
    if (cached && !cached.stale) return cached.data
  }

  return dedupe(key, async () => {
    const cached = getCached<{ systemId: number; name: string; security: number }>(key)
    try {
      await throttle()
      const res = await fetch(`${ESI_BASE}/universe/systems/${systemId}/`)
      if (!res.ok) throw new Error(`system info failed: ${res.status}`)
      const data = (await res.json()) as { name: string; security_status: number }
      const info = { systemId, name: data.name, security: data.security_status }
      setCached(key, info, 'esi', TTL.route.fresh, TTL.route.stale)
      return info
    } catch {
      return cached?.data ?? { systemId, name: `System ${systemId}`, security: 0 }
    }
  })
}
