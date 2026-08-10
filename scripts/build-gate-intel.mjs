#!/usr/bin/env node
/**
 * Build public/data/gateIntel.json from Fuzzwork SDE CSVs.
 * Run: node scripts/build-gate-intel.mjs
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildGateIntelData } from './lib/gate-intel-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

async function main() {
  mkdirSync(outDir, { recursive: true })
  process.stdout.write('Fetching invTypes.csv and mapDenormalize.csv…\n')
  const [invTypes, mapDenormalize] = await Promise.all([
    fetchCsv(SDE_BASE, 'invTypes'),
    fetchCsv(SDE_BASE, 'mapDenormalize'),
  ])
  const gateIntel = buildGateIntelData({ invTypes, mapDenormalize })
  const gateCount = Object.keys(gateIntel.gatesByLocationId).length
  writeFileSync(join(outDir, 'gateIntel.json'), JSON.stringify(gateIntel))
  process.stdout.write(
    `Wrote gateIntel.json (${gateCount.toLocaleString()} gates, ` +
      `${gateIntel.smartBombTypeIds.length} smartbomb types, ` +
      `${gateIntel.interdictorTypeIds.length} dictors, ${gateIntel.hicTypeIds.length} HICs)\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
