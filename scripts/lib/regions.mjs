/** Build regions.json from SDE: all regions with build system + security class. */

import { HUB_MARKET_SYSTEMS, HUB_REGION_IDS } from './hubs.mjs'

export { HUB_MARKET_SYSTEMS, HUB_REGION_IDS }

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function securityClass(security) {
  if (security >= 0.45) return 'highsec'
  if (security > 0) return 'lowsec'
  return 'nullsec'
}

/**
 * Pick the system with the lowest manufacturing cost index in the region.
 * Tie-break: highest security (safer default).
 */
export function buildRegionRecords(mapSolarSystems, mapRegions, costIndices) {
  const systemsByRegion = new Map()
  for (const row of mapSolarSystems) {
    const regionId = num(row.regionID)
    if (!systemsByRegion.has(regionId)) systemsByRegion.set(regionId, [])
    systemsByRegion.get(regionId).push({
      systemId: num(row.solarSystemID),
      name: row.solarSystemName,
      security: num(row.security),
      regionId,
    })
  }

  const regionNameById = new Map(mapRegions.map((r) => [num(r.regionID), r.regionName]))

  const hubRegionToMarketSystem = new Map(
    Object.entries(HUB_REGION_IDS).map(([hubId, regionId]) => [
      regionId,
      HUB_MARKET_SYSTEMS[hubId],
    ]),
  )

  const regions = []
  for (const [regionId, systems] of systemsByRegion) {
    if (!systems.length) continue

    let buildSystem = systems[0]
    let bestIndex = costIndices.get(buildSystem.systemId) ?? 1

    for (const sys of systems) {
      const idx = costIndices.get(sys.systemId) ?? 1
      if (
        idx < bestIndex ||
        (idx === bestIndex && sys.security > buildSystem.security)
      ) {
        bestIndex = idx
        buildSystem = sys
      }
    }

    const marketSystemId = hubRegionToMarketSystem.get(regionId) ?? buildSystem.systemId

    regions.push({
      regionId,
      name: regionNameById.get(regionId) ?? `Region ${regionId}`,
      securityClass: securityClass(buildSystem.security),
      buildSystemId: buildSystem.systemId,
      buildSystemName: buildSystem.name,
      buildSystemSecurity: buildSystem.security,
      costIndex: bestIndex,
      marketSystemId,
    })
  }

  return regions.sort((a, b) => a.name.localeCompare(b.name))
}

export function buildRegionsFile(mapSolarSystems, mapRegions, costIndices) {
  return {
    generatedAt: new Date().toISOString(),
    regions: buildRegionRecords(mapSolarSystems, mapRegions, costIndices),
  }
}
