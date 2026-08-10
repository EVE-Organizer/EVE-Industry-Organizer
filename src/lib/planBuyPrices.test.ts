import { describe, expect, it } from 'vitest'
import {
  mergePlanBuyPrices,
  PLAN_DEFAULT_BUY_HUB,
  resolvePlanBuyUnitPrice,
} from '@/lib/planBuyPrices'
import type { HubId } from '@/types'

function hubMaps(
  entries: Partial<Record<HubId, Record<number, number>>>,
): Map<HubId, Map<number, number>> {
  const maps = new Map<HubId, Map<number, number>>()
  for (const [hubId, prices] of Object.entries(entries)) {
    maps.set(hubId as HubId, new Map(Object.entries(prices).map(([k, v]) => [Number(k), v])))
  }
  return maps
}

describe('resolvePlanBuyUnitPrice', () => {
  const maps = hubMaps({
    jita: { 34: 5, 35: 10 },
    amarr: { 34: 6, 35: 0 },
    hek: {},
  })

  it('uses custom buyPrice when set', () => {
    expect(resolvePlanBuyUnitPrice(34, maps, { buyPrice: 99 })).toBe(99)
  })

  it('uses buyHub live price', () => {
    expect(resolvePlanBuyUnitPrice(34, maps, { buyHub: 'amarr' })).toBe(6)
  })

  it('defaults to Jita when no override', () => {
    expect(resolvePlanBuyUnitPrice(34, maps)).toBe(5)
    expect(resolvePlanBuyUnitPrice(34, maps, undefined, PLAN_DEFAULT_BUY_HUB)).toBe(5)
  })

  it('falls back to Jita when chosen hub has no price', () => {
    expect(resolvePlanBuyUnitPrice(35, maps, { buyHub: 'amarr' })).toBe(10)
    expect(resolvePlanBuyUnitPrice(34, maps, { buyHub: 'hek' })).toBe(5)
  })

  it('returns 0 when no price anywhere', () => {
    expect(resolvePlanBuyUnitPrice(99, maps)).toBe(0)
  })

  it('custom buyPrice wins over buyHub', () => {
    expect(resolvePlanBuyUnitPrice(34, maps, { buyHub: 'amarr', buyPrice: 42 })).toBe(42)
  })
})

describe('mergePlanBuyPrices', () => {
  const maps = hubMaps({
    jita: { 34: 5, 35: 10 },
    amarr: { 34: 6 },
  })

  it('starts from Jita prices', () => {
    const merged = mergePlanBuyPrices(maps, {})
    expect(merged.get(34)).toBe(5)
    expect(merged.get(35)).toBe(10)
  })

  it('applies custom buyPrice override', () => {
    const merged = mergePlanBuyPrices(maps, {
      11399: { buyPrice: 250_000 },
    })
    expect(merged.get(11399)).toBe(250_000)
  })

  it('applies buyHub override with live hub price', () => {
    const merged = mergePlanBuyPrices(maps, {
      34: { buyHub: 'amarr' },
    })
    expect(merged.get(34)).toBe(6)
  })

  it('falls back to Jita when override hub lacks price', () => {
    const merged = mergePlanBuyPrices(maps, {
      35: { buyHub: 'amarr' },
    })
    expect(merged.get(35)).toBe(10)
  })

  it('removes price when override resolves to zero', () => {
    const merged = mergePlanBuyPrices(maps, {
      34: { buyPrice: 0 },
    })
    expect(merged.get(34)).toBe(5)
  })

  it('ignores non-buy overrides', () => {
    const merged = mergePlanBuyPrices(maps, {
      35: { me: 10 },
    })
    expect(merged.get(35)).toBe(10)
  })
})
