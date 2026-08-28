#!/usr/bin/env node
/**
 * Rebuild public/data/types.json from SDE CSVs (includes item descriptions).
 * Materials + products from published manufacturing/reaction blueprints only.
 * Does not touch market.json. Run rebuild-market for prices.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildCalcTypeRecords } from './lib/calc-catalogs.mjs'
import { buildTypeLookupMaps } from './lib/type-records.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv/'

const REQUIRED_CSVS = ['invTypes', 'invGroups', 'invCategories']

function loadBlueprints() {
  const path = join(outDir, 'blueprints.json')
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  const blueprints = Array.isArray(raw) ? raw : raw.blueprints
  if (!Array.isArray(blueprints)) {
    throw new Error('blueprints.json must contain a blueprints array')
  }
  return blueprints
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const csvData = {}
  for (const name of REQUIRED_CSVS) {
    console.log(`Fetching ${name}...`)
    csvData[name] = await fetchCsv(SDE_BASE, name)
  }

  const { groupById, categoryById } = buildTypeLookupMaps(csvData.invGroups, csvData.invCategories)
  const types = buildCalcTypeRecords(csvData.invTypes, groupById, categoryById, loadBlueprints())
  const withDescription = types.filter((type) => type.description).length

  const payload = { generatedAt: new Date().toISOString(), types }
  writeFileSync(join(outDir, 'types.json'), JSON.stringify(payload, null, 2))
  console.log(
    `Wrote public/data/types.json · ${types.length.toLocaleString()} types, ${withDescription.toLocaleString()} with descriptions`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
