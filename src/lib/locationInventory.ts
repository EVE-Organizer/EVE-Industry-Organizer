import type { EsiAsset } from '@/services/character/characterAssetsService'

/** Parent map for assets nested inside containers (item_id → parent location_id). */
export function buildItemLocationMap(assets: EsiAsset[]): Map<number, number> {
  const itemLocations = new Map<number, number>()
  for (const asset of assets) {
    if (asset.location_type === 'item') {
      itemLocations.set(asset.item_id, asset.location_id)
    }
  }
  return itemLocations
}

/** Walk a location id up through containers to the top-level station or structure. */
export function resolveFacilityId(locationId: number, itemLocations: Map<number, number>): number {
  let current = locationId
  const visited = new Set<number>()
  while (itemLocations.has(current) && !visited.has(current)) {
    visited.add(current)
    current = itemLocations.get(current)!
  }
  return current
}

/** Resolve the top-level station or structure ID for an asset location chain. */
export function resolveAssetFacilityId(
  asset: EsiAsset,
  itemLocations: Map<number, number>,
): number {
  if (asset.location_type === 'station' || asset.location_type === 'other') {
    return asset.location_id
  }

  return resolveFacilityId(asset.location_id, itemLocations)
}

/** Sum quantities by type_id for assets at a given station or structure. */
export function aggregateAssetsAtLocation(
  assets: EsiAsset[],
  locationId: number,
): Map<number, number> {
  const itemLocations = buildItemLocationMap(assets)

  const totals = new Map<number, number>()
  for (const asset of assets) {
    if (asset.is_singleton) continue
    const facilityId = resolveAssetFacilityId(asset, itemLocations)
    if (facilityId !== locationId) continue
    totals.set(asset.type_id, (totals.get(asset.type_id) ?? 0) + asset.quantity)
  }

  return totals
}

export function toBuyQuantity(need: number, have: number): number {
  return Math.max(0, need - have)
}
