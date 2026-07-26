#!/usr/bin/env node
/**
 * Backfill ESI history (avg volume/price windows) for mining type IDs missing
 * from market.json products — especially compressed ores that trade at hubs.
 *
 * Run: node scripts/backfill-mining-volumes.mjs [hubId|all]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  aggregateHistoryWindows,
  fetchEsiHistory,
  loadExistingMarket,
  writeMarketJson,
} from './lib/market-data.mjs'
import { REGION_IDS } from './lib/market-prices.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const marketPath = join(__dirname, '../public/data/market.json')
const miningPath = join(__dirname, '../public/data/mining.json')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runPool(items, concurrency, worker) {
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

function collectMiningVolumeTypeIds(mining) {
  const ids = new Set()
  for (const item of mining.items ?? []) {
    if (/compress/i.test(item.name ?? '')) continue
    ids.add(item.typeId)
    if (item.compressedTypeId != null) ids.add(item.compressedTypeId)
  }
  return [...ids]
}

async function main() {
  const hubArg = (process.argv[2] ?? 'all').toLowerCase()
  if (!existsSync(miningPath)) {
    throw new Error('public/data/mining.json missing — run pnpm run rebuild-mining first')
  }
  const mining = JSON.parse(readFileSync(miningPath, 'utf8'))
  const typeIds = collectMiningVolumeTypeIds(mining)
  const market = loadExistingMarket(marketPath)
  if (!market?.hubs) throw new Error('public/data/market.json missing or empty')

  const hubIds =
    hubArg === 'all'
      ? Object.keys(REGION_IDS).filter((id) => market.hubs[id])
      : [hubArg]

  for (const hubId of hubIds) {
    const regionId = REGION_IDS[hubId]
    const hub = market.hubs[hubId]
    if (!regionId || !hub) {
      console.warn(`Skip unknown hub ${hubId}`)
      continue
    }

    const products = { ...(hub.products ?? {}) }
    const productsFetchedAt = { ...(hub.productsFetchedAt ?? {}) }
    const missing = typeIds.filter((id) => !products[String(id)])
    console.log(`${hubId}: ${missing.length}/${typeIds.length} mining types need history`)

    let done = 0
    let filled = 0
    let errors = 0
    await runPool(missing, 4, async (typeId) => {
      try {
        await sleep(50)
        const history = await fetchEsiHistory(typeId, regionId)
        const windows = aggregateHistoryWindows(history)
        const key = String(typeId)
        if (Object.keys(windows).length) {
          products[key] = windows
          filled++
        }
        productsFetchedAt[key] = new Date().toISOString()
      } catch (e) {
        errors++
        console.warn(`  ${hubId} ${typeId}: ${e.message}`)
      }
      done++
      if (done % 25 === 0 || done === missing.length) {
        console.log(`  ${hubId} ${done}/${missing.length} (filled ${filled}, err ${errors})`)
      }
    })

    market.hubs[hubId] = {
      ...hub,
      products,
      productsFetchedAt,
    }
    market.generatedAt = new Date().toISOString()
    writeMarketJson(marketPath, market)
    console.log(`${hubId}: wrote market.json`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
