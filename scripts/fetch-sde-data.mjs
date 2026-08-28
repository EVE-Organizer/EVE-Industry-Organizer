#!/usr/bin/env node
/**
 * Fetches EVE SDE CSV dumps from Fuzzwork and writes JSON for the app.
 *
 * Run: node scripts/fetch-sde-data.mjs
 * Then: node scripts/rebuild-market.mjs  (or set MARKET_HISTORY_LIMIT for faster dev)
 *
 * CI daily schedule uses MARKET_SKIP_HISTORY=1 (prices + SDE; history preserved).
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  typeIconUrl,
} from './lib/eve-image-urls.mjs'
import { fetchCsv } from './lib/sde-csv.mjs'
import { buildAttributesByType } from './lib/blueprint-groups.mjs'
import { buildBlueprintRecords } from './lib/blueprint-records.mjs'
import { fetchCostIndices } from './lib/market-prices.mjs'
import { buildRegionsFile } from './lib/regions.mjs'
import { buildMarketData, loadExistingMarket, writeMarketJson } from './lib/market-data.mjs'
import {
  createMarketBuildTask,
  runListr,
  updateTaskProgress,
  startElapsedTicker,
  formatDuration,
  isInteractive,
} from './lib/run-progress.mjs'
import { HUBS, resolveSellSystemId } from './lib/hubs.mjs'
import { buildAllTypeRecords } from './lib/type-records.mjs'
import { buildFittingRecords } from './lib/fitting-records.mjs'
import { buildMapData, systemsFromSdeJsonl } from './lib/map-data.mjs'
import { buildGateIntelData } from './lib/gate-intel-data.mjs'
import { loadMapSolarSystemsJsonl } from './lib/sde-jsonl.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data')
const localSdeZip = join(__dirname, '../tmp-sde-jsonl.zip')
const SDE_BASE = 'https://www.fuzzwork.co.uk/dump/latest/csv'

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
  'invTraits',
  'mapSolarSystems',
  'mapSolarSystemJumps',
  'mapRegions',
  'mapDenormalize',
  'staStations',
]

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dogmaValue(attrs, attributeId) {
  const row = attrs.get(String(attributeId)) ?? attrs.get(attributeId)
  return num(row?.valueFloat || row?.valueInt)
}

function buildSkillRecords(types, groups, typeAttributes) {
  const skillGroupIds = new Set(
    groups.filter((group) => group.categoryID === '16').map((group) => group.groupID),
  )
  const attrsByType = buildAttributesByType(typeAttributes)
  const attrTypeToKey = {
    164: 'charisma',
    165: 'intelligence',
    166: 'memory',
    167: 'perception',
    168: 'willpower',
  }

  return types
    .filter((type) => skillGroupIds.has(type.groupID) && type.published === '1')
    .map((type) => {
      const skillId = num(type.typeID)
      const attrs =
        attrsByType.get(type.typeID) ??
        attrsByType.get(String(skillId)) ??
        attrsByType.get(skillId) ??
        new Map()
      const rank = dogmaValue(attrs, 275) || 1
      const primaryAttribute = attrTypeToKey[dogmaValue(attrs, 180)]
      const secondaryAttribute = attrTypeToKey[dogmaValue(attrs, 181)]
      const prerequisites = []

      for (const [skillAttr, levelAttr] of [
        [182, 277],
        [183, 278],
        [184, 279],
      ]) {
        const prereqSkillId = dogmaValue(attrs, skillAttr)
        const level = dogmaValue(attrs, levelAttr)
        if (prereqSkillId > 0 && level > 0) prerequisites.push({ skillId: prereqSkillId, level })
      }

      return {
        skillId,
        name: type.typeName,
        rank,
        prerequisites,
        ...(primaryAttribute ? { primaryAttribute } : {}),
        ...(secondaryAttribute ? { secondaryAttribute } : {}),
        iconUrl: typeIconUrl(skillId),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function buildHubSystems(hubs, stations, systems) {
  const stationById = new Map(stations.map((station) => [station.stationID, station]))
  const systemById = new Map(systems.map((system) => [system.solarSystemID, system]))
  const seen = new Set()

  return hubs
    .flatMap((hub) => {
      const sellSystemId = resolveSellSystemId(hub, stationById)
      return [sellSystemId, hub.buildSystemId].filter(Boolean)
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
          resolveSellSystemId(entry, stationById) === num(systemId),
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

/**
 * Build the full industry-active systems list for systems.json.
 * Includes every system with a manufacturing cost index from ESI, plus all hub
 * sell/build systems. Hub systems without a cost index get costIndex = undefined.
 */
