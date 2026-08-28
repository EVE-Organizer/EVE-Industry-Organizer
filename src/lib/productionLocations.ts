import type { LiveIndustryJob, ProductionLocation } from '@/types'
import type { EsiAsset } from '@/services/character/characterAssetsService'
import type { EsiBlueprint } from '@/services/character/characterBlueprintsService'
import type { EsiCorpStructure } from '@/services/character/corporationIndustryService'
import {
  fetchUniverseStation,
  fetchUniverseStructure,
} from '@/services/character/corporationIndustryService'

function locationKey(kind: ProductionLocation['kind'], locationId: number): string {
  return `${kind}:${locationId}`
}

export function facilityKind(locationId: number): ProductionLocation['kind'] {
  return locationId >= 1_000_000_000_000 ? 'structure' : 'station'
}

export function makeProductionLocation(
  partial: Omit<ProductionLocation, 'id'>,
): ProductionLocation {
  return { ...partial, id: locationKey(partial.kind, partial.locationId) }
}

function placeholderName(kind: ProductionLocation['kind'], locationId: number): string {
  return kind === 'structure' ? `Structure ${locationId}` : `Station ${locationId}`
}

function needsLocationEnrichment(loc: ProductionLocation): boolean {
  if (loc.kind === 'structure') {
    // Player structures require auth; skip lookup when corp data already has system and type.
    if (loc.solarSystemId > 0 && loc.structureTypeId != null) return false

    return loc.structureTypeId == null || loc.solarSystemId === 0
  }

  return (
    loc.solarSystemId === 0 ||
    loc.name.startsWith('Facility ') ||
    loc.name.startsWith('Station ') ||
    loc.name.startsWith('Location ')
  )
}

function addBuildLocation(
  byId: Map<string, ProductionLocation>,
  locationId: number,
  source: ProductionLocation['source'],
  extras?: Partial<Pick<ProductionLocation, 'name' | 'solarSystemId' | 'structureTypeId'>>,
) {
  const kind = facilityKind(locationId)
  const key = locationKey(kind, locationId)
  const existing = byId.get(key)
  if (existing) {
    if (extras?.structureTypeId != null) existing.structureTypeId = extras.structureTypeId
    if (extras?.solarSystemId != null && extras.solarSystemId > 0) {
      existing.solarSystemId = extras.solarSystemId
    }
    if (extras?.name != null && !extras.name.startsWith('Facility ')) existing.name = extras.name
    return
  }

  byId.set(
    key,
    makeProductionLocation({
      locationId,
      kind,
      name: extras?.name ?? placeholderName(kind, locationId),
      solarSystemId: extras?.solarSystemId ?? 0,
      structureTypeId: extras?.structureTypeId,
      source,
    }),
  )
}

function addAssetLocations(
  byId: Map<string, ProductionLocation>,
  assets: EsiAsset[],
  source: ProductionLocation['source'],
) {
  for (const asset of assets) {
    if (asset.location_type !== 'station' && asset.location_type !== 'other') continue
    addBuildLocation(byId, asset.location_id, source)
  }
}

function addBlueprintLocations(
  byId: Map<string, ProductionLocation>,
  blueprints: EsiBlueprint[],
) {
  for (const blueprint of blueprints) {
    addBuildLocation(byId, blueprint.location_id, 'blueprint')
  }
}

export async function buildProductionLocations(input: {
  accessToken: string
  characterAssets: EsiAsset[]
  corpAssets: EsiAsset[]
  blueprints: EsiBlueprint[]
  corpStructures: EsiCorpStructure[]
  industryJobs: LiveIndustryJob[]
}): Promise<ProductionLocation[]> {
  const byId = new Map<string, ProductionLocation>()

  for (const job of input.industryJobs) {
    addBuildLocation(byId, job.facilityId, 'industry_job')
  }

  for (const structure of input.corpStructures) {
    addBuildLocation(byId, structure.structure_id, 'corp_structure', {
      name: structure.name ?? placeholderName('structure', structure.structure_id),
      solarSystemId: structure.system_id,
      structureTypeId: structure.type_id,
    })
  }

  addAssetLocations(byId, input.characterAssets, 'character_asset')
  addAssetLocations(byId, input.corpAssets, 'corp_asset')
  addBlueprintLocations(byId, input.blueprints)

  const locations = [...byId.values()]
  for (const loc of locations) {
    if (!needsLocationEnrichment(loc)) continue

    if (loc.kind === 'structure') {
      const info = await fetchUniverseStructure(loc.locationId, input.accessToken)
      if (info) {
        loc.name = info.name
        loc.solarSystemId = info.solar_system_id
        loc.structureTypeId = info.type_id
      }
    } else {
      const info = await fetchUniverseStation(loc.locationId)
      if (info) {
        loc.name = info.name
        loc.solarSystemId = info.system_id
      }
    }
  }

  return locations.sort((a, b) => a.name.localeCompare(b.name))
}

export const PLAYER_STRUCTURE_JUMP_RADIUS = 3

export function inferOriginSystemId(locations: ProductionLocation[]): number | null {
  const counts = new Map<number, number>()
  for (const loc of locations) {
    if (loc.kind !== 'structure' || loc.solarSystemId <= 0) continue
    counts.set(loc.solarSystemId, (counts.get(loc.solarSystemId) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [systemId, count] of counts) {
    if (count > bestCount) {
      best = systemId
      bestCount = count
    }
  }
  return best
}

export function playerStructuresInRange(
  locations: ProductionLocation[],
  nearbySystems: Set<number> | null,
): ProductionLocation[] {
  const player = locations.filter((loc) => loc.kind === 'structure')
  if (!nearbySystems) return player
  return player.filter((loc) => loc.solarSystemId <= 0 || nearbySystems.has(loc.solarSystemId))
}

export function mergeProductionLocations(
  ...lists: ProductionLocation[][]
): ProductionLocation[] {
  const byId = new Map<string, ProductionLocation>()
  for (const list of lists) {
    for (const loc of list) {
      if (!byId.has(loc.id)) byId.set(loc.id, loc)
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function findProductionLocation(
  locations: ProductionLocation[],
  locationId: number | null | undefined,
  kind: ProductionLocation['kind'] | null | undefined,
): ProductionLocation | null {
  if (locationId == null) return null
  const key = locationKey(kind ?? facilityKind(locationId), locationId)
  return locations.find((l) => l.id === key) ?? null
}
