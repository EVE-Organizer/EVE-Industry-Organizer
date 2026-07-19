import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HubId } from '@/types'
import type { MapGraph, MapLayers, WarActivityResult, WarTheater, WarIntelAnchor, WarIntelProgress, WarIntelWindow } from '@/types/map'
import {
  warIntelMaxRefsForWindow,
  warIntelWindowLabel,
  warIntelWindowSeconds,
} from '@/types/map'
import type { SdeData } from '@/services/data/sdeLoader'
import { buildHaulerTypeIds, enrichRouteJumps, shouldCheckCamp } from '@/lib/routeCamp'
import { computeRouteDanger } from '@/lib/routeDanger'
import {
  pickWarCandidates,
  mergeKillRefs,
  mergeShorterWindowCachedRefs,
  trimWarKillRefs,
  warIntelGapSeconds,
  enrichTheaterFromKillCache,
  WAR_STORE_MAX_REFS_PER_SYSTEM,
} from '@/lib/warActivity'
import { buildWarActivityResults } from '@/lib/mapOpportunities'
import { systemsWithinJumps } from '@/lib/nearestPublicHub'
import { getHubMarket, resolveBuildSystem } from '@/services/data/sdeLoader'
import { getRoute, getSystemInfo, getSystemKills } from '@/services/market/marketService'
import {
  getRouteHaulerKillCounts,
  getWarKillRefsForSystemsWithPast,
  sanitizeKillRefs,
  type ZkillKillRef,
} from '@/services/market/zkillService'
import {
  buildWarOverlayCacheParams,
  getWarOverlayBase,
  getWarOverlayCached,
  initialWarOverlayState,
  setWarOverlayCached,
  shouldRefreshWarOverlay,
} from '@/services/market/warOverlayCache'

export interface MapOverlayState {
  warResults: WarActivityResult[]
  warTheaters: WarTheater[]
  haulInRoute: number[]
  haulOutRoute: number[]
  campSystemIds: Set<number>
  killsFetchedAt: number | null
  warLoading: boolean
  warIntelProgress: WarIntelProgress | null
  routeLoading: boolean
  error: string | null
}

const WAR_INTEL_FETCH_TIMEOUT_MS = 120_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

interface UseMapOverlaysOptions {
  sde: SdeData | undefined
  graph: MapGraph | undefined
  primaryHub: HubId
  sellHubId: HubId
  manufacturingSystemId: number
  centerSystemId: number
  layers: MapLayers
  refreshWarToken: number
  warIntelAnchor: WarIntelAnchor
  warIntelRadius: number
  warIntelWindow: WarIntelWindow
}

