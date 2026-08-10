#!/usr/bin/env node
/**
 * Merge per-hub market.json artifacts into the base market file.
 * Used by CI weekly history matrix (one artifact per hub).
 *
 * Usage: node scripts/merge-market-hubs.mjs <baseMarketPath> <artifactsDir>
 * Artifacts layout: <artifactsDir>/market-<hubId>/market.json
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const [basePath, artifactsDir] = process.argv.slice(2)
if (!basePath || !artifactsDir) {
  console.error('Usage: node scripts/merge-market-hubs.mjs <baseMarketPath> <artifactsDir>')
  process.exit(1)
}

const market = JSON.parse(readFileSync(basePath, 'utf8'))
market.hubs = { ...(market.hubs ?? {}) }
market.haulRates = { ...(market.haulRates ?? {}) }

let mergedHubs = 0

for (const entry of readdirSync(artifactsDir)) {
  if (!entry.startsWith('market-')) continue
  const hubId = entry.slice('market-'.length)
  const artifactPath = join(artifactsDir, entry, 'market.json')
  try {
    statSync(artifactPath)
  } catch {
    console.warn(`Skipping ${entry}: no market.json`)
    continue
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'))
  const hub = artifact.hubs?.[hubId]
  if (!hub) {
    console.warn(`Skipping ${entry}: missing hubs.${hubId}`)
    continue
  }

  market.hubs[hubId] = hub
  mergedHubs++
  if (artifact.haulRates) {
    market.haulRates = { ...market.haulRates, ...artifact.haulRates }
  }
}

if (!mergedHubs) {
  console.error('No hub artifacts merged')
  process.exit(1)
}

market.generatedAt = new Date().toISOString()
writeFileSync(basePath, JSON.stringify(market, null, 2))
console.log(`Merged ${mergedHubs} hub(s) into ${basePath}`)
