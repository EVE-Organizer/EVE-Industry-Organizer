import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useMapData } from '@/hooks/useMapData'
import {
  useCharacterSolarSystem,
  useNearbyPublicStructures,
  useProductionLocations,
} from '@/hooks/useCharacterIndustryData'
import { buildMapGraph } from '@/services/data/mapLoader'
import { jumpDistance } from '@/lib/nearestPublicHub'
import {
  inferOriginSystemId,
  mergeProductionLocations,
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
  const publicQuery = useNearbyPublicStructures(kind)

  const locations = useMemo(() => {
    const known = playerStructuresInRange(personal, null)
    const publicAll = publicQuery.data?.locations ?? []
    const merged = mergeProductionLocations(known, publicAll)
    const filtered = merged.filter((loc) => {
      if (kind === 'manufacturing') return !isRefineryStructureTypeId(loc.structureTypeId)
      return !isEngineeringStructureTypeId(loc.structureTypeId)
    })
    return filtered.sort((a, b) => {
      const jumpA =
        graph && originSystemId != null && a.solarSystemId > 0
          ? (jumpDistance(graph, originSystemId, a.solarSystemId) ?? 99)
          : 99
      const jumpB =
        graph && originSystemId != null && b.solarSystemId > 0
          ? (jumpDistance(graph, originSystemId, b.solarSystemId) ?? 99)
          : 99
      if (jumpA !== jumpB) return jumpA - jumpB
      return a.name.localeCompare(b.name)
    })
  }, [graph, kind, originSystemId, personal, publicQuery.data?.locations])

  function jumpsTo(location: ProductionLocation): number | null {
    if (!graph || originSystemId == null || location.solarSystemId <= 0) return null
    return jumpDistance(graph, originSystemId, location.solarSystemId)
  }

  return {
    characterId,
    locations,
    originSystemId,
    jumpsTo,
    isLoading: locationsQuery.isLoading,
    error: locationsQuery.error ?? publicQuery.error ?? null,
  }
}
