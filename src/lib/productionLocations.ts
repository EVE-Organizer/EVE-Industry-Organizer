import type { LiveIndustryJob, ProductionLocation } from '@/types'
import type { EsiAsset } from '@/services/character/characterAssetsService'
import type { EsiBlueprint } from '@/services/character/characterBlueprintsService'
import type { EsiCorpStructure } from '@/services/character/corporationIndustryService'
import {
  fetchUniverseStation,
  fetchUniverseStructure,
} from '@/services/character/corporationIndustryService'
import { loadIndustryStructures } from '@/services/character/publicStructuresService'
import { buildItemLocationMap, resolveFacilityId } from '@/lib/locationInventory'

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

function isPlaceholderName(name: string): boolean {
  return (
    name.startsWith('Station ') ||
    name.startsWith('Structure ') ||
    name.startsWith('Facility ') ||
    name.startsWith('Location ')
  )
}

function preferName(current: string, next: string): string {
  if (!isPlaceholderName(next)) return next
  return isPlaceholderName(current) ? next : current
}

const SOURCE_PRIORITY: Partial<Record<ProductionLocation['source'], number>> = {
  blueprint: 3,
  industry_job: 2,
  character_asset: 1,
  corp_asset: 1,
}

function shouldUpgradeSource(
  current: ProductionLocation['source'],
  next: ProductionLocation['source'],
): boolean {
  return (SOURCE_PRIORITY[next] ?? 0) > (SOURCE_PRIORITY[current] ?? 0)
}

function needsLocationEnrichment(loc: ProductionLocation): boolean {
  if (isPlaceholderName(loc.name)) return true

  if (loc.kind === 'structure') {
    if (loc.solarSystemId > 0 && loc.structureTypeId != null) return false
    return loc.structureTypeId == null || loc.solarSystemId === 0
  }

  return loc.solarSystemId === 0
}

function mergeLocationFields(existing: ProductionLocation, loc: ProductionLocation): void {
  existing.name = preferName(existing.name, loc.name)
  if (existing.structureTypeId == null && loc.structureTypeId != null) {
    existing.structureTypeId = loc.structureTypeId
  }
  if (existing.solarSystemId <= 0 && loc.solarSystemId > 0) {
    existing.solarSystemId = loc.solarSystemId
  }
  if (shouldUpgradeSource(existing.source, loc.source)) {
    existing.source = loc.source
  }
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
    if (extras?.name != null) existing.name = preferName(existing.name, extras.name)
    if (shouldUpgradeSource(existing.source, source)) existing.source = source
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
  itemLocations: Map<number, number>,
) {
  for (const blueprint of blueprints) {
    const facilityId = resolveFacilityId(blueprint.location_id, itemLocations)
    addBuildLocation(byId, facilityId, 'blueprint')
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
  const allAssets = [...input.characterAssets, ...input.corpAssets]
  const itemLocations = buildItemLocationMap(allAssets)
  const structureCatalog = new Map((await loadIndustryStructures()).map((row) => [row.id, row]))

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
  addBlueprintLocations(byId, input.blueprints, itemLocations)

  const locations = [...byId.values()]
  for (const loc of locations) {
    if (!needsLocationEnrichment(loc)) continue

    if (loc.kind === 'structure') {
      const info = await fetchUniverseStructure(loc.locationId, input.accessToken)
      if (info) {
        loc.name = info.name
        loc.solarSystemId = info.solar_system_id
        loc.structureTypeId = info.type_id
        continue
      }

      const catalog = structureCatalog.get(loc.locationId)
      if (catalog) {
        loc.name = catalog.name
        loc.solarSystemId = catalog.solarSystemId
        loc.structureTypeId = catalog.typeId
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

/** Public + corp structures past this are dropped; hangars with items stay. */
export const STRUCTURE_PICKER_MAX_JUMPS = 5

function hasStoredItems(location: ProductionLocation): boolean {
  return (
    location.source === 'character_asset' ||
    location.source === 'corp_asset' ||
    location.source === 'blueprint'
  )
}

export function playerStructuresInRange(
  locations: ProductionLocation[],
  nearbySystems: Set<number> | null,
): ProductionLocation[] {
  const player = locations.filter((loc) => loc.kind === 'structure')
  if (!nearbySystems) return player
  return player.filter(
    (loc) => hasStoredItems(loc) || loc.solarSystemId <= 0 || nearbySystems.has(loc.solarSystemId),
  )
}

/** Manufacturing picker: only structures that hold blueprints or active industry jobs. */
export function playerManufacturingStructures(
  locations: ProductionLocation[],
): ProductionLocation[] {
  return locations.filter(
    (loc) =>
      loc.kind === 'structure' && (loc.source === 'blueprint' || loc.source === 'industry_job'),
  )
}

export function mergeProductionLocations(...lists: ProductionLocation[][]): ProductionLocation[] {
  const byId = new Map<string, ProductionLocation>()
  for (const list of lists) {
    for (const loc of list) {
      const existing = byId.get(loc.id)
      if (!existing) {
        byId.set(loc.id, { ...loc })
        continue
      }
      mergeLocationFields(existing, loc)
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

  const preferredKey = locationKey(kind ?? facilityKind(locationId), locationId)
  const direct = locations.find((l) => l.id === preferredKey)
  if (direct) return direct

  const inferredKind = facilityKind(locationId)
  if (kind != null && kind !== inferredKind) {
    const alternateKey = locationKey(inferredKind, locationId)
    const alternate = locations.find((l) => l.id === alternateKey)
    if (alternate) return alternate
  }

  return locations.find((l) => l.locationId === locationId) ?? null
}
