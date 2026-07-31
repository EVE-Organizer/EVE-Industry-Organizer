import { describe, expect, it } from 'vitest'
import { resolveHubHaulRates } from '@/lib/ranking'
import type { MarketData } from '@/types'

describe('resolveHubHaulRates', () => {
  const haulRates: MarketData['haulRates'] = {
    '30000142->30000144': {
      valid: true,
      iskPerM3: 100,
      jumps: 1,
      samples: 10,
      fromSystemId: 30000142,
      toSystemId: 30000144,
    },
    '30000144->30002187': {
      valid: true,
      iskPerM3: 250,
      jumps: 8,
      samples: 10,
      fromSystemId: 30000144,
      toSystemId: 30002187,
    },
  }

  it('uses separate buy-hub and sell-hub legs', () => {
    const rates = resolveHubHaulRates(
      haulRates,
      30000142,
      30000144,
      30002187,
    )
    expect(rates.haulInIskPerM3).toBe(100)
    expect(rates.haulOutIskPerM3).toBe(250)
  })

  it('defaults sell leg to buy hub when sell system omitted', () => {
    const rates = resolveHubHaulRates(haulRates, 30000142, 30000144)
    expect(rates.haulInIskPerM3).toBe(100)
    expect(rates.haulOutIskPerM3).toBe(250)
  })
})
