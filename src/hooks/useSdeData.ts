import { useQuery } from '@tanstack/react-query'
import { loadSdeData, SDE_DATA_VERSION } from '@/services/data/sdeLoader'

const SDE_QUERY_KEY = ['sde', SDE_DATA_VERSION] as const

export function useSdeData() {
  return useQuery({
    queryKey: SDE_QUERY_KEY,
    queryFn: loadSdeData,
    staleTime: Infinity,
  })
}
