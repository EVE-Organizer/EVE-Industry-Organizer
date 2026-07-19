#!/usr/bin/env node
/**
 * Build public/data/contracts.json from EVE Ref public-contracts snapshot.
 *
 * Run: node scripts/rebuild-contracts.mjs
 *
 * Requires `tar` on PATH (Windows 10+ / macOS / Linux).
 * Downloads ~6 MB archive from data.everef.net.
 */
import { execSync } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import {
  buildContractsFromExtractedDir,
  loadBlueprintTypeIds,
  resolveEverefArchiveUrl,
  writeContractsJson,
} from './lib/contracts-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '../public/data')
const blueprintsPath = join(dataDir, 'blueprints.json')
const outputPath = join(dataDir, 'contracts.json')

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`)
  if (!res.body) throw new Error(`Download returned no body: ${url}`)
  await pipeline(res.body, createWriteStream(dest))
}

function extractArchive(archivePath, extractDir) {
  mkdirSync(extractDir, { recursive: true })
  execSync(`tar -xjf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' })
}

async function main() {
  const blueprintTypeIds = loadBlueprintTypeIds(blueprintsPath)
  const archiveUrl = await resolveEverefArchiveUrl()
  const workDir = mkdtempSync(join(tmpdir(), 'eve-contracts-'))
  const archivePath = join(workDir, 'public-contracts.tar.bz2')
  const extractDir = join(workDir, 'extracted')

  try {
    console.log(`Downloading EVE Ref public contracts snapshot…\n  ${archiveUrl}`)
    await download(archiveUrl, archivePath)

    console.log('Extracting archive…')
    extractArchive(archivePath, extractDir)

    console.log('Indexing BPC contracts by hub region…')
    const contracts = await buildContractsFromExtractedDir(extractDir, blueprintTypeIds, archiveUrl)
    writeContractsJson(outputPath, contracts)

    const total = Object.values(contracts.hubs).reduce((sum, hub) => {
      return sum + Object.keys(hub.byBlueprintTypeId).length
    }, 0)
    console.log(`Wrote ${outputPath} (${total} blueprint types with BPC listings)`)
  } finally {
    if (existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
