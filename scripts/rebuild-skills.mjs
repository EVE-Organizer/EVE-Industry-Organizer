#!/usr/bin/env node
/**
 * Rebuild public/data/skills.json from SDE CSVs (industry + fit-skills catalog).
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildSkillRecords } from './lib/calc-catalogs.mjs'
import { buildFittingRecords, collectFittingSkillIds } from './lib/fitting-records.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv/'

const REQUIRED_CSVS = [
  'invTypes',
  'invGroups',
  'invCategories',
  'dgmTypeAttributes',
  'industryActivitySkills',
  'invTraits',
]

async function main() {
  mkdirSync(outDir, { recursive: true })
  const csvData = {}
  for (const name of REQUIRED_CSVS) {
    console.log(`Fetching ${name}...`)
    csvData[name] = await fetchCsv(SDE_BASE, name)
  }

  const fittingTypes = buildFittingRecords(
    csvData.invTypes,
    csvData.invGroups,
    csvData.invCategories,
    csvData.dgmTypeAttributes,
    csvData.invTraits,
  )
  const skills = buildSkillRecords(csvData.invTypes, csvData.invGroups, csvData.dgmTypeAttributes, {
    activitySkills: csvData.industryActivitySkills,
    fittingSkillIds: collectFittingSkillIds(fittingTypes),
  })

  writeFileSync(join(outDir, 'skills.json'), JSON.stringify(skills, null, 2))
  console.log(`Wrote public/data/skills.json · ${skills.length.toLocaleString()} skills`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
