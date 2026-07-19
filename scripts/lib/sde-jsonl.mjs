import { createReadStream, existsSync, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

const LATEST_URL = 'https://developers.eveonline.com/static-data/tranquility/latest.jsonl'
const MAP_SOLAR_SYSTEMS_ENTRY = 'mapSolarSystems.jsonl'

export async function fetchSdeBuildNumber() {
  const res = await fetch(LATEST_URL)
  if (!res.ok) throw new Error(`Failed to fetch SDE build info: ${res.status}`)
  const meta = JSON.parse((await res.text()).trim())
  const buildNumber = Number(meta.buildNumber)
  if (!Number.isFinite(buildNumber)) throw new Error('SDE latest.jsonl missing buildNumber')
  return buildNumber
}

export function sdeZipUrl(buildNumber) {
  return `https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-${buildNumber}-jsonl.zip`
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

function extractJsonlFromZip(zipPath, entryName = MAP_SOLAR_SYSTEMS_ENTRY) {
  const outPath = join(tmpdir(), entryName)
  execFileSync('tar', ['-xf', zipPath, '-C', tmpdir(), entryName], { stdio: 'pipe' })
  return outPath
}

/**
 * Load mapSolarSystems records from official SDE JSONL zip.
 * @param {{ zipPath?: string }} [options] - Use an existing zip (e.g. tmp-sde-jsonl.zip) to skip download.
 */
export async function loadMapSolarSystemsJsonl(options = {}) {
  let zipPath = options.zipPath

  if (!zipPath || !existsSync(zipPath)) {
    const buildNumber = await fetchSdeBuildNumber()
    zipPath = join(tmpdir(), `eve-sde-${buildNumber}-jsonl.zip`)
    if (!existsSync(zipPath)) {
      console.log(`Downloading SDE build ${buildNumber}...`)
      await downloadToFile(sdeZipUrl(buildNumber), zipPath)
    }
  }

  console.log(`Extracting ${MAP_SOLAR_SYSTEMS_ENTRY}...`)
  const jsonlPath = extractJsonlFromZip(zipPath)

  const records = []
  const rl = createInterface({ input: createReadStream(jsonlPath), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    records.push(JSON.parse(line))
  }
  return records
}
