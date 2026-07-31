import { describe, expect, it } from 'vitest'
import { mergePlanBuyPrices } from '@/lib/planBuyPrices'

describe('mergePlanBuyPrices', () => {
  it('fills missing hub prices from nodeOverrides.buyPrice', () => {
    const hub = new Map([[34, 5]])
    const merged = mergePlanBuyPrices(hub, {
      11399: { buyPrice: 250_000 },
    })
    expect(merged.get(34)).toBe(5)
    expect(merged.get(11399)).toBe(250_000)
  })

  it('does not override an existing hub price', () => {
    const hub = new Map([[34, 5]])
    const merged = mergePlanBuyPrices(hub, {
      34: { buyPrice: 99 },
    })
    expect(merged.get(34)).toBe(5)
  })

  it('ignores zero or missing custom prices', () => {
    const hub = new Map<number, number>()
    const merged = mergePlanBuyPrices(hub, {
      34: { buyPrice: 0 },
      35: { me: 10 },
    })
    expect(merged.has(34)).toBe(false)
    expect(merged.has(35)).toBe(false)
  })
})
