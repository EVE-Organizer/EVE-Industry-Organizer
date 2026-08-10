import { createReadStream, existsSync, writeFileSync, copyFileSync } from 'fs'
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
  const outDir = tmpdir()
  const outPath = join(outDir, entryName)

  // Official SDE ships as ZIP. GNU tar (Linux CI) cannot read ZIP; macOS bsdtar can.
  // Prefer unzip / .NET ZipFile so extraction works on Linux, macOS, and Windows.
  if (process.platform === 'win32') {
    const ps = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $zip = [System.IO.Compression.ZipFile]::OpenRead(${JSON.stringify(zipPath)})
      try {
        $entry = $zip.GetEntry(${JSON.stringify(entryName)})
        if (-not $entry) { throw "Entry not found: ${entryName}" }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, ${JSON.stringify(outPath)}, $true)
      } finally {
        $zip.Dispose()
      }
    `
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'pipe' })
    return outPath
  }

  try {
    execFileSync('unzip', ['-o', '-j', zipPath, entryName, '-d', outDir], { stdio: 'pipe' })
  } catch {
    execFileSync('tar', ['-xf', zipPath, '-C', outDir, entryName], { stdio: 'pipe' })
  }
  return outPath
}

/**
 * Load mapSolarSystems records from official SDE JSONL zip.
 * @param {{ zipPath?: string, cacheZipPath?: string }} [options]
 *   zipPath — use existing zip (e.g. tmp-sde-jsonl.zip) to skip download.
 *   cacheZipPath — copy downloaded zip here for CI cache (e.g. tmp-sde-jsonl.zip).
 */
export async function loadMapSolarSystemsJsonl(options = {}) {
  let zipPath = options.zipPath

  if (!zipPath || !existsSync(zipPath)) {
    const buildNumber = await fetchSdeBuildNumber()
    const downloadedPath = join(tmpdir(), `eve-sde-${buildNumber}-jsonl.zip`)
    if (!existsSync(downloadedPath)) {
      console.log(`Downloading SDE build ${buildNumber}...`)
      await downloadToFile(sdeZipUrl(buildNumber), downloadedPath)
    }
    if (options.cacheZipPath) {
      copyFileSync(downloadedPath, options.cacheZipPath)
      zipPath = options.cacheZipPath
    } else {
      zipPath = downloadedPath
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
