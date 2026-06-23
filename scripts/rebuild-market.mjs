#!/usr/bin/env node
/**
 * Rebuild public/data/market.json from blueprints.json + regions.json.
 * Refreshes prices, product history summaries, and courier haul rates.
 *
 * History is incremental: skips products fetched within 24h and writes
 * market.json after each batch of 100 new history fetches.
 *
 * Run: node scripts/rebuild-market.mjs [hub]
 *      node scripts/rebuild-market.mjs jita
 *      node scripts/rebuild-market.mjs jita,amarr
 *
 * Env:
 *   MARKET_HUB=jita              same as CLI hub arg
 *   MARKET_SKIP_HISTORY=1        prices + haul rates only (~1 min)
 *   MARKET_HISTORY_LIMIT=500     cap history products per hub (dev)
 *   MARKET_HISTORY_CONCURRENCY=10 parallel ESI history requests (default 10)
 *   MARKET_HISTORY_TTL_HOURS=24  skip refetch if cached within this window
 *   MARKET_PROGRESS_VERBOSE=1    log per-product history skip warnings
 *   MARKET_PROGRESS_PLAIN=1      force plain log output (no listr tree)
 *   MARKET_PROGRESS_FORCE=1      force listr task tree (e.g. local non-TTY)
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  buildMarketData,
  loadExistingMarket,
  parseHubIds,
  writeMarketJson,
} from './lib/market-data.mjs'
import {
  createMarketBuildTask,
  formatMarketConfigSummary,
  runListr,
} from './lib/run-progress.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '../public/data')
const marketPath = join(dataDir, 'market.json')

function loadJson(name) {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8'))
}

function loadBlueprintRegistry() {
  const raw = loadJson('blueprints.json')
  if (Array.isArray(raw)) return raw
  if (raw.blueprints) return raw.blueprints
  throw new Error('blueprints.json must be { blueprints: [...] }')
}

function readMarketOptions() {
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

  return { skipHistory, historyLimit, historyConcurrency, historyTtlMs }
}

function readHubIdsFromArgv() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  const raw = args.length ? args.join(',') : process.env.MARKET_HUB
  return parseHubIds(raw)
}

async function main() {
  const blueprints = loadBlueprintRegistry()
  const regions = loadJson('regions.json')
  const stations = loadJson('stations.json')
  const existingMarket = loadExistingMarket(marketPath)

  const hubIds = readHubIdsFromArgv()
  const marketOptions = readMarketOptions()

  const configSummary = formatMarketConfigSummary({
    hubIds,
    existingGeneratedAt: existingMarket?.generatedAt,
    ...marketOptions,
  })

  const ctx = {}

  await runListr(
    [
      {
        title: `Load data · ${blueprints.length.toLocaleString()} blueprints`,
        task: async () => {
          // inputs loaded above; task exists for visible pipeline step
        },
      },
      createMarketBuildTask(ctx, {
        hubIds,
        skipHistory: marketOptions.skipHistory,
        runBuild: (onProgress) =>
          buildMarketData(blueprints, regions, stations, {
            ...marketOptions,
            existingMarket,
            hubIds,
            onProgress,
            onCheckpoint: (partial) => {
              writeMarketJson(marketPath, partial)
            },
          }),
      }),
      {
        title: 'Write market.json',
        task: async (_, task) => {
          const market = ctx.market
          writeMarketJson(marketPath, market)
          const hubCount = Object.keys(market.hubs).length
          const routeCount = Object.keys(market.haulRates).length
          task.title = `Write market.json · ${hubCount} hubs, ${routeCount} haul routes`
        },
      },
    ],
    {
      header: `EVE Industry Organizer · rebuild market\n  ${configSummary}`,
      ctx,
    },
  )

  if (!ctx.market) {
    throw new Error('Market build did not produce output')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
