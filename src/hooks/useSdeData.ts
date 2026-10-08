import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DataVersion } from '@/lib/dataSources'
import { publicDataUrl } from '@/lib/paths'
import { loadSdeData, loadTypes, SDE_DATA_VERSION } from '@/services/data/sdeLoader'

export const SDE_QUERY_KEY = ['sde', SDE_DATA_VERSION] as const
export const SDE_TYPES_QUERY_KEY = ['sde', SDE_DATA_VERSION, 'types'] as const
const DATA_VERSION_QUERY_KEY = ['data-version'] as const

async function loadDataVersion(): Promise<DataVersion> {
  const response = await fetch(publicDataUrl('version.json'), { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to fetch version.json: ${response.status}`)
  return response.json() as Promise<DataVersion>
}

export function useSdeData(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: SDE_QUERY_KEY,
    queryFn: loadSdeData,
    staleTime: Infinity,
    enabled: options?.enabled ?? true,
  })
}

/** types.json only — navbar search must not pull market.json. */
export function useTypesData(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: SDE_TYPES_QUERY_KEY,
    queryFn: loadTypes,
    staleTime: Infinity,
    enabled: options?.enabled ?? true,
  })
}

/** Compare bundled snapshot prices with public/data/version.json for reload prompts. */
export function useDataVersion() {
  const queryClient = useQueryClient()
  const sde = useSdeData()
  const version = useQuery({
    queryKey: DATA_VERSION_QUERY_KEY,
    queryFn: loadDataVersion,
    staleTime: 5 * 60 * 1000,
  })
  const loadedMarketAt = sde.data?.market.generatedAt
  const remoteMarketAt = version.data?.marketGeneratedAt
  const updateAvailable =
    loadedMarketAt != null && remoteMarketAt != null && loadedMarketAt !== remoteMarketAt

  const reloadSnapshot = () => {
    void queryClient.invalidateQueries({ queryKey: SDE_QUERY_KEY })
    void queryClient.fetchQuery({ queryKey: SDE_QUERY_KEY, queryFn: loadSdeData, staleTime: 0 })
    void version.refetch()
  }

  return {
    data: version.data,
    updateAvailable,
    reloadSnapshot,
    isLoading: version.isLoading || sde.isLoading,
  }
}
