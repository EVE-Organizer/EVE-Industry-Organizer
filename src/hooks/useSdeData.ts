import { useQuery } from '@tanstack/react-query'
import { loadSdeData } from '@/services/data/sdeLoader'

const SDE_QUERY_KEY = ['sde'] as const

export function useSdeData() {
  return useQuery({
    queryKey: SDE_QUERY_KEY,
    queryFn: loadSdeData,
    staleTime: Infinity,
  })
}
