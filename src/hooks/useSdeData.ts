import { useQuery } from '@tanstack/react-query'
import { loadSdeData } from '@/services/data/sdeLoader'
import { queryKeys } from '@/services/queryKeys'

export function useSdeData() {
  return useQuery({
    queryKey: queryKeys.sde.all,
    queryFn: loadSdeData,
    staleTime: Infinity,
  })
}
