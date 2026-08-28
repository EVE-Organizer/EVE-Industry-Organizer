import type { QueryClient } from '@tanstack/react-query'
import {
  characterIndustryJobsQueryOptions,
  characterBlueprintsQueryOptions,
  locationInventoryQueryOptions,
  productionLocationsQueryOptions,
} from '@/hooks/useCharacterIndustryData'
import {
  characterSkillQueueQueryOptions,
  characterAttributesQueryOptions,
  characterImplantsQueryOptions,
  characterSkillsQueryOptions,
} from '@/hooks/useCharacterSkillsData'

/** Force-refresh every ESI-backed query for a character (jobs, skills cache, locations, assets). */
export async function refreshCharacterApiCaches(
  queryClient: QueryClient,
  characterId: number,
): Promise<void> {
  const invalidateOnly = { refetchType: 'none' as const }

  await queryClient.invalidateQueries({
    queryKey: ['character-industry-jobs', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['production-locations', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['nearby-public-structures'],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['character-solar-system', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['character-blueprints', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['location-inventory', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['character-skillqueue', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['character-attributes', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['character-implants', characterId],
    ...invalidateOnly,
  })
  await queryClient.invalidateQueries({
    queryKey: ['character-skills', characterId],
    ...invalidateOnly,
  })

  const safeFetch = async (options: Parameters<QueryClient['fetchQuery']>[0]) => {
    try {
      await queryClient.fetchQuery(options)
    } catch {
      // Missing scopes or transient ESI errors should not block other refreshes.
    }
  }

  await Promise.all([
    safeFetch(characterIndustryJobsQueryOptions(characterId, true)),
    safeFetch(productionLocationsQueryOptions(characterId, true)),
    safeFetch(characterBlueprintsQueryOptions(characterId, true)),
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
