#!/usr/bin/env node
/**
 * Builds public/data/mining.json from types.json + Fuzzwork SDE CSVs
 * (invTypeMaterials, invTypes for portionSize).
 *
 * Run: node scripts/rebuild-mining.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

const ORE_MINERAL_IDS = [34, 35, 36, 37, 38, 39, 40]

/** Classic belt ore security (base name → spaces). Variants inherit via group. */
const ORE_FOUND_IN = {
  Veldspar: ['highsec'],
  Scordite: ['highsec'],
  Pyroxeres: ['highsec', 'lowsec'],
  Plagioclase: ['highsec', 'lowsec'],
  Omber: ['lowsec', 'nullsec'],
  Kernite: ['lowsec', 'nullsec', 'wormhole'],
  Jaspet: ['lowsec', 'nullsec'],
  Hemorphite: ['lowsec', 'nullsec'],
  Hedbergite: ['lowsec', 'nullsec'],
  Gneiss: ['nullsec', 'wormhole'],
  DarkOchre: ['nullsec', 'wormhole'],
  'Dark Ochre': ['nullsec', 'wormhole'],
  Crokite: ['nullsec', 'wormhole'],
  Bistot: ['nullsec', 'wormhole'],
  Arkonor: ['nullsec', 'wormhole'],
  Spodumain: ['nullsec', 'wormhole'],
  Mercoxit: ['nullsec'],
  Bezdnacine: ['nullsec'],
  Rakovene: ['nullsec'],
  Talassonite: ['nullsec'],
}

