import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSdeData } from '@/hooks/useSdeData'
import {
  WAR_ENRICH_PER_THEATER,
  applyKillDetails,
  collectCachedKillDetailsForKills,
  enrichTheaterFromKillCache,
  theaterEnrichmentSignature,
  zkillRelatedUrl,
} from '@/lib/warActivity'
import { TTL } from '@/services/cache/cacheStore'
import { enrichWarKillDetails, getCachedKillmailDetails, type KillmailDetails } from '@/services/market/zkillService'
import type { WarIntelProgress, WarTheater } from '@/types/map'

function buildEnrichedTheater(
  theater: WarTheater,
  details: Map<number, KillmailDetails>,
  typeNames: Map<number, string>,
): WarTheater {
  const kills = applyKillDetails(theater.kills, details, typeNames)
  const withTime = kills.find((k) => k.killmailTime)
  return {
    ...theater,
    kills,
    zkillRelatedUrl: withTime?.killmailTime
      ? zkillRelatedUrl(theater.focalSystemId, withTime.killmailTime)
      : theater.zkillRelatedUrl,
  }
}

function killNeedsNetworkEnrich(kill: { killmailId: number; hash: string }): boolean {
  const cached = getCachedKillmailDetails(kill.killmailId, kill.hash)
  return !cached?.shipTypeId || !cached?.killmailTime
}

interface UseTheaterKillDetailsOptions {
  /** Wait until battle report loads before enriching remaining kills. */
  enableRest?: boolean
}

/** zKill/ESI ship/corp/time — uses cache first, then network. */
export function useTheaterKillDetails(
  theater: WarTheater | null,
  onEnriched?: (theater: WarTheater) => void,
  options?: UseTheaterKillDetailsOptions,
) {
  const { data: sde } = useSdeData()
  const [enrichProgress, setEnrichProgress] = useState<WarIntelProgress | null>(null)
  const lastSyncedSigRef = useRef<string | null>(null)
  const topKill = theater?.kills[0]
  const restKills = theater?.kills.slice(1, WAR_ENRICH_PER_THEATER) ?? []
  const enableRest = options?.enableRest ?? false

  const typeNames = useMemo(
    () => (sde ? new Map(sde.types.map((t) => [t.typeId, t.name])) : new Map<number, string>()),
    [sde],
  )

  const cachedTheater = useMemo(() => {
    if (!theater || !sde) return null
    return enrichTheaterFromKillCache(theater, typeNames)
  }, [theater, typeNames, sde])

  const cachedDetails = useMemo(() => {
    if (!theater) return new Map<number, KillmailDetails>()
    return collectCachedKillDetailsForKills(
      theater.kills.slice(0, WAR_ENRICH_PER_THEATER).map((k) => ({
        killmailId: k.killmailId,
        hash: k.hash,
      })),
    )
  }, [theater])

  const needsAnchorFetch = Boolean(topKill && killNeedsNetworkEnrich(topKill))
  const pendingRestKills = restKills.filter(killNeedsNetworkEnrich)

  const anchorQuery = useQuery({
    queryKey: ['theaterKillAnchor', theater?.id, topKill?.killmailId],
    queryFn: async () => {
      if (!topKill) return new Map<number, KillmailDetails>()
      setEnrichProgress({ phase: 'enrich', current: 0, total: 1 })
      try {
        return await enrichWarKillDetails(
          [{ killmailId: topKill.killmailId, hash: topKill.hash }],
          (current, total) => setEnrichProgress({ phase: 'enrich', current, total }),
        )
      } finally {
        setEnrichProgress(null)
      }
    },
    enabled: theater != null && sde != null && topKill != null && needsAnchorFetch,
    staleTime: TTL.zkillCamp.fresh,
    retry: 1,
  })

  const anchorReady = !needsAnchorFetch || anchorQuery.isSuccess

  const restQuery = useQuery({
    queryKey: ['theaterKillRest', theater?.id, pendingRestKills.map((k) => k.killmailId).join(',')],
    queryFn: () =>
      enrichWarKillDetails(
        pendingRestKills.map((k) => ({ killmailId: k.killmailId, hash: k.hash })),
      ),
    enabled:
      enableRest &&
      theater != null &&
      sde != null &&
      anchorReady &&
      pendingRestKills.length > 0,
    staleTime: TTL.zkillCamp.fresh,
    retry: 1,
  })

  const mergedDetails = useMemo(() => {
    const map = new Map(cachedDetails)
    if (anchorQuery.data) {
      for (const [id, detail] of anchorQuery.data) map.set(id, detail)
    }
    if (restQuery.data) {
      for (const [id, detail] of restQuery.data) map.set(id, detail)
    }
    return map
  }, [cachedDetails, anchorQuery.data, restQuery.data])

  const anchorTheater = useMemo(() => {
    if (!theater) return null
    if (cachedTheater?.kills[0]?.killmailTime) return cachedTheater
    if (!topKill) return null
    const detail = anchorQuery.data?.get(topKill.killmailId) ?? cachedDetails.get(topKill.killmailId)
    if (!detail) return null
    return buildEnrichedTheater(theater, new Map([[topKill.killmailId, detail]]), typeNames)
  }, [theater, topKill, cachedTheater, anchorQuery.data, cachedDetails, typeNames])

  const data = useMemo(() => {
    if (!theater || mergedDetails.size === 0) return null
    return buildEnrichedTheater(theater, mergedDetails, typeNames)
  }, [theater, mergedDetails, typeNames])

  useEffect(() => {
    if (!onEnriched) return
    const next = data ?? anchorTheater ?? cachedTheater
    if (!next || theaterEnrichmentSignature(next) === theaterEnrichmentSignature(theater!)) return
    const sig = theaterEnrichmentSignature(next)
    if (lastSyncedSigRef.current === sig) return
    lastSyncedSigRef.current = sig
    onEnriched(next)
  }, [data, anchorTheater, cachedTheater, onEnriched, theater])

  const isAnchorReady = Boolean(anchorTheater?.kills[0]?.killmailTime)

  return {
    data,
    anchorTheater,
    isLoading: needsAnchorFetch && anchorQuery.isLoading,
    isAnchorReady,
    isError: anchorQuery.isError || restQuery.isError,
    enrichProgress: anchorQuery.isFetching ? enrichProgress : null,
    isRestLoading: restQuery.isFetching,
  }
}
