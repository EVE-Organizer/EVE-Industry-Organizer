import { describe, expect, it } from 'vitest'
import type { HubMarketData, MarketData } from '@/types'
import {
  SPIKE_THRESHOLD,
  computeSpikeRatio,
  getProductSpikeAtHub,
} from '@/lib/volumeSpike'

function hubWithVolumes(typeId: number, avg1d: number, avg1w: number): HubMarketData {
  return {
    regionId: 1,
    marketSystemId: 30000142,
    buildSystemId: 30000144,
    costIndex: 0.01,
    products: {
      [String(typeId)]: {
        '1d': { avgVolume: avg1d, avgPrice: 1, high: 1, low: 1 },
        '1w': { avgVolume: avg1w, avgPrice: 1, high: 1, low: 1 },
      },
    },
    prices: { [String(typeId)]: 100 },
    buyPrices: {},
  }
}

describe('computeSpikeRatio', () => {
  it('divides 1d average by 1w average', () => {
    expect(computeSpikeRatio(20, 10)).toBe(2)
    expect(computeSpikeRatio(0, 10)).toBe(0)
  })
})

describe('getProductSpikeAtHub', () => {
  it('flags spikes at or above the threshold', () => {
    const market = {
      hubs: {
        jita: hubWithVolumes(34, 30, 10),
      },
    } as MarketData

    const spike = getProductSpikeAtHub(market, 'jita', 34)
    expect(spike?.spikeRatio).toBe(3)
    expect(spike?.isSpike).toBe(true)
    expect(spike?.isSpike).toBe(spike!.spikeRatio >= SPIKE_THRESHOLD)
  })
})
