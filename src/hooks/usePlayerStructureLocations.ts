import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useMapData } from '@/hooks/useMapData'
import {
  useCharacterSolarSystem,
  useNearbyPublicStructures,
  useProductionLocations,
} from '@/hooks/useCharacterIndustryData'
import { buildMapGraph } from '@/services/data/mapLoader'
import { jumpDistance, systemsWithinJumps } from '@/lib/nearestPublicHub'
import {
  inferOriginSystemId,
  mergeProductionLocations,
  PLAYER_STRUCTURE_JUMP_RADIUS,
  playerStructuresInRange,
} from '@/lib/productionLocations'
import { isEngineeringStructureTypeId } from '@/lib/structureTypeFromTypeId'
import { isRefineryStructureTypeId } from '@/lib/refineryTypeFromTypeId'
import type { ProductionLocation } from '@/types'

export function usePlayerStructureLocations(
  fallbackSystemId: number | null | undefined,
  kind: 'manufacturing' | 'refinery',
) {
  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const characters = useAuthStore((s) => s.characters)
  const granted =
    characters.find((c) => c.characterId === activeCharacterId)?.scopes ?? []
  const characterId = configured && activeCharacterId != null ? activeCharacterId : null

  const locationsQuery = useProductionLocations(characterId)
  const { data: characterSystemId } = useCharacterSolarSystem(characterId, granted)
  const { data: mapData } = useMapData()

  const personal = locationsQuery.data ?? []
  const originSystemId =
    characterSystemId ?? inferOriginSystemId(personal) ?? fallbackSystemId ?? null

  const graph = useMemo(() => (mapData ? buildMapGraph(mapData) : null), [mapData])
  const nearbySystems = useMemo(() => {
    if (!graph || originSystemId == null || originSystemId <= 0) return null
    return systemsWithinJumps(graph, originSystemId, PLAYER_STRUCTURE_JUMP_RADIUS)
  }, [graph, originSystemId])

  const publicQuery = useNearbyPublicStructures(characterId, originSystemId)

  const locations = useMemo(() => {
    const ranged = playerStructuresInRange(personal, nearbySystems)
    const publicNear = publicQuery.data?.locations ?? []
    const merged = mergeProductionLocations(ranged, publicNear)
    return merged.filter((loc) => {
      if (kind === 'manufacturing') return !isRefineryStructureTypeId(loc.structureTypeId)
      return !isEngineeringStructureTypeId(loc.structureTypeId)
    })
  }, [kind, nearbySystems, personal, publicQuery.data?.locations])

  function jumpsTo(location: ProductionLocation): number | null {
    if (!graph || originSystemId == null || location.solarSystemId <= 0) return null
    return jumpDistance(graph, originSystemId, location.solarSystemId)
  }

  return {
    characterId,
    locations,
    originSystemId,
    nearbySystems,
    jumpsTo,
    isLoading: locationsQuery.isLoading,
    error: locationsQuery.error ?? publicQuery.error ?? null,
  }
}
