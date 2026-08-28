import { getCached } from '@/services/cache/cacheStore'
import { esiPublicGet } from '@/services/character/esiAuthFetch'
import {
  fetchUniverseStructure,
  type EsiUniverseStructure,
} from '@/services/character/corporationIndustryService'
import { makeProductionLocation } from '@/lib/productionLocations'
import type { ProductionLocation } from '@/types'

const PUBLIC_RESOLVE_PER_PASS = 15

function structureCacheKey(structureId: number): string {
  return `esi:structure:${structureId}`
}

export async function fetchPublicStructureIds(): Promise<number[]> {
  const data = await esiPublicGet<number[]>('/universe/structures/', {
    cacheKey: 'esi:public-structures:all',
  })
  return Array.isArray(data) ? data : []
}

function toPublicLocation(structureId: number, info: EsiUniverseStructure): ProductionLocation {
  return makeProductionLocation({
    locationId: structureId,
    kind: 'structure',
    name: info.name,
    solarSystemId: info.solar_system_id,
    structureTypeId: info.type_id,
    source: 'public_structure',
  })
}

export async function resolvePublicStructuresNear(
  accessToken: string,
  nearbySystems: Set<number>,
): Promise<{ locations: ProductionLocation[]; unresolved: number }> {
  const ids = await fetchPublicStructureIds()
  const missing: number[] = []
  const locations: ProductionLocation[] = []

  for (const id of ids) {
    const cached = getCached<EsiUniverseStructure | null>(structureCacheKey(id))
    if (!cached) {
      missing.push(id)
      continue
    }
    if (cached.data && nearbySystems.has(cached.data.solar_system_id)) {
      locations.push(toPublicLocation(id, cached.data))
    }
  }

  const batch = missing.slice(0, PUBLIC_RESOLVE_PER_PASS)
  for (const id of batch) {
    const info = await fetchUniverseStructure(id, accessToken)
    if (info && nearbySystems.has(info.solar_system_id)) {
      locations.push(toPublicLocation(id, info))
    }
  }

  return {
    locations,
    unresolved: Math.max(0, missing.length - batch.length),
  }
}
