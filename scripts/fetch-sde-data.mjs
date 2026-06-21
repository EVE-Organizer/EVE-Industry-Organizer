#!/usr/bin/env node
/**
 * Fetches EVE SDE CSV dumps from Fuzzwork and writes JSON for the app.
 *
 * Run: node scripts/fetch-sde-data.mjs
 * Then: node scripts/rebuild-market.mjs  (or set MARKET_HISTORY_LIMIT for faster dev)
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  blueprintIconUrl,
  typeIconUrl,
  typeImageUrls,
  typeRenderUrl,
} from './lib/eve-image-urls.mjs'
import { fetchCsv } from './lib/sde-csv.mjs'
import {
  classifyTier,
  buildAttributesByType,
  isPlaceholderManufacturingRecipe,
} from './lib/blueprint-groups.mjs'
import { buildInventionMap } from './lib/invention.mjs'
import { fetchCostIndices } from './lib/market-prices.mjs'
import { buildRegionsFile } from './lib/regions.mjs'
import { buildMarketData, loadExistingMarket, writeMarketJson } from './lib/market-data.mjs'
import { createMarketBuildTask, runListr } from './lib/run-progress.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

const MANUFACTURING_ACTIVITY = 1

const HUBS = [
  { hubId: 'jita', sellStationId: 60003760, buildSystemId: 30000144, isBuildHubSystem: true },
  { hubId: 'amarr', sellStationId: 60008494, buildSystemId: 30002187 },
  { hubId: 'dodixie', sellStationId: 60011866, buildSystemId: 30002659 },
  { hubId: 'rens', sellStationId: 60004588, buildSystemId: 30002510 },
  { hubId: 'hek', sellStationId: 60005686, buildSystemId: 30002053 },
]

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
  'dgmTypeAttributes',
  'mapSolarSystems',
  'mapRegions',
  'staStations',
]

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildSkillRecords(types, groups, typeAttributes) {
  const skillGroupIds = new Set(
    groups.filter((group) => group.categoryID === '16').map((group) => group.groupID),
  )
  const attrsByType = buildAttributesByType(typeAttributes)

  return types
    .filter((type) => skillGroupIds.has(type.groupID) && type.published === '1')
    .map((type) => {
      const skillId = num(type.typeID)
      const attrs = attrsByType.get(type.typeID) ?? new Map()
      const rank = num(attrs.get('275')?.valueFloat || attrs.get('275')?.valueInt) || 1
      const prerequisites = []

      for (const [skillAttr, levelAttr] of [
        ['182', '277'],
        ['183', '278'],
        ['184', '279'],
      ]) {
        const prereqSkillId = num(attrs.get(skillAttr)?.valueFloat || attrs.get(skillAttr)?.valueInt)
        const level = num(attrs.get(levelAttr)?.valueFloat || attrs.get(levelAttr)?.valueInt)
        if (prereqSkillId > 0 && level > 0) prerequisites.push({ skillId: prereqSkillId, level })
      }

      return {
        skillId,
        name: type.typeName,
        rank,
        prerequisites,
        iconUrl: typeIconUrl(skillId),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
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

  const typeById = new Map(types.map((type) => [type.typeID, type]))
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const categoryById = new Map(categories.map((category) => [category.categoryID, category.categoryName]))
  const metaByProduct = new Map(metaTypes.map((meta) => [meta.typeID, num(meta.metaGroupID)]))

  const timeByBlueprint = new Map(
    activity
      .filter((row) => row.activityID === String(MANUFACTURING_ACTIVITY))
      .map((row) => [row.typeID, num(row.time)]),
  )

  const materialsByBlueprint = new Map()
  for (const row of materials) {
    if (row.activityID !== String(MANUFACTURING_ACTIVITY)) continue
    if (!materialsByBlueprint.has(row.typeID)) materialsByBlueprint.set(row.typeID, [])
    materialsByBlueprint.get(row.typeID).push({
      typeId: num(row.materialTypeID),
      quantity: num(row.quantity),
    })
  }

  const skillsByBlueprint = new Map()
  for (const row of skills) {
    if (row.activityID !== String(MANUFACTURING_ACTIVITY)) continue
    const skillName = skillNames.get(num(row.skillID))
    if (!skillName) continue
    if (!skillsByBlueprint.has(row.typeID)) skillsByBlueprint.set(row.typeID, {})
    skillsByBlueprint.get(row.typeID)[skillName] = num(row.level)
  }

  const blueprints = []
  for (const row of products) {
    if (row.activityID !== String(MANUFACTURING_ACTIVITY)) continue

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

  return {
    blueprints: blueprints.sort((a, b) => a.productTypeId - b.productTypeId),
    typeById,
    groupById,
    categoryById,
  }
}

function buildAllTypeRecords(types, groupById, categoryById) {
  return types
    .filter((type) => type.published === '1')
    .map((type) => {
      const typeId = num(type.typeID)
      const group = groupById.get(type.groupID)
      const urls = typeImageUrls(typeId)
      return {
        typeId,
        name: type.typeName,
        group: group?.groupName ?? 'Unknown',
        category: categoryById.get(group?.categoryID ?? '') ?? 'Unknown',
        volume: num(type.volume),
        iconUrl: urls.iconUrl,
        renderUrl: urls.renderUrl,
        bpIconUrl: urls.bpIconUrl,
      }
    })
    .sort((a, b) => a.typeId - b.typeId)
}

function buildHubSystems(hubs, stations, systems) {
  const stationById = new Map(stations.map((station) => [station.stationID, station]))
  const systemById = new Map(systems.map((system) => [system.solarSystemID, system]))
  const seen = new Set()

  return hubs
    .flatMap((hub) => {
      const sellSystemId = stationById.get(String(hub.sellStationId))?.solarSystemID
      return [sellSystemId, String(hub.buildSystemId)].filter(Boolean)
    })
    .filter((systemId) => {
      if (seen.has(systemId)) return false
      seen.add(systemId)
      return true
    })
    .map((systemId) => {
      const system = systemById.get(systemId)
      if (!system) return null
      const hub = hubs.find(
        (entry) =>
          entry.buildSystemId === num(systemId) ||
          stationById.get(String(entry.sellStationId))?.solarSystemID === systemId,
      )
      return {
        systemId: num(system.solarSystemID),
        name: system.solarSystemName,
        regionId: num(system.regionID),
        security: num(system.security),
        hubId: hub?.hubId,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function buildHubStations(hubs, stations, systems, regions) {
  const stationById = new Map(stations.map((station) => [station.stationID, station]))
  const systemById = new Map(systems.map((system) => [system.solarSystemID, system]))
  const regionById = new Map(regions.map((region) => [region.regionID, region.regionName]))

  return hubs
    .flatMap((hub) => {
      const sellStation = stationById.get(String(hub.sellStationId))
      const buildSystem = systemById.get(String(hub.buildSystemId))
      const buildStation =
        [...stationById.values()].find(
          (station) =>
            station.solarSystemID === String(hub.buildSystemId) &&
            station.stationName.toLowerCase().includes('assembly plant'),
        ) ?? null

      const entries = []
      if (sellStation) entries.push({ station: sellStation, hub, isBuildHub: false })
      if (buildStation && buildStation.stationID !== sellStation?.stationID) {
        entries.push({ station: buildStation, hub, isBuildHub: hub.isBuildHubSystem ?? false })
      } else if (buildSystem && hub.isBuildHubSystem && sellStation?.solarSystemID !== buildSystem.solarSystemID) {
        entries.push({
          station: {
            stationID: sellStation?.stationID ?? hub.sellStationId,
            stationName: `${buildSystem.solarSystemName} (build system)`,
            solarSystemID: buildSystem.solarSystemID,
            regionID: buildSystem.regionID,
            security: buildSystem.security,
          },
          hub,
          isBuildHub: true,
        })
      }
      return entries
    })
    .map(({ station, hub, isBuildHub }) => {
      const system = systemById.get(station.solarSystemID)
      return {
        stationId: num(station.stationID),
        name: station.stationName,
        systemId: num(station.solarSystemID),
        systemName: system?.solarSystemName ?? station.stationName,
        regionId: num(station.regionID),
        regionName: regionById.get(station.regionID) ?? 'Unknown',
        security: num(station.security),
        hubId: hub.hubId,
        ...(isBuildHub ? { isBuildHub: true } : {}),
      }
    })
}

async function main() {
  mkdirSync(outDir, { recursive: true })

  const ctx = {}
  const marketPath = join(outDir, 'market.json')
  const existingMarket = loadExistingMarket(marketPath)
  const skipHistory =
    process.env.MARKET_SKIP_HISTORY === '1' || process.env.MARKET_SKIP_HISTORY === 'true'
  const historyLimit = process.env.MARKET_HISTORY_LIMIT
    ? Number(process.env.MARKET_HISTORY_LIMIT)
    : Infinity
  const historyConcurrency = process.env.MARKET_HISTORY_CONCURRENCY
    ? Number(process.env.MARKET_HISTORY_CONCURRENCY)
    : 10
  const historyTtlMs = process.env.MARKET_HISTORY_TTL_HOURS
    ? Number(process.env.MARKET_HISTORY_TTL_HOURS) * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000
  const marketOptions = { skipHistory, historyLimit, historyConcurrency, historyTtlMs }

  await runListr(
    [
      {
        title: 'Download SDE CSVs',
        task: async (_, task) => {
          const csvData = {}
          for (let i = 0; i < REQUIRED_CSVS.length; i++) {
            const name = REQUIRED_CSVS[i]
            task.title = `Download SDE CSVs (${i + 1}/${REQUIRED_CSVS.length}) · ${name}`
            csvData[name] = await fetchCsv(SDE_BASE, name, { silent: true })
          }
          ctx.csvData = csvData
          task.title = `Download SDE CSVs · ${REQUIRED_CSVS.length} files`
        },
      },
      {
        title: 'Build blueprint registry',
        task: async (_, task) => {
          const types = ctx.csvData.invTypes
          const groups = ctx.csvData.invGroups
          const categories = ctx.csvData.invCategories
          const skillNames = new Map(
            types
              .filter(
                (type) =>
                  groups.find((group) => group.groupID === type.groupID)?.categoryID === '16',
              )
              .map((type) => [num(type.typeID), type.typeName]),
          )

          ctx.skills = buildSkillRecords(types, groups, ctx.csvData.dgmTypeAttributes)
          const { blueprints, typeById, groupById, categoryById } = buildBlueprintRecords({
            activity: ctx.csvData.industryActivity,
            products: ctx.csvData.industryActivityProducts,
            materials: ctx.csvData.industryActivityMaterials,
            skills: ctx.csvData.industryActivitySkills,
            probabilities: ctx.csvData.industryActivityProbabilities,
            types,
            groups,
            categories,
            metaTypes: ctx.csvData.invMetaTypes,
            skillNames,
          })

          ctx.blueprints = blueprints
          ctx.typeRecords = buildAllTypeRecords(types, groupById, categoryById)
          ctx.systems = buildHubSystems(HUBS, ctx.csvData.staStations, ctx.csvData.mapSolarSystems)
          ctx.stations = buildHubStations(
            HUBS,
            ctx.csvData.staStations,
            ctx.csvData.mapSolarSystems,
            ctx.csvData.mapRegions,
          )
          task.title = `Build blueprint registry · ${blueprints.length.toLocaleString()} blueprints`
        },
      },
      {
        title: 'Cost indices and regions',
        task: async (_, task) => {
          const costIndices = await fetchCostIndices()
          ctx.regions = buildRegionsFile(
            ctx.csvData.mapSolarSystems,
            ctx.csvData.mapRegions,
            costIndices,
          )
          task.title = `Cost indices and regions · ${ctx.regions.regions.length} regions`
        },
      },
      createMarketBuildTask(ctx, {
        skipHistory: marketOptions.skipHistory,
        runBuild: (onProgress) =>
          buildMarketData(ctx.blueprints, ctx.regions, ctx.stations, {
            ...marketOptions,
            existingMarket,
            onProgress,
            onCheckpoint: (partial) => writeMarketJson(marketPath, partial),
          }),
      }),
      {
        title: 'Write JSON files',
        task: async (_, task) => {
          const registry = {
            generatedAt: new Date().toISOString(),
            blueprints: ctx.blueprints,
          }
          const write = (name, data) =>
            writeFileSync(join(outDir, name), JSON.stringify(data, null, 2))

          write('types.json', { generatedAt: new Date().toISOString(), types: ctx.typeRecords })
          write('blueprints.json', registry)
          write('regions.json', ctx.regions)
          writeMarketJson(marketPath, ctx.market)
          write('skills.json', ctx.skills)
          write('systems.json', ctx.systems)
          write('stations.json', ctx.stations)

          task.title = `Write JSON files · ${ctx.blueprints.length.toLocaleString()} blueprints, ${ctx.typeRecords.length.toLocaleString()} types`
        },
      },
    ],
    {
      header: 'EVE Industry Organizer · fetch SDE and market data',
      ctx,
    },
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
