import { describe, expect, it } from 'vitest'
import {
  applyPlanBuyPriceSource,
  mergePlanBuyPrices,
  PLAN_DEFAULT_BUY_HUB,
  planBuyPriceSourceForHub,
  resolvePlanBuyUnitPrice,
} from '@/pages/Plan/planBuyPrices'
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

  it('falls back to Jita even when default hub is not Jita', () => {
    expect(resolvePlanBuyUnitPrice(35, maps, { buyHub: 'amarr' }, 'vale')).toBe(10)
    expect(resolvePlanBuyUnitPrice(34, maps, undefined, 'vale')).toBe(5)
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

  it('fills missing primary-hub quotes from Jita', () => {
    const regional = hubMaps({
      jita: { 34: 5, 35: 10, 99: 1000 },
      vale: { 34: 7 },
    })
    const merged = mergePlanBuyPrices(regional, {}, 'vale')
    expect(merged.get(34)).toBe(7)
    expect(merged.get(35)).toBe(10)
    expect(merged.get(99)).toBe(1000)
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

describe('planBuyPriceSourceForHub', () => {
  it('selects Jita as an override when the default hub is Vale', () => {
    expect(planBuyPriceSourceForHub('jita', 'vale')).toEqual({ hub: 'jita' })
  })

  it('clears the override when picking the default hub', () => {
    expect(planBuyPriceSourceForHub('vale', 'vale')).toBeNull()
    expect(planBuyPriceSourceForHub('jita', 'jita')).toBeNull()
  })
})

describe('applyPlanBuyPriceSource', () => {
  it('stores Jita when Buy default is Vale', () => {
    expect(applyPlanBuyPriceSource({ me: 10 }, { hub: 'jita' }, 'vale')).toEqual({
      me: 10,
      buyHub: 'jita',
    })
  })

  it('does not treat Jita as "no hub" when default is another region', () => {
    const afterVale = applyPlanBuyPriceSource({}, { hub: 'vale' }, 'jita')
    expect(afterVale).toEqual({ buyHub: 'vale' })
    expect(applyPlanBuyPriceSource(afterVale, { hub: 'jita' }, 'vale')).toEqual({ buyHub: 'jita' })
  })

  it('clears hub and custom price when source is null', () => {
    expect(
      applyPlanBuyPriceSource({ buyHub: 'vale', buyPrice: 1000, me: 8 }, null, 'vale'),
    ).toEqual({
      me: 8,
    })
  })
})
