import { useQuery } from '@tanstack/react-query'
import { relatedParamsFromTheater } from '@/lib/warActivity'
import { TTL } from '@/services/cache/cacheStore'
import { getZkillRelatedReport } from '@/services/market/zkillService'
import type { WarTheater } from '@/types/map'

export function useZkillRelated(theater: WarTheater | null) {
  const params = theater ? relatedParamsFromTheater(theater) : null

  return useQuery({
    queryKey: ['zkillRelated', params?.systemId, params?.relatedTime],
    queryFn: () => getZkillRelatedReport(params!.systemId, params!.relatedTime),
    enabled: params != null,
    staleTime: TTL.zkillCamp.fresh,
    retry: 1,
  })
}
