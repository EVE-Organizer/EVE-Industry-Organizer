import type { HubId, HubMarketData, MarketData } from '@/types'

export const SPIKE_THRESHOLD = 2
export const STRONG_SPIKE_THRESHOLD = 3

export interface VolumeSpikeResult {
  typeId: number
  hubId: HubId
  spikeRatio: number
  avgVolume1d: number
  avgVolume1w: number
  isSpike: boolean
  isStrongSpike: boolean
}

export function computeSpikeRatio(avgVolume1d: number, avgVolume1w: number): number {
  if (avgVolume1w <= 0) return avgVolume1d > 0 ? 1 : 0
  return avgVolume1d / avgVolume1w
}

export function getHubProductSpike(
  hubMarket: HubMarketData,
  typeId: number,
): VolumeSpikeResult | null {
  const windows = hubMarket.products[String(typeId)]
  if (!windows) return null
  const d = windows['1d']
  const w = windows['1w']
  if (!d || !w) return null
  const spikeRatio = computeSpikeRatio(d.avgVolume, w.avgVolume)
  return {
    typeId,
    hubId: 'jita',
    spikeRatio,
    avgVolume1d: d.avgVolume,
    avgVolume1w: w.avgVolume,
    isSpike: spikeRatio >= SPIKE_THRESHOLD,
    isStrongSpike: spikeRatio >= STRONG_SPIKE_THRESHOLD,
  }
}

export function getProductSpikeAtHub(
  market: MarketData,
  hubId: HubId,
  typeId: number,
): VolumeSpikeResult | null {
  const hubMarket = market.hubs[hubId]
  if (!hubMarket) return null
  const windows = hubMarket.products[String(typeId)]
  if (!windows) return null
  const d = windows['1d']
  const w = windows['1w']
  if (!d || !w) return null
  const spikeRatio = computeSpikeRatio(d.avgVolume, w.avgVolume)
  return {
    typeId,
    hubId,
    spikeRatio,
    avgVolume1d: d.avgVolume,
    avgVolume1w: w.avgVolume,
    isSpike: spikeRatio >= SPIKE_THRESHOLD,
    isStrongSpike: spikeRatio >= STRONG_SPIKE_THRESHOLD,
  }
}

export function bestSellHubForProduct(
  market: MarketData,
  typeId: number,
  primaryHub: HubId,
): { hubId: HubId; sellPrice: number; vsPrimaryPct: number } | null {
  let best: { hubId: HubId; sellPrice: number; vsPrimaryPct: number } | null = null
  const primaryPrice = market.hubs[primaryHub]?.prices[String(typeId)] ?? 0

  for (const hub of Object.keys(market.hubs) as HubId[]) {
    const price = market.hubs[hub]?.prices[String(typeId)] ?? 0
    if (price <= 0) continue
    const vsPrimaryPct =
      primaryPrice > 0 ? ((price - primaryPrice) / primaryPrice) * 100 : 0
    if (!best || price > best.sellPrice) {
      best = { hubId: hub, sellPrice: price, vsPrimaryPct }
    }
  }
  return best
}

export function hubSpikeTypeIds(
  market: MarketData,
  hubId: HubId,
  typeIds: number[],
  minRatio = SPIKE_THRESHOLD,
): VolumeSpikeResult[] {
  const results: VolumeSpikeResult[] = []
  for (const typeId of typeIds) {
    const spike = getProductSpikeAtHub(market, hubId, typeId)
    if (spike && spike.spikeRatio >= minRatio) results.push(spike)
  }
  return results.sort((a, b) => b.spikeRatio - a.spikeRatio)
}
