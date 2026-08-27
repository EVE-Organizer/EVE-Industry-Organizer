import type { HubId } from '@/types'

/** NPC trade hubs used as the liquid-price reference cluster. */
export const NPC_REFERENCE_HUBS: readonly HubId[] = [
  'jita',
  'amarr',
  'dodixie',
  'rens',
  'hek',
]

/** Hub quote is scatter-cheap when it is below reference median / this ratio. */
export const SCATTER_PRICE_RATIO = 4

/** Hub volume is thin when it is below reference median / this ratio. */
export const SCATTER_VOLUME_RATIO = 10

const MIN_REFERENCE_HUBS = 3

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Median of positive values, or null when fewer than 3 hubs have data. */
export function referenceMedian(values: number[]): number | null {
  const positive = values.filter((v) => v > 0)
  if (positive.length < MIN_REFERENCE_HUBS) return null
  return median(positive)
}

export function referenceMedianFromMaps(
  typeId: number,
  mapsByHub: Map<HubId, Map<number, number>>,
): number | null {
  return referenceMedian(NPC_REFERENCE_HUBS.map((hubId) => mapsByHub.get(hubId)?.get(typeId) ?? 0))
}

export function isThinVolume(hubVolume: number, medianVolume: number | null): boolean {
  if (!(hubVolume > 0)) return true
  if (medianVolume == null || medianVolume <= 0) return false
  return hubVolume < medianVolume / SCATTER_VOLUME_RATIO
}

/** Floor scatter-cheap buy quotes with thin volume to the NPC median. */
export function sanitizeBuyPrice(
  hubPrice: number,
  medianPrice: number | null,
  hubVolume: number,
  medianVolume: number | null,
): number {
  if (!(hubPrice > 0) || medianPrice == null || medianPrice <= 0) return hubPrice
  const tooCheap = hubPrice < medianPrice / SCATTER_PRICE_RATIO
  if (tooCheap && isThinVolume(hubVolume, medianVolume)) return medianPrice
  return hubPrice
}

/** Cap scatter-expensive sell quotes to the NPC median. */
export function sanitizeSellPrice(hubPrice: number, medianPrice: number | null): number {
  if (!(hubPrice > 0) || medianPrice == null || medianPrice <= 0) return hubPrice
  if (hubPrice > medianPrice * SCATTER_PRICE_RATIO) return medianPrice
  return hubPrice
}

export function sanitizeBuyPriceMap(
  hubPrices: Map<number, number>,
  hubVolumes: Map<number, number>,
  npcPrices: Map<HubId, Map<number, number>>,
  npcVolumes: Map<HubId, Map<number, number>>,
): Map<number, number> {
  const out = new Map(hubPrices)
  for (const [typeId, price] of hubPrices) {
    const medianPrice = referenceMedianFromMaps(typeId, npcPrices)
    const medianVolume = referenceMedianFromMaps(typeId, npcVolumes)
    const next = sanitizeBuyPrice(price, medianPrice, hubVolumes.get(typeId) ?? 0, medianVolume)
    if (next !== price) out.set(typeId, next)
  }
  return out
}

export function pickHubMaps(
  all: Map<HubId, Map<number, number>>,
  hubIds: readonly HubId[] = NPC_REFERENCE_HUBS,
): Map<HubId, Map<number, number>> {
  const out = new Map<HubId, Map<number, number>>()
  for (const hubId of hubIds) {
    const map = all.get(hubId)
    if (map) out.set(hubId, map)
  }
  return out
}
