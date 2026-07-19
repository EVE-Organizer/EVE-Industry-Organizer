#!/usr/bin/env node
/**
 * Rebuild public/data/map.json from official SDE position2D + Fuzzwork jumps.
 * Run: node scripts/rebuild-map.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildMapData, systemsFromSdeJsonl } from './lib/map-data.mjs'
import { loadMapSolarSystemsJsonl } from './lib/sde-jsonl.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const localZip = join(__dirname, '../tmp-sde-jsonl.zip')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

async function main() {
  const records = await loadMapSolarSystemsJsonl({
    zipPath: existsSync(localZip) ? localZip : undefined,
  })
  const systems = systemsFromSdeJsonl(records)
  console.log(`Loaded ${systems.length} k-space systems with position2D`)

  console.log('Fetching mapSolarSystemJumps...')
  const mapSolarSystemJumps = await fetchCsv(SDE_BASE, 'mapSolarSystemJumps')
  const mapData = buildMapData(systems, mapSolarSystemJumps)

  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, 'map.json')
  writeFileSync(path, JSON.stringify(mapData))
  console.log(`Wrote ${path} (${mapData.systems.length} systems, ${mapData.jumps.length} jumps)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
