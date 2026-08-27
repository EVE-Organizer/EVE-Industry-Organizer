import { describe, expect, it } from 'vitest'
import type { HubId } from '@/types'
import {
  NPC_REFERENCE_HUBS,
  referenceMedian,
  sanitizeBuyPrice,
  sanitizeBuyPriceMap,
  sanitizeSellPrice,
} from '@/lib/hubPriceSanity'
import { formatHubDailyVolume } from '@/lib/profit'
import { planHubQuoteRows } from '@/components/plan/PlanBuyPriceCell'

function hubMap(entries: Partial<Record<HubId, Record<number, number>>>): Map<HubId, Map<number, number>> {
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
  it('floors scatter-cheap thin quotes to the NPC median', () => {
    expect(sanitizeBuyPrice(1000, 15900, 2, 4000)).toBe(15900)
  })

  it('keeps a modest discount when volume is comparable', () => {
    expect(sanitizeBuyPrice(12000, 13300, 3500, 4000)).toBe(12000)
  })

  it('keeps a cheap quote when volume is not thin', () => {
    expect(sanitizeBuyPrice(1000, 15900, 3000, 4000)).toBe(1000)
  })

  it('does not invent a floor without a reference median', () => {
    expect(sanitizeBuyPrice(1000, null, 1, null)).toBe(1000)
  })
})

describe('sanitizeSellPrice', () => {
  it('caps scatter-expensive sell quotes', () => {
    expect(sanitizeSellPrice(200_000, 15000)).toBe(15000)
  })

  it('leaves cheap sell quotes alone', () => {
    expect(sanitizeSellPrice(1000, 15000)).toBe(1000)
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
  const npcVolumes = hubMap({
    jita: { 34: 5000 },
    amarr: { 34: 4000 },
    dodixie: { 34: 4200 },
    rens: { 34: 3800 },
    hek: { 34: 3500 },
  })

  it('replaces Vale 1K thin quotes with the NPC median', () => {
    const valePrices = new Map([[34, 1000]])
    const valeVolumes = new Map([[34, 2]])
    const sanitized = sanitizeBuyPriceMap(valePrices, valeVolumes, npcPrices, npcVolumes)
    expect(sanitized.get(34)).toBe(15900)
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
