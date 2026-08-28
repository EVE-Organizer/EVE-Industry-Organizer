#!/usr/bin/env node
/**
 * Build public/data/industry-structures.json from EVE Ref structure scrape.
 * Used to list engineering complexes and refineries within N jumps.
 *
 * Run: node scripts/rebuild-structures.mjs
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../public/data/industry-structures.json')
const EVEREF_URL = 'https://data.everef.net/structures/structures-latest.v2.json'
const TYPE_IDS = new Set([35825, 35826, 35827, 35835, 35836])

async function main() {
  const res = await fetch(EVEREF_URL)
  if (!res.ok) throw new Error(`EveRef structures failed: ${res.status}`)
  const dump = await res.json()
  const structures = []
  for (const row of Object.values(dump)) {
    if (!row || !TYPE_IDS.has(row.type_id)) continue
    if (!row.structure_id || !row.solar_system_id || !row.name) continue
    structures.push({
      id: row.structure_id,
      name: row.name,
      solarSystemId: row.solar_system_id,
      typeId: row.type_id,
    })
  }
  structures.sort((a, b) => a.name.localeCompare(b.name))
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), structures }),
  )
  console.log(`Wrote ${structures.length} industry structures to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
