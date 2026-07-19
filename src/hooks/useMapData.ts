import { useQuery } from '@tanstack/react-query'
import { loadMapData } from '@/services/data/mapLoader'

export function useMapData() {
  return useQuery({
    queryKey: ['mapData'],
    queryFn: loadMapData,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
