import type { QueryClient } from '@tanstack/react-query'
import {
  characterIndustryJobsQueryOptions,
  characterBlueprintsQueryOptions,
  characterSolarSystemQueryOptions,
  locationInventoryQueryOptions,
  productionLocationsQueryOptions,
} from '@/hooks/useCharacterIndustryData'
import {
  characterSkillQueueQueryOptions,
  characterAttributesQueryOptions,
  characterImplantsQueryOptions,
  characterSkillsQueryOptions,
} from '@/hooks/useCharacterSkillsData'

function characterQueryKeys(characterId: number) {
  return [
    ['character-industry-jobs', characterId],
    ['production-locations', characterId],
    ['character-solar-system', characterId],
    ['character-blueprints', characterId],
    ['location-inventory', characterId],
    ['character-skillqueue', characterId],
    ['character-attributes', characterId],
    ['character-implants', characterId],
    ['character-skills', characterId],
  ] as const
}

/** Force-refresh every ESI-backed query for a character (jobs, skills cache, locations, assets). */
export async function refreshCharacterApiCaches(
  queryClient: QueryClient,
  characterId: number,
): Promise<void> {
  const keys = characterQueryKeys(characterId)

  // Drop in-flight fetches so a manual refresh cannot reuse a stale queryFn.
  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })))

  const invalidateOnly = { refetchType: 'none' as const }
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, ...invalidateOnly })),
  )
  await queryClient.invalidateQueries({
    queryKey: ['nearby-public-structures'],
    ...invalidateOnly,
  })

  const safeFetch = async (options: Parameters<QueryClient['fetchQuery']>[0]) => {
    try {
      await queryClient.fetchQuery({ ...options, staleTime: 0 })
    } catch {
      // Missing scopes or transient ESI errors should not block other refreshes.
    }
  }

  await Promise.all([
    safeFetch(characterIndustryJobsQueryOptions(characterId, true)),
    safeFetch(productionLocationsQueryOptions(characterId, true)),
    safeFetch(characterBlueprintsQueryOptions(characterId, true)),
    safeFetch(characterSolarSystemQueryOptions(characterId, true)),
    safeFetch(characterSkillQueueQueryOptions(characterId, true)),
    safeFetch(characterAttributesQueryOptions(characterId, true)),
    safeFetch(characterImplantsQueryOptions(characterId, true)),
    safeFetch(characterSkillsQueryOptions(characterId, true)),
  ])

  const inventoryQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['location-inventory', characterId] })

  await Promise.all(
    inventoryQueries.map((entry) => {
      const locationId = entry.queryKey[2]
      if (typeof locationId !== 'number') return Promise.resolve()
      return safeFetch(locationInventoryQueryOptions(characterId, locationId, true))
    }),
  )
}
