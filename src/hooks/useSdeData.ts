import { useQuery } from '@tanstack/react-query'
import { loadSdeData, loadTypes, SDE_DATA_VERSION } from '@/services/data/sdeLoader'

export const SDE_QUERY_KEY = ['sde', SDE_DATA_VERSION] as const
export const SDE_TYPES_QUERY_KEY = ['sde', SDE_DATA_VERSION, 'types'] as const

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
