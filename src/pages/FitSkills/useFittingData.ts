import { useQuery } from '@tanstack/react-query'
import { loadFittingData } from '@/services/data/fittingLoader'

export function useFittingData() {
  return useQuery({
    queryKey: ['fitting'],
    queryFn: loadFittingData,
    staleTime: Infinity,
  })
}
