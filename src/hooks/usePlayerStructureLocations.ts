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
  STRUCTURE_PICKER_MAX_JUMPS,
  inferOriginSystemId,
  mergeProductionLocations,
  playerManufacturingStructures,
  playerStructuresInRange,
} from '@/lib/productionLocations'
import { isRefineryStructureTypeId } from '@/lib/refinerySettings'
import { isEngineeringStructureTypeId } from '@/lib/structureSettings'
import type { ProductionLocation } from '@/types'

function sortLocationsByJump(
  rows: ProductionLocation[],
  graph: ReturnType<typeof buildMapGraph> | null,
  originSystemId: number | null,
): ProductionLocation[] {
  return rows.sort((a, b) => {
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
}

export function usePlayerStructureLocations(
  fallbackSystemId: number | null | undefined,
  kind: 'manufacturing' | 'refinery',
) {
  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const characters = useAuthStore((s) => s.characters)
  const granted = characters.find((c) => c.characterId === activeCharacterId)?.scopes ?? []
  const characterId = configured && activeCharacterId != null ? activeCharacterId : null

  const locationsQuery = useProductionLocations(characterId)
  const { data: characterSystemId } = useCharacterSolarSystem(characterId, granted)
  const { data: mapData, isLoading: mapLoading } = useMapData()

  const personal = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data])
  const originSystemId =
    characterSystemId ?? inferOriginSystemId(personal) ?? fallbackSystemId ?? null

  const graph = useMemo(() => (mapData ? buildMapGraph(mapData) : null), [mapData])
  const publicQuery = useNearbyPublicStructures('refinery')
  const nearbySystems = useMemo(() => {
    if (!graph || originSystemId == null) return null
    return systemsWithinJumps(graph, originSystemId, STRUCTURE_PICKER_MAX_JUMPS)
  }, [graph, originSystemId])

  const locations = useMemo(() => {
    if (kind === 'manufacturing') {
      const manufacturing = playerManufacturingStructures(personal).filter(
        (loc) => !isRefineryStructureTypeId(loc.structureTypeId),
      )
      return sortLocationsByJump(manufacturing, graph, originSystemId)
    }

    const known = playerStructuresInRange(personal, nearbySystems)
    const publicNearby = nearbySystems
      ? (publicQuery.data?.locations ?? []).filter((loc) => nearbySystems.has(loc.solarSystemId))
      : []
    const merged = mergeProductionLocations(known, publicNearby)
    const filtered = merged.filter((loc) => !isEngineeringStructureTypeId(loc.structureTypeId))
    return sortLocationsByJump(filtered, graph, originSystemId)
  }, [graph, kind, nearbySystems, originSystemId, personal, publicQuery.data?.locations])

  function jumpsTo(location: ProductionLocation): number | null {
    if (!graph || originSystemId == null || location.solarSystemId <= 0) return null
    return jumpDistance(graph, originSystemId, location.solarSystemId)
  }

  const isResolving =
    kind === 'refinery' &&
    originSystemId != null &&
    (mapLoading || (graph != null && nearbySystems == null))

  return {
    characterId,
    locations,
    personalLocations: personal,
    originSystemId,
    jumpsTo,
    isLoading: locationsQuery.isLoading,
    isResolving,
    error: locationsQuery.error ?? (kind === 'refinery' ? (publicQuery.error ?? null) : null),
  }
}
