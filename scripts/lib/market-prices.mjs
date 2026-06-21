const FUZZWORK_BASE = 'https://market.fuzzwork.co.uk/aggregates'
const ESI_BASE = 'https://esi.evetech.net/latest'

const REGION_IDS = {
  jita: 10000002,
  amarr: 10000043,
  dodixie: 10000032,
  rens: 10000030,
  hek: 10000042,
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchFuzzworkPrices(typeIds, regionId, options = {}) {
  const { onChunk } = options
  const sell = new Map()
  const buy = new Map()
  if (!typeIds.length) return { sell, buy }

  const chunkSize = 100
  const chunkCount = Math.ceil(typeIds.length / chunkSize)

  for (let i = 0; i < typeIds.length; i += chunkSize) {
    const chunk = typeIds.slice(i, i + chunkSize)
    const url = `${FUZZWORK_BASE}/?types=${chunk.join(',')}&region=${regionId}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fuzzwork bulk failed: ${res.status}`)
    const data = await res.json()
    for (const typeId of chunk) {
      const row = data[String(typeId)]
      sell.set(typeId, row?.sell?.min ?? 0)
      buy.set(typeId, row?.buy?.max ?? 0)
    }
    if (onChunk) {
      onChunk(Math.floor(i / chunkSize) + 1, chunkCount)
    }
    if (i + chunkSize < typeIds.length) await sleep(200)
  }

  return { sell, buy }
}

export async function fetchCostIndices() {
  const res = await fetch(`${ESI_BASE}/industry/systems/`)
  if (!res.ok) throw new Error(`ESI cost indices failed: ${res.status}`)
  const systems = await res.json()
  const map = new Map()
  for (const sys of systems) {
    const mfg = sys.cost_indices.find((c) => c.activity === 'manufacturing')
    if (mfg) map.set(sys.solar_system_id, mfg.cost_index)
  }
  return map
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
