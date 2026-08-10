import { HUB_REGION_IDS as REGION_IDS } from './hubs.mjs'

const FUZZWORK_BASE = 'https://market.fuzzwork.co.uk/aggregates'
const ESI_BASE = 'https://esi.evetech.net/latest'
const CHUNK_SIZE = 100
const CHUNK_CONCURRENCY = 3

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

async function fetchPriceChunk(chunk, regionId, attempt = 0) {
  const url = `${FUZZWORK_BASE}/?types=${chunk.join(',')}&region=${regionId}`
  const res = await fetch(url)
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Fuzzwork bulk failed: ${res.status}`)
    const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt
    await sleep(retryAfter * 1000)
    return fetchPriceChunk(chunk, regionId, attempt + 1)
  }
  if (!res.ok) throw new Error(`Fuzzwork bulk failed: ${res.status}`)
  return res.json()
}

export async function fetchFuzzworkPrices(typeIds, regionId, options = {}) {
  const { onChunk } = options
  const sell = new Map()
  const buy = new Map()
  if (!typeIds.length) return { sell, buy }

  const chunks = []
  for (let i = 0; i < typeIds.length; i += CHUNK_SIZE) {
    chunks.push(typeIds.slice(i, i + CHUNK_SIZE))
  }
  const chunkCount = chunks.length
  let completed = 0

  await runPool(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    const data = await fetchPriceChunk(chunk, regionId)
    for (const typeId of chunk) {
      const row = data[String(typeId)]
      sell.set(typeId, row?.sell?.min ?? 0)
      buy.set(typeId, row?.buy?.max ?? 0)
    }
    completed++
    if (onChunk) onChunk(completed, chunkCount)
  })

  return { sell, buy }
}

export async function fetchCostIndices() {
  const res = await fetch(`${ESI_BASE}/industry/systems/`)
  if (!res.ok) throw new Error(`ESI cost indices failed: ${res.status}`)
  const systems = await res.json()
  const manufacturing = new Map()
  const reaction = new Map()
  for (const sys of systems) {
    const mfg = sys.cost_indices.find((c) => c.activity === 'manufacturing')
    const rxn = sys.cost_indices.find((c) => c.activity === 'reaction')
    if (mfg) manufacturing.set(sys.solar_system_id, mfg.cost_index)
    if (rxn) reaction.set(sys.solar_system_id, rxn.cost_index)
  }
  return { manufacturing, reaction }
}

export function collectBlueprintTypeIds(blueprints) {
  const ids = new Set()
  for (const bp of blueprints) {
    ids.add(bp.productTypeId)
    ids.add(bp.blueprintTypeId)
    for (const m of bp.materials) ids.add(m.typeId)
  }
  return [...ids]
}

export { REGION_IDS }
