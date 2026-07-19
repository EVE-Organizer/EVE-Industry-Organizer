import { createReadStream, readFileSync, renameSync, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { HUB_REGION_IDS } from './hubs.mjs'

const LISTING_CAP = 20
const EVEREF_INDEX_URL = 'https://data.everef.net/public-contracts/index.json'
const EVEREF_ARCHIVE_FALLBACK =
  'https://data.everef.net/public-contracts/public-contracts-latest.v2.tar.bz2'

function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

async function readCsvObjects(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  let headers = null
  const rows = []
  for await (const line of rl) {
    if (!line.trim()) continue
    const fields = parseCsvLine(line)
    if (!headers) {
      headers = fields
      continue
    }
    const row = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] ?? ''
    }
    rows.push(row)
  }
  return rows
}

async function findCsvPath(rootDir, fileName) {
  const direct = join(rootDir, fileName)
  try {
    await readCsvObjects(direct)
    return direct
  } catch {
    // fall through
  }

  const entries = await readdir(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = join(rootDir, entry.name, fileName)
    try {
      await readCsvObjects(nested)
      return nested
    } catch {
      // try next directory
    }
  }

  throw new Error(`Could not find ${fileName} under ${rootDir}`)
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function bool(value) {
  return value === 'true' || value === '1' || value === 'True'
}

/**
 * @param {string} contractsCsv
 * @param {string} itemsCsv
 * @param {Set<number>} blueprintTypeIds
 * @param {number} regionId
 */
export function buildRegionBpcIndex(contractsCsv, itemsCsv, blueprintTypeIds, regionId) {
  const contracts = new Map()
  for (const row of contractsCsv) {
    if (num(row.region_id) !== regionId) continue
    if (row.type !== 'item_exchange') continue
    contracts.set(num(row.contract_id), {
      contractId: num(row.contract_id),
      price: num(row.price),
      buyout: num(row.buyout),
      expires: row.date_expired ?? '',
      stationId: num(row.station_id) || undefined,
    })
  }

  const byBlueprint = new Map()
  for (const row of itemsCsv) {
    if (!bool(row.is_blueprint_copy)) continue
    const runs = num(row.runs)
    if (runs <= 0) continue
    const typeId = num(row.type_id)
    if (!blueprintTypeIds.has(typeId)) continue
    const contract = contracts.get(num(row.contract_id))
    if (!contract) continue

    const listing = {
      contractId: contract.contractId,
      price: contract.price,
      buyout: contract.buyout > 0 ? contract.buyout : contract.price,
      me: num(row.material_efficiency),
      te: num(row.time_efficiency),
      runs,
      expires: contract.expires,
      ...(contract.stationId ? { stationId: contract.stationId } : {}),
    }

    const key = String(typeId)
    const list = byBlueprint.get(key) ?? []
    list.push(listing)
    byBlueprint.set(key, list)
  }

  const byBlueprintTypeId = {}
  for (const [typeId, listings] of byBlueprint) {
    listings.sort((a, b) => a.buyout - b.buyout || a.price - b.price)
    const capped = listings.slice(0, LISTING_CAP)
    const minBuyout = capped[0]?.buyout ?? 0
    byBlueprintTypeId[typeId] = {
      count: listings.length,
      minBuyout,
      listings: capped,
    }
  }

  return { byBlueprintTypeId }
}

export function emptyContractsData() {
  const hubs = {}
  for (const hubId of Object.keys(HUB_REGION_IDS)) {
    hubs[hubId] = { byBlueprintTypeId: {} }
  }
  return {
    generatedAt: new Date().toISOString(),
    snapshotSource: 'none',
    hubs,
  }
}

export function writeContractsJson(filePath, data) {
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data, null, 2))
  renameSync(tmpPath, filePath)
}

export async function resolveEverefArchiveUrl() {
  try {
    const res = await fetch(EVEREF_INDEX_URL)
    if (!res.ok) return EVEREF_ARCHIVE_FALLBACK
    const index = await res.json()
    const files = Array.isArray(index?.files) ? index.files : []
    const latest =
      files.find((f) => f.type === 'public-contracts') ??
      files.find((f) => String(f.name).includes('public-contracts-latest'))
    return latest?.url ?? EVEREF_ARCHIVE_FALLBACK
  } catch {
    return EVEREF_ARCHIVE_FALLBACK
  }
}

export async function buildContractsFromExtractedDir(extractedDir, blueprintTypeIds, snapshotSource) {
  const contractsCsvPath = await findCsvPath(extractedDir, 'contracts.csv')
  const itemsCsvPath = await findCsvPath(extractedDir, 'contract_items.csv')
  const contractsCsv = await readCsvObjects(contractsCsvPath)
  const itemsCsv = await readCsvObjects(itemsCsvPath)

  const hubs = {}
  for (const [hubId, regionId] of Object.entries(HUB_REGION_IDS)) {
    hubs[hubId] = buildRegionBpcIndex(contractsCsv, itemsCsv, blueprintTypeIds, regionId)
  }

  return {
    generatedAt: new Date().toISOString(),
    snapshotSource: snapshotSource ?? EVEREF_ARCHIVE_FALLBACK,
    hubs,
  }
}

export function loadBlueprintTypeIds(blueprintsPath) {
  const raw = JSON.parse(readFileSync(blueprintsPath, 'utf8'))
  const blueprints = Array.isArray(raw) ? raw : raw.blueprints
  return new Set(blueprints.map((bp) => Number(bp.blueprintTypeId)).filter(Number.isFinite))
}
