import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { getValidAccessToken } from '@/services/auth/eveAuth'
import { EsiAuthError } from '@/services/character/esiAuthFetch'
import {
  fetchCharacterIndustryJobs,
  mapEsiIndustryJob,
} from '@/services/character/characterIndustryJobsService'
import {
  fetchCharacterBlueprints,
  mapEsiBlueprint,
  type BlueprintItemState,
} from '@/services/character/characterBlueprintsService'
import { EVE_BLUEPRINT_SCOPE, EVE_LOCATION_SCOPE } from '@/services/auth/ssoMetadata'
import { fetchCharacterSolarSystemId } from '@/services/character/characterLocationService'
import { resolvePublicStructuresNear } from '@/services/character/publicStructuresService'
import {
  fetchCharacterCorporationId,
  fetchCorporationAssets,
  fetchCorporationStructures,
} from '@/services/character/corporationIndustryService'
import { fetchCharacterAssets } from '@/services/character/characterAssetsService'
import { buildProductionLocations } from '@/lib/productionLocations'
import { aggregateAssetsAtLocation } from '@/lib/locationInventory'
import type { LiveIndustryJob, ProductionLocation } from '@/types'

const CHARACTER_DATA_STALE_MS = 10 * 60 * 1000
const CHARACTER_DATA_GC_MS = 24 * 60 * 60 * 1000

function fetchCharacterIndustryJobsQueryFn(characterId: number, forceRefresh = false) {
  return async (): Promise<LiveIndustryJob[]> => {
    const accessToken = await getValidAccessToken(characterId)
    if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
    const esiJobs = await fetchCharacterIndustryJobs(characterId, accessToken, { forceRefresh })
    return esiJobs.map((job) => mapEsiIndustryJob(job, characterId, ''))
  }
}

export function characterIndustryJobsQueryOptions(characterId: number, forceRefresh = false) {
  return {
    queryKey: ['character-industry-jobs', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: fetchCharacterIndustryJobsQueryFn(characterId, forceRefresh),
  }
}

export function useCharacterIndustryJobs(characterId: number | null | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    ...characterIndustryJobsQueryOptions(characterId!),
    enabled: characterId != null,
  })

  const refresh = async () => {
    if (characterId == null) return query.refetch()
    // Mark stale first; fetchQuery skips the network call while React Query data is still fresh.
    await queryClient.invalidateQueries({
      queryKey: ['character-industry-jobs', characterId],
      refetchType: 'none',
    })
    return queryClient.fetchQuery(characterIndustryJobsQueryOptions(characterId, true))
  }

  return { ...query, refetch: refresh }
}

export function useCharactersIndustryJobs(characterIds: readonly number[]) {
  return useQueries({
    queries: characterIds.map((characterId) => ({
      ...characterIndustryJobsQueryOptions(characterId),
      enabled: true,
    })),
  })
}

export function characterBlueprintsQueryOptions(characterId: number, forceRefresh = false) {
  const fetchOpts = forceRefresh ? { forceRefresh: true } : undefined
  return {
    queryKey: ['character-blueprints', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: false as const,
    retry: (failureCount: number, error: unknown) => {
      if (error instanceof EsiAuthError && error.status === 403) return false
      return failureCount < 2
    },
    queryFn: async (): Promise<Map<number, BlueprintItemState>> => {
      const accessToken = await getValidAccessToken(characterId)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      const blueprints = await fetchCharacterBlueprints(characterId, accessToken, fetchOpts)
      return new Map(blueprints.map((bp) => [bp.item_id, mapEsiBlueprint(bp)]))
    },
  }
}

export function useCharacterBlueprints(
  characterId: number | null | undefined,
  grantedScopes: readonly string[] = [],
) {
  const hasScope = grantedScopes.includes(EVE_BLUEPRINT_SCOPE)
  return useQuery({
    ...characterBlueprintsQueryOptions(characterId!),
    enabled: characterId != null && hasScope,
  })
}

function fetchProductionLocations(characterId: number, forceRefresh = false) {
  const fetchOpts = forceRefresh ? { forceRefresh: true } : undefined
  return async (): Promise<ProductionLocation[]> => {
    const accessToken = await getValidAccessToken(characterId)
    if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)

    const characterAssets = await fetchCharacterAssets(characterId, accessToken, fetchOpts)
    const esiJobs = await fetchCharacterIndustryJobs(characterId, accessToken, fetchOpts)

    let blueprints: Awaited<ReturnType<typeof fetchCharacterBlueprints>>
    try {
      blueprints = await fetchCharacterBlueprints(characterId, accessToken, fetchOpts)
    } catch {
      blueprints = []
    }

    let corpStructures: Awaited<ReturnType<typeof fetchCorporationStructures>> = []
    let corpAssets: Awaited<ReturnType<typeof fetchCorporationAssets>> = []
    const corporationId = await fetchCharacterCorporationId(characterId)
    if (corporationId) {
      try {
        corpStructures = await fetchCorporationStructures(corporationId, accessToken, fetchOpts)
      } catch {
        corpStructures = []
      }
      try {
        corpAssets = await fetchCorporationAssets(corporationId, accessToken, fetchOpts)
      } catch {
        corpAssets = []
      }
    }

    const jobs = esiJobs.map((job) =>
      mapEsiIndustryJob(job, characterId, `Type ${job.product_type_id ?? job.blueprint_type_id}`),
    )

    return buildProductionLocations({
      accessToken,
      characterAssets,
      corpAssets,
      blueprints,
      corpStructures,
      industryJobs: jobs,
    })
  }
}