function buildIndustrySystems(hubs, stations, mapSolarSystems, costIndices) {
  const mfgIndices = costIndices.manufacturing ?? costIndices
  const rxnIndices = costIndices.reaction ?? new Map()
  const copyIndices = costIndices.copying ?? new Map()
  const inventIndices = costIndices.invention ?? new Map()

  const stationById = new Map(stations.map((s) => [s.stationID, s]))
  const systemById = new Map(mapSolarSystems.map((s) => [num(s.solarSystemID), s]))

  const hubSystemIds = new Set(
    hubs.flatMap((hub) => {
      const sellSystemId = resolveSellSystemId(hub, stationById)
      return [hub.buildSystemId, sellSystemId].filter(Boolean)
    }),
  )

  const hubIdBySystemId = new Map()
  for (const hub of hubs) {
    const sellSystemId = resolveSellSystemId(hub, stationById)
    hubIdBySystemId.set(hub.buildSystemId, hub.hubId)
    if (sellSystemId) hubIdBySystemId.set(sellSystemId, hub.hubId)
  }

  const systemIds = new Set([...mfgIndices.keys(), ...rxnIndices.keys(), ...hubSystemIds])
  const results = []

  for (const systemId of systemIds) {
    const raw = systemById.get(systemId)
    if (!raw) continue
    const entry = {
      systemId,
      name: raw.solarSystemName,
      regionId: num(raw.regionID),
      security: num(raw.security),
    }
    const costIndex = mfgIndices.get(systemId)
    if (costIndex !== undefined) entry.costIndex = costIndex
    const reactionCostIndex = rxnIndices.get(systemId)
    if (reactionCostIndex !== undefined) entry.reactionCostIndex = reactionCostIndex
    const copyingCostIndex = copyIndices.get(systemId)
    if (copyingCostIndex !== undefined) entry.copyingCostIndex = copyingCostIndex
    const inventionCostIndex = inventIndices.get(systemId)
    if (inventionCostIndex !== undefined) entry.inventionCostIndex = inventionCostIndex
    const hubId = hubIdBySystemId.get(systemId)
    if (hubId) entry.hubId = hubId
    results.push(entry)
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

async function runPool(items, concurrency, worker) {
  if (!items.length) return
  let next = 0
  async function runWorker() {
    while (true) {
      const index = next++
      if (index >= items.length) break
      await worker(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  )
}

function buildHubStations(hubs, stations, systems, regions) {
  const stationById = new Map(stations.map((station) => [station.stationID, station]))
  const systemById = new Map(systems.map((system) => [system.solarSystemID, system]))
  const regionById = new Map(regions.map((region) => [region.regionID, region.regionName]))

  return hubs
    .flatMap((hub) => {
      const sellStation = hub.sellStationId
        ? stationById.get(String(hub.sellStationId))
        : null
      const sellSystemId = resolveSellSystemId(hub, stationById)
      const buildSystem = systemById.get(String(hub.buildSystemId))
      const buildStation =
        [...stationById.values()].find(
          (station) =>
            station.solarSystemID === String(hub.buildSystemId) &&
            station.stationName.toLowerCase().includes('assembly plant'),
        ) ?? null

      const entries = []
      if (sellStation) {
        entries.push({ station: sellStation, hub, isBuildHub: false })
      } else if (sellSystemId) {
        const system = systemById.get(String(sellSystemId))
        entries.push({
          station: {
            stationID: '0',
            stationName: hub.sellStationName ?? system?.solarSystemName ?? hub.hubId,
            solarSystemID: String(sellSystemId),
            regionID: String(hub.regionId ?? system?.regionID),
            security: system?.security ?? '0',
          },
          hub,
          isBuildHub: hub.buildSystemId === sellSystemId,
        })
      }
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
          const total = REQUIRED_CSVS.length
          const startedAt = Date.now()
          let completed = 0
          await runPool(REQUIRED_CSVS, 6, async (name) => {
            csvData[name] = await fetchCsv(SDE_BASE, name, { silent: true })
            completed++
            updateTaskProgress(task, `Download SDE CSVs · ${name}`, completed, total, startedAt)
          })
          ctx.csvData = csvData
          task.title = `Download SDE CSVs · ${total} files · ${formatDuration(Date.now() - startedAt)}`
        },
      },
      {
        title: 'Build blueprint registry',
        task: async (_, task) => {
          const stopElapsed = startElapsedTicker(task, 'Build blueprint registry')
          try {
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
          ctx.fittingTypes = buildFittingRecords(
            types,
            groups,
            categories,
            ctx.csvData.dgmTypeAttributes,
            ctx.csvData.invTraits,
          )
          ctx.typeRecords = buildAllTypeRecords(
            types,
            groupById,
            categoryById,
            blueprints.map((bp) => bp.blueprintTypeId),
          )
          ctx.stations = buildHubStations(
            HUBS,
            ctx.csvData.staStations,
            ctx.csvData.mapSolarSystems,
            ctx.csvData.mapRegions,
          )
          task.title = `Build blueprint registry · ${blueprints.length.toLocaleString()} blueprints`
          } finally {
            stopElapsed()
          }
        },
      },
      {
        title: 'Cost indices and regions',
        task: async (_, task) => {
          const stopElapsed = startElapsedTicker(task, 'Cost indices and regions')
          try {
          const costIndices = await fetchCostIndices()
          ctx.regions = buildRegionsFile(
            ctx.csvData.mapSolarSystems,
            ctx.csvData.mapRegions,
            costIndices,
          )
          ctx.systems = buildIndustrySystems(
            HUBS,
            ctx.csvData.staStations,
            ctx.csvData.mapSolarSystems,
            costIndices,
          )
          ctx.mapSolarSystemsJsonl = await loadMapSolarSystemsJsonl({
            zipPath: existsSync(localSdeZip) ? localSdeZip : undefined,
            cacheZipPath: localSdeZip,
          })
          ctx.mapSystems = systemsFromSdeJsonl(ctx.mapSolarSystemsJsonl)
          ctx.mapData = buildMapData(ctx.mapSystems, ctx.csvData.mapSolarSystemJumps)
          ctx.gateIntel = buildGateIntelData({
            invTypes: ctx.csvData.invTypes,
            mapDenormalize: ctx.csvData.mapDenormalize,
          })
          task.title = `Cost indices and regions · ${ctx.regions.regions.length} regions, ${ctx.systems.length} industry systems`
          } finally {
            stopElapsed()
          }
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
            writeFileSync(
              join(outDir, name),
              JSON.stringify(data, null, name === 'fitting.json' ? 0 : 2),
            )

          const outputs = [
            ['types.json', { generatedAt: new Date().toISOString(), types: ctx.typeRecords }],
            ['blueprints.json', registry],
            ['regions.json', ctx.regions],
            ['market.json', ctx.market],
            ['skills.json', ctx.skills],
            ['fitting.json', { generatedAt: new Date().toISOString(), types: ctx.fittingTypes }],
            ['systems.json', ctx.systems],
            ['stations.json', ctx.stations],
            ['map.json', ctx.mapData],
            ['gateIntel.json', ctx.gateIntel],
          ]
          const startedAt = Date.now()
          for (let i = 0; i < outputs.length; i++) {
            const [name, data] = outputs[i]
            updateTaskProgress(task, `Write JSON · ${name}`, i, outputs.length, startedAt)
            if (name === 'market.json') {
              writeMarketJson(marketPath, data)
            } else {
              write(name, data)
            }
            updateTaskProgress(task, `Write JSON · ${name}`, i + 1, outputs.length, startedAt)
          }

          task.title = `Write JSON files · ${ctx.blueprints.length.toLocaleString()} blueprints, ${ctx.typeRecords.length.toLocaleString()} types · ${formatDuration(Date.now() - startedAt)}`
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
