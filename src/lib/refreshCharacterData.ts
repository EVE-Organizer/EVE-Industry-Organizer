import type { QueryClient } from '@tanstack/react-query'
import { SDE_QUERY_KEY } from '@/hooks/useSdeData'
import { queryClient } from '@/lib/queryClient'
import { loadSdeData } from '@/services/data/sdeLoader'
import { clearPriceCache } from '@/services/cache/cacheStore'
import {
  useDataStatusStore,
  type RefreshScope,
  type SourceRefreshStatus,
} from '@/stores/dataStatusStore'

export type { RefreshScope }

export function classifyRefresh(input: {
  beforeChecksum?: string
  afterChecksum?: string
  serverExpiresAt?: number
  now?: number
  lastError?: string
}): SourceRefreshStatus {
  if (input.lastError) return 'failed'
  if (input.beforeChecksum !== input.afterChecksum) return 'updated'
  const now = input.now ?? Date.now()
  if (
    input.serverExpiresAt != null &&
    input.serverExpiresAt > now &&
    input.beforeChecksum === input.afterChecksum
  ) {
    return 'not-yet-updated-by-esi'
  }
  return 'unchanged'
}

/** Manual refresh for header controls and plan character bar. */
export async function refreshData(scope: RefreshScope, characterIds: number[]): Promise<void> {
  const { beginRefresh, endRefresh } = useDataStatusStore.getState()
  const toastId = beginRefresh(scope)
  const parts: string[] = []
  const statuses: SourceRefreshStatus[] = []

  try {
    if (scope === 'characters' || scope === 'all') {
      const ids = [...new Set(characterIds)]
      await Promise.all(
        ids.map((characterId) => refreshCharacterApiCaches(queryClient, characterId)),
      )
      parts.push(ids.length > 0 ? `${ids.length} character(s)` : 'Characters')
      statuses.push('updated')
    }
    if (scope === 'prices-live' || scope === 'all') {
      clearPriceCache()
      parts.push('Live prices')
      statuses.push('updated')
    }
    if (scope === 'static' || scope === 'all') {
      await queryClient.invalidateQueries({ queryKey: SDE_QUERY_KEY })
      await queryClient.fetchQuery({ queryKey: SDE_QUERY_KEY, queryFn: loadSdeData, staleTime: 0 })
      parts.push('Snapshot')
      statuses.push('updated')
    }
    endRefresh(scope, toastId, { parts, statuses })
  } catch (err) {
    endRefresh(scope, toastId, {
      parts: [err instanceof Error ? err.message : 'Refresh failed'],
      statuses: ['failed'],
    })
    throw err
  }
}
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
