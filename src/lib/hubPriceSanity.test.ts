import { describe, expect, it } from 'vitest'
import type { HubId } from '@/types'
import {
  NPC_REFERENCE_HUBS,
  fillMissingPricesFromJita,
  referenceMedian,
  sanitizeBuyPrice,
  sanitizeBuyPriceMap,
  sanitizeSellPrice,
} from '@/lib/hubPriceSanity'
import { formatHubDailyVolume } from '@/lib/profit'
import { planHubQuoteRows } from '@/pages/Plan/PlanBuyPriceCell'

function hubMap(
  entries: Partial<Record<HubId, Record<number, number>>>,
): Map<HubId, Map<number, number>> {
  const maps = new Map<HubId, Map<number, number>>()
  for (const [hubId, values] of Object.entries(entries)) {
    maps.set(hubId as HubId, new Map(Object.entries(values).map(([k, v]) => [Number(k), v])))
  }
  return maps
}

describe('referenceMedian', () => {
  it('returns null when fewer than three hubs have prices', () => {
    expect(referenceMedian([13300, 15200, 0, 0, 0])).toBeNull()
  })

  it('returns the median of positive hub prices', () => {
    expect(referenceMedian([13300, 15200, 15900, 18000, 23000])).toBe(15900)
  })
})

describe('sanitizeBuyPrice', () => {
  it('falls back to Jita when the hub quote is scatter-cheap', () => {
    expect(sanitizeBuyPrice(1000, 13300)).toBe(13300)
  })

  it('keeps a modest discount vs Jita', () => {
    expect(sanitizeBuyPrice(12000, 13300)).toBe(12000)
  })

  it('does not invent a floor without a Jita price', () => {
    expect(sanitizeBuyPrice(1000, 0)).toBe(1000)
  })
})

describe('sanitizeSellPrice', () => {
  it('caps scatter-expensive sell quotes to Jita', () => {
    expect(sanitizeSellPrice(200_000, 15000)).toBe(15000)
  })

  it('leaves cheap sell quotes alone', () => {
    expect(sanitizeSellPrice(1000, 15000)).toBe(1000)
  })
})

describe('fillMissingPricesFromJita', () => {
  it('fills zero/absent hub quotes from Jita without overwriting hub prices', () => {
    const hub = new Map([
      [34, 12000],
      [35, 0],
    ])
    const jita = new Map([
      [34, 13300],
      [35, 500],
      [36, 800],
    ])
    const filled = fillMissingPricesFromJita(hub, jita)
    expect(filled.get(34)).toBe(12000)
    expect(filled.get(35)).toBe(500)
    expect(filled.get(36)).toBe(800)
  })
})

describe('sanitizeBuyPriceMap', () => {
  const npcPrices = hubMap({
    jita: { 34: 13300 },
    amarr: { 34: 15200 },
    dodixie: { 34: 15900 },
    rens: { 34: 18000 },
    hek: { 34: 23000 },
  })

  it('replaces Vale 1K quotes with Jita', () => {
    const valePrices = new Map([[34, 1000]])
    const sanitized = sanitizeBuyPriceMap(valePrices, npcPrices)
    expect(sanitized.get(34)).toBe(13300)
  })
})

describe('plan hub quote rows', () => {
  it('puts daily volume next to each hub price', () => {
    const prices = hubMap({
      jita: { 34: 13300 },
      vale: { 34: 1000 },
    })
    const volumes = hubMap({
      jita: { 34: 4200 },
      vale: { 34: 2 },
    })
    const rows = planHubQuoteRows(34, prices, volumes)
    const jita = rows.find((row) => row.id === 'jita')
    const vale = rows.find((row) => row.id === 'vale')
    expect(jita).toMatchObject({ price: 13300, volume: 4200 })
    expect(vale).toMatchObject({ price: 1000, volume: 2 })
    expect(formatHubDailyVolume(jita!.volume)).toBe('4,200.0/d')
    expect(formatHubDailyVolume(vale!.volume)).toBe('2.0/d')
    expect(formatHubDailyVolume(0)).toBe('—')
    expect(rows).toHaveLength(NPC_REFERENCE_HUBS.length + 2)
  })
})