const ICE_FOUND_IN = {
  'Blue Ice': ['highsec'],
  'Clear Icicle': ['highsec'],
  'Glacial Mass': ['highsec'],
  'White Glaze': ['highsec'],
  'Glare Crust': ['lowsec'],
  'Dark Glitter': ['nullsec'],
  Gelidus: ['nullsec'],
  Krystallos: ['nullsec'],
  'Azure Ice': ['highsec'],
  'Crystalline Icicle': ['highsec'],
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseFoundInFromDescription(description) {
  if (!description) return []
  const text = String(description).toLowerCase()
  const found = new Set()
  if (/high\s*sec|high security/.test(text)) found.add('highsec')
  if (/low\s*sec|low security/.test(text)) found.add('lowsec')
  if (/null\s*sec|null security|0\.0/.test(text)) found.add('nullsec')
  if (/wormhole/.test(text)) found.add('wormhole')
  return [...found]
}

function resolveFoundIn(name, group, subtype, description) {
  if (subtype === 'gas') return ['wormhole', 'nullsec', 'lowsec']
  if (subtype === 'moon') return ['nullsec']

  const curated =
    subtype === 'ice'
      ? ICE_FOUND_IN[name] ?? ICE_FOUND_IN[group]
      : ORE_FOUND_IN[name] ?? ORE_FOUND_IN[group]

  if (curated?.length) return curated

  const fromDesc = parseFoundInFromDescription(description)
  if (fromDesc.length) return fromDesc

  if (subtype === 'ice') return ['highsec', 'lowsec', 'nullsec']
  return ['highsec', 'lowsec', 'nullsec', 'wormhole']
}

function classifySubtype(type) {
  if (type.category === 'Celestial' && type.group === 'Harvestable Cloud') return 'gas'
  if (type.category !== 'Asteroid') return null
  if (type.group === 'Ice') return 'ice'
  if (/Moon Asteroids/.test(type.group)) return 'moon'
  if (
    type.group === 'Temporal Resources' ||
    type.group === 'AIR Ore Asteroid Resources' ||
    type.group === 'Empire Asteroids'
  ) {
    return null
  }
  return 'ore'
}

function isCompressedName(name) {
  return /compress/i.test(name)
}

/**
 * Map raw mineable → compressed type.
 * Ore/ice/moon keep the same group; gas compresses into group "Compressed Gas".
 */
function resolveCompressedTypeId(type, byName) {
  const compressed = byName.get(`Compressed ${type.name}`)
  if (!compressed) return null
  if (compressed.group === type.group) return compressed.typeId
  if (type.group === 'Harvestable Cloud' && compressed.group === 'Compressed Gas') {
    return compressed.typeId
  }
  return null
}

/** IV-Grade variants and similar types rarely trade as raw ore/ice at hubs. */
function isLowTradeVariant(type, subtype) {
  if (subtype !== 'ore' && subtype !== 'ice') return false
  return / IV-Grade$/.test(type.name)
}

async function main() {
  mkdirSync(outDir, { recursive: true })

  const typesRaw = JSON.parse(readFileSync(join(outDir, 'types.json'), 'utf8'))
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types

  process.stdout.write('Fetching invTypeMaterials.csv…\n')
  const materialsCsv = await fetchCsv(SDE_BASE, 'invTypeMaterials', { silent: true })
  process.stdout.write('Fetching invTypes.csv (portionSize)…\n')
  const invTypes = await fetchCsv(SDE_BASE, 'invTypes', { silent: true })

  const portionByType = new Map()
  for (const row of invTypes) {
    portionByType.set(num(row.typeID), Math.max(1, num(row.portionSize) || 1))
  }

  const materialsByType = new Map()
  for (const row of materialsCsv) {
    const typeId = num(row.typeID)
    const materialTypeId = num(row.materialTypeID)
    const quantity = num(row.quantity)
    if (typeId <= 0 || materialTypeId <= 0 || quantity <= 0) continue
    let list = materialsByType.get(typeId)
    if (!list) {
      list = []
      materialsByType.set(typeId, list)
    }
    list.push({ typeId: materialTypeId, quantityPerBatch: quantity })
  }

  const byName = new Map()
  for (const type of types) {
    byName.set(type.name, type)
  }

  const candidates = []
  for (const type of types) {
    if (isCompressedName(type.name)) continue
    const subtype = classifySubtype(type)
    if (!subtype) continue
    if (isLowTradeVariant(type, subtype)) continue
    candidates.push({ type, subtype })
  }

  const items = []
  for (const { type, subtype } of candidates) {
    const portionSize = portionByType.get(type.typeId) ?? 100
    const reprocess = materialsByType.get(type.typeId) ?? []
    const compressedTypeId = resolveCompressedTypeId(type, byName)

    // Gas: sell as harvested; skip if no marketable volume
    if (subtype === 'gas' && !(type.volume > 0)) continue
    // Ore/ice/moon without reprocess and without compress are not useful for ranking
    if (subtype !== 'gas' && reprocess.length === 0 && compressedTypeId == null) continue

    items.push({
      typeId: type.typeId,
      name: type.name,
      group: type.group,
      volume: type.volume,
      portionSize,
      subtype,
      foundIn: resolveFoundIn(type.name, type.group, subtype, type.description),
      compressedTypeId,
      reprocess,
      iconUrl: type.iconUrl,
    })
  }

  items.sort((a, b) => a.name.localeCompare(b.name) || a.typeId - b.typeId)

  const focusOutputs = {
    ore: ORE_MINERAL_IDS.map((typeId) => {
      const t = types.find((x) => x.typeId === typeId)
      return { typeId, name: t?.name ?? `Type ${typeId}` }
    }),
    moon: collectFocusOutputs(items, 'moon', types),
    ice: collectFocusOutputs(items, 'ice', types),
    gas: [],
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    defaults: {
      m3PerHr: 40000,
      reprocessYield: 0.5,
    },
    focusOutputs,
    items,
  }

  writeFileSync(join(outDir, 'mining.json'), JSON.stringify(payload, null, 2))
  process.stdout.write(
    `Wrote mining.json · ${items.length} items` +
      ` (ore ${countSubtype(items, 'ore')}, moon ${countSubtype(items, 'moon')},` +
      ` ice ${countSubtype(items, 'ice')}, gas ${countSubtype(items, 'gas')})\n`,
  )
}

function collectFocusOutputs(items, subtype, types) {
  const ids = new Set()
  for (const item of items) {
    if (item.subtype !== subtype) continue
    for (const mat of item.reprocess) ids.add(mat.typeId)
  }
  const typeById = new Map(types.map((t) => [t.typeId, t]))
  return [...ids]
    .map((typeId) => ({
      typeId,
      name: typeById.get(typeId)?.name ?? `Type ${typeId}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function countSubtype(items, subtype) {
  return items.filter((i) => i.subtype === subtype).length
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
