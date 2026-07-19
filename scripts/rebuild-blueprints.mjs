#!/usr/bin/env node
/**
 * Rebuild public/data/blueprints.json from SDE CSVs (includes T2 invention + reaction formulas).
 * Does not touch market.json. Run fetch-data or rebuild-market for prices.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildBlueprintRecords } from './lib/blueprint-records.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv/'

const REQUIRED_CSVS = [
  'industryActivity',
  'industryActivityProducts',
  'industryActivityMaterials',
  'industryActivitySkills',
  'industryActivityProbabilities',
  'invTypes',
  'invGroups',
  'invCategories',
  'invMetaTypes',
]

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const csvData = {}
  for (const name of REQUIRED_CSVS) {
    console.log(`Fetching ${name}...`)
    csvData[name] = await fetchCsv(SDE_BASE, name)
  }

  const types = csvData.invTypes
  const groups = csvData.invGroups
  const skillNames = new Map(
    types
      .filter(
        (type) =>
          groups.find((group) => group.groupID === type.groupID)?.categoryID === '16',
      )
      .map((type) => [num(type.typeID), type.typeName]),
  )

  const { blueprints } = buildBlueprintRecords({
    activity: csvData.industryActivity,
    products: csvData.industryActivityProducts,
    materials: csvData.industryActivityMaterials,
    skills: csvData.industryActivitySkills,
    probabilities: csvData.industryActivityProbabilities,
    types,
    groups,
    categories: csvData.invCategories,
    metaTypes: csvData.invMetaTypes,
    skillNames,
  })

  const mfg = blueprints.filter((b) => b.kind === 'manufacturing')
  const rxn = blueprints.filter((b) => b.kind === 'reaction')
  const t2 = mfg.filter((b) => b.tier === 't2')
  const withInv = t2.filter((b) => b.invention)
  console.log(
    `Built ${blueprints.length} recipes (${mfg.length} manufacturing, ${rxn.length} reactions), T2 with invention: ${withInv.length}/${t2.length}`,
  )

  const registry = { generatedAt: new Date().toISOString(), blueprints }
  writeFileSync(join(outDir, 'blueprints.json'), JSON.stringify(registry, null, 2))
  console.log('Wrote public/data/blueprints.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
