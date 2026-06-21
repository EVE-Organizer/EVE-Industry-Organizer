#!/usr/bin/env node
/**
 * Rebuild public/data/blueprints.json from SDE CSVs (includes T2 invention data).
 * Does not touch market.json. Run fetch-data or rebuild-market for prices.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { fetchCsv } from './lib/sde-csv.mjs'
import {
  classifyTier,
  isPlaceholderManufacturingRecipe,
} from './lib/blueprint-groups.mjs'
import { buildInventionMap } from './lib/invention.mjs'
import {
  blueprintIconUrl,
  typeIconUrl,
  typeRenderUrl,
} from './lib/eve-image-urls.mjs'

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

const MANUFACTURING = 1

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildBlueprintRecords(tables) {
  const {
    activity,
    products,
    materials,
    skills,
    probabilities,
    types,
    groups,
    categories,
    metaTypes,
    skillNames,
  } = tables

  const inventionByT2 = buildInventionMap({ products, materials, probabilities })

  const typeById = new Map(types.map((t) => [t.typeID, t]))
  const groupById = new Map(groups.map((g) => [g.groupID, g]))
  const categoryById = new Map(categories.map((c) => [c.categoryID, c]))
  const metaByProduct = new Map(metaTypes.map((m) => [m.typeID, num(m.metaGroupID)]))

  const timeByBlueprint = new Map()
  for (const row of activity) {
    if (row.activityID === String(MANUFACTURING)) {
      timeByBlueprint.set(row.typeID, num(row.time))
    }
  }

  const materialsByBlueprint = new Map()
  for (const row of materials) {
    if (row.activityID !== String(MANUFACTURING)) continue
    if (!materialsByBlueprint.has(row.typeID)) materialsByBlueprint.set(row.typeID, [])
    materialsByBlueprint.get(row.typeID).push({
      typeId: num(row.materialTypeID),
      quantity: num(row.quantity),
    })
  }

  const skillsByBlueprint = new Map()
  for (const row of skills) {
    if (row.activityID !== String(MANUFACTURING)) continue
    const skillName = skillNames.get(num(row.skillID))
    if (!skillName) continue
    if (!skillsByBlueprint.has(row.typeID)) skillsByBlueprint.set(row.typeID, {})
    skillsByBlueprint.get(row.typeID)[skillName] = num(row.level)
  }

  const blueprints = []
  for (const row of products) {
    if (row.activityID !== String(MANUFACTURING)) continue
    const blueprintTypeId = num(row.typeID)
    const productTypeId = num(row.productTypeID)
    const product = typeById.get(String(productTypeId))
    if (!product || product.published !== '1') continue
    const productGroup = groupById.get(product.groupID)
    if (!productGroup) continue

    const metaGroupId = metaByProduct.get(String(productTypeId)) ?? 1
    const recipeMaterials = materialsByBlueprint.get(row.typeID) ?? []
    if (isPlaceholderManufacturingRecipe(recipeMaterials)) continue

    const tier = classifyTier(metaGroupId)
    const invention = tier === 't2' ? inventionByT2.get(blueprintTypeId) : undefined

    blueprints.push({
      blueprintTypeId,
      productTypeId,
      productQuantity: num(row.quantity),
      manufacturingTime: timeByBlueprint.get(row.typeID) ?? 0,
      materials: recipeMaterials,
      requiredSkills: skillsByBlueprint.get(row.typeID) ?? {},
      tier,
      productGroup: productGroup.groupName,
      bpIconUrl: blueprintIconUrl(blueprintTypeId),
      productIconUrl: typeIconUrl(productTypeId),
      productRenderUrl: typeRenderUrl(productTypeId),
      ...(invention ? { invention } : {}),
    })
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

  const blueprints = buildBlueprintRecords({
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

  const t2 = blueprints.filter((b) => b.tier === 't2')
  const withInv = t2.filter((b) => b.invention)
  console.log(`Built ${blueprints.length} blueprints, T2 with invention: ${withInv.length}/${t2.length}`)

  const registry = { generatedAt: new Date().toISOString(), blueprints }
  writeFileSync(join(outDir, 'blueprints.json'), JSON.stringify(registry, null, 2))
  console.log('Wrote public/data/blueprints.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
