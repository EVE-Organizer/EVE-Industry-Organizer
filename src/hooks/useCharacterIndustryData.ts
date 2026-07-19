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
import { EVE_BLUEPRINT_SCOPE } from '@/services/auth/ssoMetadata'
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
    refetchOnMount: false as const,
    queryFn: fetchCharacterIndustryJobsQueryFn(characterId, forceRefresh),
  }
}

export function useCharacterIndustryJobs(characterId: number | null | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    ...characterIndustryJobsQueryOptions(characterId!),
    enabled: characterId != null,
  })

  const refresh = () => {
    if (characterId == null) return query.refetch()
    return queryClient.fetchQuery({
      ...characterIndustryJobsQueryOptions(characterId, true),
    })
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

export function useCharacterBlueprints(
  characterId: number | null | undefined,
  grantedScopes: readonly string[] = [],
) {
  const hasScope = grantedScopes.includes(EVE_BLUEPRINT_SCOPE)
  return useQuery({
    queryKey: ['character-blueprints', characterId],
    enabled: characterId != null && hasScope,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      if (error instanceof EsiAuthError && error.status === 403) return false
      return failureCount < 2
    },
    queryFn: async (): Promise<Map<number, BlueprintItemState>> => {
      const accessToken = await getValidAccessToken(characterId!)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      const blueprints = await fetchCharacterBlueprints(characterId!, accessToken)
      return new Map(blueprints.map((bp) => [bp.item_id, mapEsiBlueprint(bp)]))
    },
  })
}

export function useProductionLocations(characterId: number | null | undefined) {
  return useQuery({
    queryKey: ['production-locations', characterId],
    enabled: characterId != null,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: false,
    queryFn: async (): Promise<ProductionLocation[]> => {
      const accessToken = await getValidAccessToken(characterId!)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)

      const characterAssets = await fetchCharacterAssets(characterId!, accessToken)
      const esiJobs = await fetchCharacterIndustryJobs(characterId!, accessToken)

      let blueprints: Awaited<ReturnType<typeof fetchCharacterBlueprints>> = []
      try {
        blueprints = await fetchCharacterBlueprints(characterId!, accessToken)
      } catch {
        blueprints = []
      }

      let corpStructures: Awaited<ReturnType<typeof fetchCorporationStructures>> = []
      let corpAssets: Awaited<ReturnType<typeof fetchCorporationAssets>> = []
      const corporationId = await fetchCharacterCorporationId(characterId!)
      if (corporationId) {
        try {
          corpStructures = await fetchCorporationStructures(corporationId, accessToken)
        } catch {
          corpStructures = []
        }
        try {
          corpAssets = await fetchCorporationAssets(corporationId, accessToken)
        } catch {
          corpAssets = []
        }
      }

      const jobs = esiJobs.map((job) =>
        mapEsiIndustryJob(job, characterId!, `Type ${job.product_type_id ?? job.blueprint_type_id}`),
      )

      return buildProductionLocations({
        accessToken,
        characterAssets,
        corpAssets,
        blueprints,
        corpStructures,
        industryJobs: jobs,
      })
    },
  })
}

export function useLocationInventory(
  characterId: number | null | undefined,
  locationId: number | null | undefined,
) {
  return useQuery({
    queryKey: ['location-inventory', characterId, locationId],
    enabled: characterId != null && locationId != null,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: false,
    queryFn: async (): Promise<Map<number, number>> => {
      const accessToken = await getValidAccessToken(characterId!)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)

      const characterAssets = await fetchCharacterAssets(characterId!, accessToken)
      let allAssets = [...characterAssets]

      const corporationId = await fetchCharacterCorporationId(characterId!)
      if (corporationId) {
        try {
          const corpAssets = await fetchCorporationAssets(corporationId, accessToken)
          allAssets = [...allAssets, ...corpAssets]
        } catch {
          // Corp assets unavailable without roles; character assets still count.
        }
      }

      return aggregateAssetsAtLocation(allAssets, locationId!)
    },
  })
}