export function productionLocationsQueryOptions(characterId: number, forceRefresh = false) {
  return {
    queryKey: ['production-locations', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: fetchProductionLocations(characterId, forceRefresh),
  }
}

export function useProductionLocations(characterId: number | null | undefined) {
  return useQuery({
    ...productionLocationsQueryOptions(characterId!),
    enabled: characterId != null,
  })
}

function fetchLocationInventoryQueryFn(
  characterId: number,
  locationId: number,
  forceRefresh = false,
) {
  return async (): Promise<Map<number, number>> => {
    const accessToken = await getValidAccessToken(characterId)
    if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)

    const characterAssets = await fetchCharacterAssets(characterId, accessToken, { forceRefresh })
    let allAssets = [...characterAssets]

    const corporationId = await fetchCharacterCorporationId(characterId)
    if (corporationId) {
      try {
        const corpAssets = await fetchCorporationAssets(corporationId, accessToken, { forceRefresh })
        allAssets = [...allAssets, ...corpAssets]
      } catch {
        // Corp assets unavailable without roles; character assets still count.
      }
    }

    return aggregateAssetsAtLocation(allAssets, locationId)
  }
}

export function locationInventoryQueryOptions(
  characterId: number,
  locationId: number,
  forceRefresh = false,
) {
  return {
    queryKey: ['location-inventory', characterId, locationId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: fetchLocationInventoryQueryFn(characterId, locationId, forceRefresh),
  }
}

export function useLocationInventory(
  characterId: number | null | undefined,
  locationId: number | null | undefined,
) {
  const queryClient = useQueryClient()
  const query = useQuery({
    ...locationInventoryQueryOptions(characterId!, locationId!),
    enabled: characterId != null && locationId != null,
  })

  const refresh = async () => {
    if (characterId == null || locationId == null) return query.refetch()
    await queryClient.invalidateQueries({
      queryKey: ['location-inventory', characterId, locationId],
      refetchType: 'none',
    })
    return queryClient.fetchQuery(
      locationInventoryQueryOptions(characterId, locationId, true),
    )
  }

  return { ...query, refetch: refresh }
}

export function characterSolarSystemQueryOptions(characterId: number) {
  return {
    queryKey: ['character-solar-system', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    queryFn: async (): Promise<number | null> => {
      const accessToken = await getValidAccessToken(characterId)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      return fetchCharacterSolarSystemId(characterId, accessToken)
    },
  }
}

export function useCharacterSolarSystem(
  characterId: number | null | undefined,
  grantedScopes: readonly string[] = [],
) {
  return useQuery({
    ...characterSolarSystemQueryOptions(characterId!),
    enabled: characterId != null && grantedScopes.includes(EVE_LOCATION_SCOPE),
  })
}

export function nearbyPublicStructuresQueryOptions(kind: 'manufacturing' | 'refinery') {
  return {
    queryKey: ['nearby-public-structures', kind] as const,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: CHARACTER_DATA_GC_MS,
    queryFn: () => resolvePublicStructuresNear(kind),
  }
}

export function useNearbyPublicStructures(kind: 'manufacturing' | 'refinery') {
  return useQuery(nearbyPublicStructuresQueryOptions(kind))
}
