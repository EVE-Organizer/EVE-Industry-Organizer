import { describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mergeScript = join(__dirname, 'merge-market-hubs.mjs')

describe('merge-market-hubs.mjs', () => {
  it('merges hub entries and unions haulRates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'merge-market-'))
    const basePath = join(dir, 'market.json')
    const artifactsDir = join(dir, 'artifacts')

    writeFileSync(
      basePath,
      JSON.stringify({
        generatedAt: '2026-01-01T00:00:00.000Z',
        hubs: {
          jita: { regionId: 1, prices: { '34': '1' }, products: {} },
          amarr: { regionId: 2, prices: { '34': '2' }, products: {} },
        },
        haulRates: { '1->2': { iskPerM3: 100 } },
      }),
    )

    const jitaDir = join(artifactsDir, 'market-jita')
    const amarrDir = join(artifactsDir, 'market-amarr')
    mkdirSync(jitaDir, { recursive: true })
    mkdirSync(amarrDir, { recursive: true })

    writeFileSync(
      join(jitaDir, 'market.json'),
      JSON.stringify({
        hubs: {
          jita: { regionId: 1, prices: { '34': '9' }, products: { '34': { '1w': { avgPrice: 3 } } } },
        },
        haulRates: { '1->3': { iskPerM3: 50 } },
      }),
    )
    writeFileSync(
      join(amarrDir, 'market.json'),
      JSON.stringify({
        hubs: {
          amarr: { regionId: 2, prices: { '34': '8' }, products: { '35': { '1w': { avgPrice: 4 } } } },
        },
        haulRates: { '2->3': { iskPerM3: 60 } },
      }),
    )

    execFileSync('node', [mergeScript, basePath, artifactsDir], { stdio: 'pipe' })

    const merged = JSON.parse(readFileSync(basePath, 'utf8'))
    expect(merged.hubs.jita.prices['34']).toBe('9')
    expect(merged.hubs.amarr.prices['34']).toBe('8')
    expect(merged.hubs.jita.products['34']).toBeDefined()
    expect(merged.haulRates['1->2'].iskPerM3).toBe(100)
    expect(merged.haulRates['1->3'].iskPerM3).toBe(50)
    expect(merged.haulRates['2->3'].iskPerM3).toBe(60)

    rmSync(dir, { recursive: true, force: true })
  })
})
