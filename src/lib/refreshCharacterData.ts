import type { QueryClient } from '@tanstack/react-query'
import { SDE_QUERY_KEY } from '@/hooks/useSdeData'
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
import { queryClient } from '@/lib/queryClient'
import { loadSdeData } from '@/services/data/sdeLoader'
import { clearPriceCache } from '@/services/cache/cacheStore'
import {
  useDataStatusStore,
  type RefreshScope,
  type SourceRefreshStatus,
} from '@/stores/dataStatusStore'

export type { RefreshScope }

export type RefreshDataOptions = {
  productionLocationId?: number | null
}

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
export async function refreshData(
  scope: RefreshScope,
  characterIds: number[],
  options: RefreshDataOptions = {},
): Promise<void> {
  const { beginRefresh, endRefresh } = useDataStatusStore.getState()
  const toastId = beginRefresh(scope)
  const parts: string[] = []
  const statuses: SourceRefreshStatus[] = []

  try {
    if (scope === 'plan') {
      const ids = [...new Set(characterIds)]
      const locationId = options.productionLocationId
      clearPriceCache()
      await Promise.all(
        ids.map(async (characterId) => {
          await refreshPlanCharacterApiCaches(queryClient, characterId, locationId)
          try {
            const { useAuthStore } = await import('@/stores/authStore')
            await useAuthStore.getState().syncSkills(characterId, { silent: true })
          } catch {
            // Skill sync failure should not block jobs and inventory refresh.
          }
        }),
      )
      parts.push('Live prices')
      if (locationId != null) {
        parts.push('Hangar stock')
      } else if (ids.length > 0) {
        parts.push('Hangar stock skipped (no manufacturing location)')
      }
      parts.push(ids.length > 0 ? `${ids.length} character(s)` : 'In-game data')
      statuses.push('updated')
    }
    if (scope === 'characters' || scope === 'all') {
      const ids = [...new Set(characterIds)]
      const locationId = options.productionLocationId
      await Promise.all(
        ids.map((characterId) => refreshCharacterApiCaches(queryClient, characterId)),
      )
      if (locationId != null) {
        await Promise.all(
          ids.map((characterId) =>
            forceRefreshLocationInventory(queryClient, characterId, locationId),
          ),
        )
      }
      parts.push(ids.length > 0 ? `${ids.length} character(s)` : 'Characters')
      if (locationId != null) parts.push('Hangar stock')
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

async function safeFetchQuery(
  queryClient: QueryClient,
  options: Parameters<QueryClient['fetchQuery']>[0],
): Promise<void> {
  try {
    await queryClient.fetchQuery({ ...options, staleTime: 0 })
  } catch {
    // Missing scopes or transient ESI errors should not block other refreshes.
  }
}

/** Same cancel → invalidate → force fetch pattern as useLocationInventory().refetch. */
export async function forceRefreshLocationInventory(
  queryClient: QueryClient,
  characterId: number,
  locationId: number,
): Promise<void> {
  const queryKey = ['location-inventory', characterId, locationId] as const
  await queryClient.cancelQueries({ queryKey })
  await queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
  await safeFetchQuery(queryClient, locationInventoryQueryOptions(characterId, locationId, true))
}

/** Plan refresh: jobs, blueprints, and hangar stock — skip heavy location discovery. */
export async function refreshPlanCharacterApiCaches(
  queryClient: QueryClient,
  characterId: number,
  productionLocationId?: number | null,
): Promise<void> {
  const keys = [
    ['character-industry-jobs', characterId],
    ['character-blueprints', characterId],
  ] as const

  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })))

  const invalidateOnly = { refetchType: 'none' as const }
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, ...invalidateOnly })),
  )

  const inventoryRefresh =
    productionLocationId != null
      ? forceRefreshLocationInventory(queryClient, characterId, productionLocationId)
      : refreshCachedLocationInventories(queryClient, characterId)

  await Promise.all([
    safeFetchQuery(queryClient, characterIndustryJobsQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, characterBlueprintsQueryOptions(characterId, true)),
    inventoryRefresh,
  ])
}

async function refreshCachedLocationInventories(
  queryClient: QueryClient,
  characterId: number,
): Promise<void> {
  const inventoryQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['location-inventory', characterId] })

  await Promise.all(
    inventoryQueries.map((entry) => {
      const locationId = entry.queryKey[2]
      if (typeof locationId !== 'number') return Promise.resolve()
      return forceRefreshLocationInventory(queryClient, characterId, locationId)
    }),
  )
}

export type RefreshCharacterApiCachesOptions = {
  /** Skills were synced separately — skip a duplicate ESI skills request. */
  skipSkillsFetch?: boolean
}

/** Force-refresh every ESI-backed query for a character (jobs, skills cache, locations, assets). */
export async function refreshCharacterApiCaches(
  queryClient: QueryClient,
  characterId: number,
  options: RefreshCharacterApiCachesOptions = {},
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

  const fetches: Promise<void>[] = [
    safeFetchQuery(queryClient, characterIndustryJobsQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, productionLocationsQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, characterBlueprintsQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, characterSolarSystemQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, characterSkillQueueQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, characterAttributesQueryOptions(characterId, true)),
    safeFetchQuery(queryClient, characterImplantsQueryOptions(characterId, true)),
  ]
  if (!options.skipSkillsFetch) {
    fetches.push(safeFetchQuery(queryClient, characterSkillsQueryOptions(characterId, true)))
  }
  await Promise.all(fetches)

  await refreshCachedLocationInventories(queryClient, characterId)
}