export function useMapOverlays({
  sde,
  graph,
  primaryHub,
  sellHubId,
  manufacturingSystemId,
  centerSystemId,
  layers,
  refreshWarToken,
  warIntelAnchor,
  warIntelRadius,
  warIntelWindow,
}: UseMapOverlaysOptions) {
  const overlayCacheParams = useMemo(
    () =>
      buildWarOverlayCacheParams({
        warIntelAnchor,
        manufacturingSystemId,
        centerSystemId,
        warIntelRadius,
        warIntelWindow,
        sellHubId,
      }),
    [
      warIntelAnchor,
      manufacturingSystemId,
      centerSystemId,
      warIntelRadius,
      warIntelWindow,
      sellHubId,
    ],
  )

  const [state, setState] = useState<MapOverlayState>(() => {
    const war = initialWarOverlayState(
      buildWarOverlayCacheParams({
        warIntelAnchor,
        manufacturingSystemId,
        centerSystemId,
        warIntelRadius,
        warIntelWindow,
        sellHubId,
      }),
    )
    return {
      ...war,
      haulInRoute: [],
      haulOutRoute: [],
      campSystemIds: new Set(),
      routeLoading: false,
      warIntelProgress: null,
      error: null,
    }
  })
  const warFetchIdRef = useRef(0)
  const routeFetchIdRef = useRef(0)
  const lastWarRefreshRef = useRef(-1)
  const haulerTypeIds = useMemo(
    () => (sde ? buildHaulerTypeIds(sde.types) : null),
    [sde],
  )

  const typeNames = useMemo(
    () => (sde ? new Map(sde.types.map((t) => [t.typeId, t.name])) : undefined),
    [sde],
  )

  const enrichTheaters = useCallback(
    (theaters: WarTheater[]) =>
      typeNames ? theaters.map((t) => enrichTheaterFromKillCache(t, typeNames)) : theaters,
    [typeNames],
  )

  useEffect(() => {
    if (!sde || !graph) return

    const fetchId = ++warFetchIdRef.current
    const forceRefresh = refreshWarToken !== lastWarRefreshRef.current
    const cachedOverlay = getWarOverlayCached(overlayCacheParams)
    const base = getWarOverlayBase(overlayCacheParams)
    const baseOverlay = base?.overlay
    const expandingRadius = Boolean(base && !base.exact)
    const incrementalRefresh = Boolean(baseOverlay && !forceRefresh)

    if (incrementalRefresh && baseOverlay) {
      const needsRefresh = expandingRadius || shouldRefreshWarOverlay(cachedOverlay)
      setState((prev) => ({
        ...prev,
        warResults: baseOverlay.data.warResults,
        warTheaters: enrichTheaters(baseOverlay.data.warTheaters),
        killsFetchedAt: baseOverlay.data.killsFetchedAt,
        warLoading: false,
        warIntelProgress: needsRefresh ? { phase: 'kills', current: 0, total: 1 } : null,
        error: null,
      }))
      if (!needsRefresh) {
        lastWarRefreshRef.current = refreshWarToken
        return
      }
    } else if (baseOverlay && forceRefresh) {
      setState((prev) => ({
        ...prev,
        warResults: baseOverlay.data.warResults,
        warTheaters: enrichTheaters(baseOverlay.data.warTheaters),
        killsFetchedAt: baseOverlay.data.killsFetchedAt,
        warLoading: false,
        warIntelProgress: { phase: 'kills', current: 0, total: 1 },
        error: null,
      }))
    } else {
      setState((prev) => ({
        ...prev,
        warLoading: true,
        warIntelProgress: { phase: 'kills', current: 0, total: 1 },
        error: null,
      }))
    }

    const warScanSystemId = overlayCacheParams.scanSystemId

    const reportProgress = (phase: WarIntelProgress['phase'], current: number, total: number) => {
      if (fetchId !== warFetchIdRef.current) return
      setState((prev) => ({
        ...prev,
        warIntelProgress: { phase, current, total },
      }))
    }

    ;(async () => {
      try {
        await withTimeout(
          (async () => {
            reportProgress('kills', 0, 1)
            const { kills, fetchedAt } = await getSystemKills(forceRefresh)
            reportProgress('kills', 1, 1)
            const within = systemsWithinJumps(graph, warScanSystemId, warIntelRadius)
            const candidates = pickWarCandidates(kills, within)
            const windowSeconds = warIntelWindowSeconds(warIntelWindow)
            const scoreMaxRefs = warIntelMaxRefsForWindow(warIntelWindow)
            const cachedRefs = incrementalRefresh ? baseOverlay?.data.refsBySystem : undefined
            const cachedFetchedAt = incrementalRefresh ? baseOverlay?.fetchedAt : undefined

            const refRequests: { systemId: number; pastSeconds: number }[] = []
            const mergedRefsBySystem = new Map<number, ZkillKillRef[]>()

            for (const systemId of candidates) {
              const cached = cachedRefs?.[systemId]
              if (expandingRadius && cached && !forceRefresh) {
                mergedRefsBySystem.set(systemId, sanitizeKillRefs(cached))
                continue
              }
              if (forceRefresh || !cached || cachedFetchedAt == null) {
                refRequests.push({ systemId, pastSeconds: windowSeconds })
              } else {
                refRequests.push({
                  systemId,
                  pastSeconds: warIntelGapSeconds(cachedFetchedAt, windowSeconds),
                })
              }
            }

            const freshRefsBySystem = await getWarKillRefsForSystemsWithPast(
              refRequests,
              (completed, total) => reportProgress('systems', completed, total),
            )
            for (const systemId of candidates) {
              if (mergedRefsBySystem.has(systemId)) continue
              const fresh = freshRefsBySystem.get(systemId) ?? []
              const cached = cachedRefs?.[systemId]
              const stored = mergeShorterWindowCachedRefs(
                systemId,
                windowSeconds,
                forceRefresh || !cached
                  ? fresh
                  : mergeKillRefs(
                      sanitizeKillRefs(cached),
                      fresh,
                      WAR_STORE_MAX_REFS_PER_SYSTEM,
                    ),
              )
              mergedRefsBySystem.set(systemId, stored)
            }

            // ponytail: overview only (zKill refs). ESI ship/corp enrich runs when a theater modal opens.
            const warInputs = candidates.map((systemId) => ({
              systemId,
              refs: trimWarKillRefs(
                mergedRefsBySystem.get(systemId) ?? [],
                scoreMaxRefs,
              ),
              shipKills24h: kills[systemId]?.shipKills ?? 0,
            }))
            reportProgress('build', 0, 1)
            const sellMarket = getHubMarket(sde.market, sellHubId)
            const { warResults, warTheaters: rawTheaters } = buildWarActivityResults(graph, warInputs, {
              killWindowLabel: warIntelWindowLabel(warIntelWindow),
              restockContext: {
                factorySystemId: manufacturingSystemId,
                sellHubMarketSystemId:
                  sellMarket?.marketSystemId ?? manufacturingSystemId,
                sellHubId,
              },
            })
            const warTheaters = enrichTheaters(rawTheaters)
            if (fetchId !== warFetchIdRef.current) return
            lastWarRefreshRef.current = refreshWarToken

            const refsBySystem: Record<number, ZkillKillRef[]> = {}
            for (const [systemId, refs] of mergedRefsBySystem) {
              refsBySystem[systemId] = refs
            }

            setWarOverlayCached(overlayCacheParams, {
              warResults,
              warTheaters,
              killsFetchedAt: fetchedAt,
              refsBySystem,
            })
            setState((prev) => ({
              ...prev,
              warResults,
              warTheaters,
              killsFetchedAt: fetchedAt,
              warLoading: false,
              warIntelProgress: null,
              error: null,
            }))
          })(),
          WAR_INTEL_FETCH_TIMEOUT_MS,
          'War intel timed out. Try Refresh.',
        )
      } catch (err) {
        if (fetchId !== warFetchIdRef.current) return
        const message =
          err instanceof Error && err.message ? err.message : 'War intel unavailable'
        setState((prev) => ({
          ...prev,
          warLoading: false,
          warIntelProgress: null,
          error: message,
        }))
      }
    })()
  }, [sde, graph, overlayCacheParams, refreshWarToken, warIntelRadius, warIntelWindow, sellHubId, manufacturingSystemId, enrichTheaters])

  useEffect(() => {
    if (!sde || !graph || (!layers.haulCorridor && !layers.gateCamp)) {
      setState((prev) => ({
        ...prev,
        haulInRoute: [],
        haulOutRoute: [],
        campSystemIds: new Set(),
        routeLoading: false,
      }))
      return
    }

    const hubMarket = getHubMarket(sde.market, primaryHub)
    const sellMarket = getHubMarket(sde.market, sellHubId)
    if (!hubMarket || !sellMarket) return

    const { buildSystemId } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      hubMarket,
      manufacturingSystemId,
    )
    const buySystemId = hubMarket.marketSystemId
    const sellSystemId = sellMarket.marketSystemId

    const fetchId = ++routeFetchIdRef.current
    setState((prev) => ({ ...prev, routeLoading: true }))

    ;(async () => {
      try {
        const [inRoute, outRoute] = await Promise.all([
          getRoute(buySystemId, buildSystemId),
          getRoute(buildSystemId, sellSystemId),
        ])
        if (fetchId !== routeFetchIdRef.current) return

        let campSystemIds = new Set<number>()
        if (layers.gateCamp && haulerTypeIds) {
          const { kills } = await getSystemKills()
          const securities = new Map<number, number>()
          for (const sys of graph.systems.values()) {
            securities.set(sys.systemId, sys.security)
          }
          const routeIds = [...new Set([...inRoute.route, ...outRoute.route])]
          for (const systemId of routeIds) {
            if (!securities.has(systemId)) {
              const info = await getSystemInfo(systemId)
              securities.set(systemId, info.security)
            }
          }
          const campCandidates = routeIds.filter((systemId) => {
            const security = securities.get(systemId) ?? 0
            return shouldCheckCamp(systemId, security)
          })
          const haulerKills = await getRouteHaulerKillCounts(campCandidates, haulerTypeIds)
          const killMap = new Map(
            Object.entries(kills).map(([id, k]) => [
              Number(id),
              { systemId: Number(id), shipKills: k.shipKills, podKills: k.podKills },
            ]),
          )
          const names = new Map<number, string>()
          for (const id of routeIds) {
            names.set(id, graph.systems.get(id)?.name ?? `System ${id}`)
          }
          const inDanger = computeRouteDanger(inRoute.route, names, securities, killMap)
          const outDanger = computeRouteDanger(outRoute.route, names, securities, killMap)
          const enrichedIn = enrichRouteJumps(inDanger, haulerKills)
          const enrichedOut = enrichRouteJumps(outDanger, haulerKills)
          campSystemIds = new Set(
            [...enrichedIn.jumps, ...enrichedOut.jumps]
              .filter((j) => j.campLevel !== 'None')
              .map((j) => j.systemId),
          )
        }

        if (fetchId !== routeFetchIdRef.current) return
        setState((prev) => ({
          ...prev,
          haulInRoute: inRoute.route,
          haulOutRoute: outRoute.route,
          campSystemIds,
          routeLoading: false,
        }))
      } catch {
        if (fetchId !== routeFetchIdRef.current) return
        setState((prev) => ({ ...prev, routeLoading: false }))
      }
    })()
  }, [
    sde,
    graph,
    primaryHub,
    sellHubId,
    manufacturingSystemId,
    layers.haulCorridor,
    layers.gateCamp,
    haulerTypeIds,
  ])

  return state
}
