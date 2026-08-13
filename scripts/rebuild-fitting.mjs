#!/usr/bin/env node
/**
 * Builds public/data/fitting.json (PG/CPU + required skills) from Fuzzwork SDE CSVs.
 * Uses existing types.json for names/categories.
 *
 * Run: node scripts/rebuild-fitting.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildFittingRecords } from './lib/fitting-records.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

async function main() {
  mkdirSync(outDir, { recursive: true })
  const typesRaw = JSON.parse(readFileSync(join(outDir, 'types.json'), 'utf8'))
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types

  console.log('Fetching dgmTypeAttributes...')
  const typeAttributes = await fetchCsv(SDE_BASE, 'dgmTypeAttributes')
  console.log('Fetching dgmTypeEffects...')
  const typeEffects = await fetchCsv(SDE_BASE, 'dgmTypeEffects')

  const items = buildFittingRecords(typeAttributes, typeEffects, types)
  const payload = { generatedAt: new Date().toISOString(), items }
  writeFileSync(join(outDir, 'fitting.json'), JSON.stringify(payload))
  console.log(
    `Wrote public/data/fitting.json · ${Object.keys(items).length.toLocaleString()} types`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
