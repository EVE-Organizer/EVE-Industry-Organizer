import { readFileSync, renameSync, writeFileSync } from 'fs'
import { fetchCostIndices, fetchFuzzworkPrices, REGION_IDS } from './market-prices.mjs'
import { HUB_MARKET_SYSTEMS } from './regions.mjs'

export const MARKET_HUB_IDS = Object.keys(REGION_IDS)

/** @param {string | undefined | null} raw Comma-separated hub ids, e.g. "jita" or "jita,amarr" */
export function parseHubIds(raw) {
  if (!raw?.trim()) return null
  const ids = raw
    .split(/[,+\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((id) => id !== '--')
  const invalid = ids.filter((id) => !REGION_IDS[id])
  if (invalid.length) {
    throw new Error(`Unknown hub(s): ${invalid.join(', ')}. Valid: ${MARKET_HUB_IDS.join(', ')}`)
  }
  return [...new Set(ids)]
}

const ESI_BASE = 'https://esi.evetech.net/latest'
const MIN_COURIER_SAMPLES = 3
const HISTORY_BATCH_SIZE = 100
const DEFAULT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000
const HISTORY_WINDOWS = {
  '1d': 1,
  '1w': 7,
  '1m': 30,
  '1y': 365,
  all: null,
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPool(items, concurrency, worker) {
  if (!items.length) return
  let next = 0
  async function runWorker() {
    while (true) {
      const index = next++
      if (index >= items.length) break
      await worker(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  )
}

function routeKey(from, to) {
  return `${from}->${to}`
}

function emptyMarket() {
  return {
    generatedAt: new Date().toISOString(),
    hubs: {},
    haulRates: {},
  }
}

export function loadExistingMarket(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

export function writeMarketJson(filePath, market) {
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(market, null, 2))
  renameSync(tmpPath, filePath)
}

function isHistoryFresh(fetchedAt, now, ttlMs) {
  if (!fetchedAt) return false
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t)) return false
  return now - t < ttlMs
}

function sliceHistoryForWindow(history, days) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  if (days === null) return sorted

  const cutoff = Date.now() - days * 86400000
  const filtered = sorted.filter((row) => new Date(row.date).getTime() >= cutoff)
  if (filtered.length) return filtered

  // ESI history lags; use the most recent N trading days available.
  return sorted.slice(-Math.min(days, sorted.length))
}

export function aggregateHistoryWindows(history) {
  if (!history?.length) return {}

  const windows = {}
  for (const [key, days] of Object.entries(HISTORY_WINDOWS)) {
    const filtered = sliceHistoryForWindow(history, days)
    if (!filtered.length) continue
    const avgPrice = filtered.reduce((s, h) => s + h.average, 0) / filtered.length
    const avgVolume = filtered.reduce((s, h) => s + h.volume, 0) / filtered.length
    const high = Math.max(...filtered.map((h) => h.highest))
    const low = Math.min(...filtered.map((h) => h.lowest))
    windows[key] = {
      avgPrice: Math.round(avgPrice * 100) / 100,
      avgVolume: Math.round(avgVolume * 100) / 100,
      high,
      low,
    }
  }
  return windows
}

export async function fetchEsiHistory(typeId, regionId, attempt = 0) {
  const url = `${ESI_BASE}/markets/${regionId}/history/?type_id=${typeId}`
  const res = await fetch(url)
  if (res.status === 404 || res.status === 400) return []
  if (res.status === 420 || res.status === 429) {
    if (attempt >= 5) throw new Error(`ESI history ${typeId}: ${res.status}`)
    const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt
    await sleep(retryAfter * 1000)
    return fetchEsiHistory(typeId, regionId, attempt + 1)
  }
  if (!res.ok) throw new Error(`ESI history ${typeId}: ${res.status}`)
  return res.json()
}

export async function fetchPublicCourierContracts(regionId, stationToSystem) {
  const contracts = []
  let page = 1
  while (page <= 5) {
    await sleep(200)
    const url = `${ESI_BASE}/contracts/public/${regionId}/?page=${page}`
    const res = await fetch(url)
    if (res.status === 404) break
    if (!res.ok) break
    const batch = await res.json()
    if (!batch.length) break
    for (const c of batch) {
      if (c.type !== 'courier') continue
      if (!c.volume || !c.reward) continue
      const startSystem = stationToSystem.get(c.start_location_id)
      const endSystem = stationToSystem.get(c.end_location_id)
      if (!startSystem || !endSystem) continue
      if (startSystem === endSystem) continue
      contracts.push({
        startSystem,
        endSystem,
        reward: c.reward,
        volume: c.volume,
      })
    }
    page++
  }
  return contracts
}

export function aggregateHaulRates(courierContracts) {
  const buckets = new Map()
  for (const c of courierContracts) {
    const key = routeKey(c.startSystem, c.endSystem)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(c.reward / c.volume)
  }

  const haulRates = {}
  for (const [key, rates] of buckets) {
    rates.sort((a, b) => a - b)
    const median = rates[Math.floor(rates.length / 2)]
    const [from, to] = key.split('->').map(Number)
    haulRates[key] = {
      valid: rates.length >= MIN_COURIER_SAMPLES,
      iskPerM3: Math.round(median * 1000) / 1000,
      jumps: null,
      samples: rates.length,
      fromSystemId: from,
      toSystemId: to,
    }
  }
  return haulRates
}

function pricesToObject(priceMap) {
  const obj = {}
  for (const [id, price] of priceMap) obj[id] = price
  return obj
}

async function fetchHubHistory({
  hubId,
  regionId,
  productTypeIds,
  historyLimit,
  historyConcurrency,
  historyTtlMs,
  existingHub,
  products,
  productsFetchedAt,
  onCheckpoint,
  onProgress,
  verbose = false,
}) {
  const capped =
    Number.isFinite(historyLimit) ? productTypeIds.slice(0, historyLimit) : productTypeIds
  const now = Date.now()
  const toFetch = []
  let skippedFresh = 0

  for (const productTypeId of capped) {
    const key = String(productTypeId)
    const fetchedAt = existingHub?.productsFetchedAt?.[key] ?? productsFetchedAt[key]
    const cachedWindows = existingHub?.products?.[key] ?? products[key]

    if (isHistoryFresh(fetchedAt, now, historyTtlMs)) {
      if (cachedWindows) products[key] = cachedWindows
      if (fetchedAt) productsFetchedAt[key] = fetchedAt
      skippedFresh++
      continue
    }
    toFetch.push(productTypeId)
  }

  onProgress?.({
    phase: 'history_start',
    hubId,
    total: toFetch.length,
    skippedFresh,
    historyTtlMs,
  })

  let errors = 0
  const throttled = createProgressThrottle()

  for (let offset = 0; offset < toFetch.length; offset += HISTORY_BATCH_SIZE) {
    const batch = toFetch.slice(offset, offset + HISTORY_BATCH_SIZE)
    let batchDone = 0
    const batchTotal = batch.length
    const fetchedAt = new Date().toISOString()

    await runPool(batch, historyConcurrency, async (productTypeId) => {
      const key = String(productTypeId)
      try {
        const history = await fetchEsiHistory(productTypeId, regionId)
        const windows = aggregateHistoryWindows(history)
        if (Object.keys(windows).length) products[key] = windows
        else delete products[key]
      } catch (e) {
        errors++
        onProgress?.({
          phase: 'history_error',
          hubId,
          productTypeId,
          message: e.message,
        })
        if (verbose) {
          console.warn(`    history skip ${productTypeId}:`, e.message)
        }
      }
      productsFetchedAt[key] = fetchedAt
      batchDone++
      const current = offset + batchDone
      throttled(current, toFetch.length, () => {
        onProgress?.({
          phase: 'history',
          hubId,
          current,
          total: toFetch.length,
          skippedFresh,
          errors,
        })
      })
    })

    if (onCheckpoint) {
      onProgress?.({ phase: 'checkpoint', hubId })
      await onCheckpoint()
    }
  }

  onProgress?.({
    phase: 'history_done',
    hubId,
    total: toFetch.length,
    skippedFresh,
    errors,
  })
}

function createProgressThrottle(minMs = 500, minPct = 0.01) {
  let lastMs = 0
  let lastPct = 0
  return (current, total, fn) => {
    const pct = total > 0 ? current / total : 1
    const now = Date.now()
    if (current >= total || now - lastMs >= minMs || pct - lastPct >= minPct) {
      lastMs = now
      lastPct = pct
      fn()
    }
  }
}

export async function buildMarketData(blueprints, regions, stations, options = {}) {
  const {
    skipHistory = false,
    historyLimit = Infinity,
    historyConcurrency = 10,
    historyTtlMs = DEFAULT_HISTORY_TTL_MS,
    existingMarket = null,
    onCheckpoint = null,
    onProgress = null,
    hubIds = null,
    verbose = false,
  } = options

  const emit = (event) => onProgress?.(event)

  const market = existingMarket
    ? {
        generatedAt: existingMarket.generatedAt ?? new Date().toISOString(),
        hubs: { ...(existingMarket.hubs ?? {}) },
        haulRates: { ...(existingMarket.haulRates ?? {}) },
      }
    : emptyMarket()

  const costIndices = await fetchCostIndices()
  const typeIds = collectTypeIds(blueprints)
  const productTypeIds = [...new Set(blueprints.map((b) => b.productTypeId))]
  const blueprintTypeIds = [...new Set(blueprints.map((b) => b.blueprintTypeId))]
  const materialTypeIds = [...new Set(blueprints.flatMap((b) => b.materials.map((m) => m.typeId)))]
  const historyTypeIds = [...new Set([...productTypeIds, ...blueprintTypeIds, ...materialTypeIds])]

  const stationToSystem = new Map(
    stations.map((s) => [s.stationId ?? s.stationID, s.systemId ?? num(s.solarSystemID)]),
  )
  for (const row of stations) {
    if (row.stationId) stationToSystem.set(row.stationId, row.systemId)
    if (row.stationID) stationToSystem.set(Number(row.stationID), Number(row.solarSystemID))
  }

  const allCourier = []
  const hubEntries = Object.entries(REGION_IDS).filter(
    ([hubId]) => !hubIds || hubIds.includes(hubId),
  )

  if (!hubEntries.length) {
    throw new Error(`No hubs matched filter: ${hubIds?.join(', ')}`)
  }

  const hubCount = hubEntries.length

  for (let hubIndex = 0; hubIndex < hubEntries.length; hubIndex++) {
    const [hubId, regionId] = hubEntries[hubIndex]

    emit({ phase: 'hub_start', hubId, hubIndex: hubIndex + 1, hubCount })

    const priceChunks = Math.ceil(typeIds.length / 100) || 1
    const { sell: prices, buy: buyPrices } = await fetchFuzzworkPrices(typeIds, regionId, {
      onChunk: (current, total) => {
        emit({ phase: 'prices', hubId, current, total: total || priceChunks })
      },
    })
    emit({ phase: 'prices_done', hubId })

    const defaultBuild = regions.regions.find((r) => r.regionId === regionId)
    const buildSystemId = defaultBuild?.buildSystemId ?? HUB_MARKET_SYSTEMS[hubId]
    const costIndex = defaultBuild?.costIndex ?? costIndices.get(buildSystemId) ?? 0.01

    const existingHub = market.hubs[hubId]
    const products = { ...(existingHub?.products ?? {}) }
    const productsFetchedAt = { ...(existingHub?.productsFetchedAt ?? {}) }

    if (!skipHistory) {
      await fetchHubHistory({
        hubId,
        regionId,
        productTypeIds: historyTypeIds,
        historyLimit,
        historyConcurrency,
        historyTtlMs,
        existingHub,
        products,
        productsFetchedAt,
        onProgress,
        verbose,
        onCheckpoint: onCheckpoint
          ? async () => {
              market.generatedAt = new Date().toISOString()
              market.hubs[hubId] = {
                regionId,
                marketSystemId: HUB_MARKET_SYSTEMS[hubId],
                buildSystemId,
                costIndex,
                prices: pricesToObject(prices),
                buyPrices: pricesToObject(buyPrices),
                products: { ...products },
                productsFetchedAt: { ...productsFetchedAt },
              }
              await onCheckpoint(market)
            }
          : null,
      })
    }

    emit({ phase: 'courier', hubId })
    const couriers = await fetchPublicCourierContracts(regionId, stationToSystem)
    allCourier.push(...couriers)
    emit({ phase: 'courier_done', hubId })

    market.hubs[hubId] = {
      regionId,
      marketSystemId: HUB_MARKET_SYSTEMS[hubId],
      buildSystemId,
      costIndex,
      prices: pricesToObject(prices),
      buyPrices: pricesToObject(buyPrices),
      products,
      productsFetchedAt,
    }

    market.generatedAt = new Date().toISOString()
    if (onCheckpoint) {
      emit({ phase: 'checkpoint', hubId })
      await onCheckpoint(market)
    }

    emit({ phase: 'hub_done', hubId })
  }

  emit({ phase: 'haul_rates' })
  const refreshedHaulRates = aggregateHaulRates(allCourier)
  if (hubIds && hubIds.length < MARKET_HUB_IDS.length) {
    market.haulRates = { ...market.haulRates, ...refreshedHaulRates }
  } else {
    market.haulRates = refreshedHaulRates
  }
  market.generatedAt = new Date().toISOString()
  emit({
    phase: 'haul_rates_done',
    routeCount: Object.keys(market.haulRates).length,
  })

  return market
}

function collectTypeIds(blueprints) {
  const ids = new Set()
  for (const bp of blueprints) {
    ids.add(bp.productTypeId)
    ids.add(bp.blueprintTypeId)
    for (const m of bp.materials) ids.add(m.typeId)
    for (const d of bp.invention?.datacores ?? []) ids.add(d.typeId)
  }
  return [...ids]
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
