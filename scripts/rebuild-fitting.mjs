#!/usr/bin/env node
/**
 * Rebuild public/data/fitting.json from SDE CSVs (ships, modules, charges).
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildFittingRecords } from './lib/fitting-records.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

const REQUIRED_CSVS = ['invTypes', 'invGroups', 'invCategories', 'dgmTypeAttributes', 'invTraits']

async function main() {
  mkdirSync(outDir, { recursive: true })
  const csvData = {}
  for (const name of REQUIRED_CSVS) {
    console.log(`Fetching ${name}...`)
    csvData[name] = await fetchCsv(SDE_BASE, name)
  }

  const types = buildFittingRecords(
    csvData.invTypes,
    csvData.invGroups,
    csvData.invCategories,
    csvData.dgmTypeAttributes,
    csvData.invTraits,
  )
  const payload = { generatedAt: new Date().toISOString(), types }
  writeFileSync(join(outDir, 'fitting.json'), JSON.stringify(payload))
  console.log(`Wrote public/data/fitting.json · ${types.length.toLocaleString()} types`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
