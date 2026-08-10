import { useEffect, useMemo, useRef, useState } from 'react'
import { HUBS, type HubId } from '@/types'
import { computeRouteDanger, type RouteDangerResult } from '@/lib/routeDanger'
import { buildHaulerTypeIds, enrichRouteJumps, shouldCheckCamp } from '@/lib/routeCamp'
import type { SystemGateIntel } from '@/lib/gateIntel'
import { loadGateIntel } from '@/services/data/gateIntelLoader'
import { getHubMarket, resolveBuildSystem } from '@/services/data/sdeLoader'
import { getRoute, getSystemInfo, getSystemKills } from '@/services/market/marketService'
import { getRouteHaulerKillCounts } from '@/services/market/zkillService'
import { getRouteGateIntel } from '@/services/market/zkillGateIntel'
import type { SdeData } from '@/services/data/sdeLoader'

export interface HaulRouteLabels {
  haulInLabel: string
  haulOutLabel: string
}

interface UseHaulRouteRiskOptions {
  sde: SdeData | undefined
  primaryHub: HubId
  sellHub?: HubId
  manufacturingSystemId: number
  hubName: string
}

function haulRouteError(from: number, to: number, result: { route: number[]; source: string }): string | null {
  if (result.source === 'none') {
    return 'Route lookup failed (ESI rate limit or network). Try again later.'
  }
  if (from !== to && result.route.length === 0) {
    return 'No secure route between these systems.'
  }
  return null
}

function hubSystemName(sde: SdeData, hubId: HubId, fallbackName: string): string {
  const marketSystemId = getHubMarket(sde.market, hubId)?.marketSystemId
  if (!marketSystemId) return fallbackName
  return sde.systems.find((s) => s.systemId === marketSystemId)?.name ?? fallbackName
}

export function useHaulRouteRisk({
  sde,
  primaryHub,
  sellHub: sellHubProp,
  manufacturingSystemId,
  hubName,
}: UseHaulRouteRiskOptions) {
  const sellHub = sellHubProp ?? primaryHub
  const [haulIn, setHaulIn] = useState<RouteDangerResult | null>(null)
  const [haulOut, setHaulOut] = useState<RouteDangerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [gateIntelLoading, setGateIntelLoading] = useState(false)
  const fetchIdRef = useRef(0)
  const haulerTypeIds = useMemo(() => (sde ? buildHaulerTypeIds(sde.types) : null), [sde])

  const buildSystem = sde?.systems.find((s) => s.systemId === manufacturingSystemId)
  const buildSystemName = buildSystem?.name ?? `System ${manufacturingSystemId}`
  const buyHubName = sde ? hubSystemName(sde, primaryHub, hubName) : hubName
  const sellHubName = sde
    ? hubSystemName(sde, sellHub, HUBS.find((h) => h.id === sellHub)?.name ?? sellHub)
    : (HUBS.find((h) => h.id === sellHub)?.name ?? sellHub)
  const labels: HaulRouteLabels = {
    haulInLabel: `${buyHubName} → ${buildSystemName}`,
    haulOutLabel: `${buildSystemName} → ${sellHubName}`,
  }

  useEffect(() => {
    if (!sde) {
      setHaulIn(null)
      setHaulOut(null)
      setError(null)
      setLoading(false)
      setGateIntelLoading(false)
      return
    }

    const buyHubMarket = getHubMarket(sde.market, primaryHub)
    if (!buyHubMarket) {
      setHaulIn(null)
      setHaulOut(null)
      setError(null)
      setLoading(false)
      setGateIntelLoading(false)
      return
    }
    const sellHubMarket = getHubMarket(sde.market, sellHub) ?? buyHubMarket

    const fetchId = ++fetchIdRef.current
    const buyMarketSystemId = buyHubMarket.marketSystemId
    const sellMarketSystemId = sellHubMarket.marketSystemId
    const { buildSystemId } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      buyHubMarket,
      manufacturingSystemId,
    )

    setHaulIn(null)
    setHaulOut(null)
    setError(null)
    setLoading(true)
    setGateIntelLoading(false)

    ;(async () => {
      try {
        const { kills } = await getSystemKills()
        const securities = new Map<number, number>()
        const names = new Map<number, string>()

        for (const sys of sde.systems) {
          securities.set(sys.systemId, sys.security)
          names.set(sys.systemId, sys.name)
        }

        const [inRoute, outRoute] = await Promise.all([
          getRoute(buyMarketSystemId, buildSystemId),
          getRoute(buildSystemId, sellMarketSystemId),
        ])

        const routeError =
          haulRouteError(buyMarketSystemId, buildSystemId, inRoute) ??
          haulRouteError(buildSystemId, sellMarketSystemId, outRoute)
        if (routeError) {
          if (fetchId !== fetchIdRef.current) return
          setError(routeError)
          return
        }

        const routeSystemIds = [...new Set([...inRoute.route, ...outRoute.route])]
        const missingSystemIds = routeSystemIds.filter((id) => !names.has(id))
        if (missingSystemIds.length) {
          const infos = await Promise.all(missingSystemIds.map((id) => getSystemInfo(id)))
          if (fetchId !== fetchIdRef.current) return
          for (const info of infos) {
            names.set(info.systemId, info.name)
            securities.set(info.systemId, info.security)
          }
        }

        const killMap = new Map(
          Object.entries(kills).map(([id, k]) => [
            Number(id),
            { systemId: Number(id), shipKills: k.shipKills, podKills: k.podKills },
          ]),
        )

        const inResult = computeRouteDanger(inRoute.route, names, securities, killMap)
        const outResult = computeRouteDanger(outRoute.route, names, securities, killMap)

        if (fetchId !== fetchIdRef.current) return
        setHaulIn(inResult)
        setHaulOut(outResult)
        setLoading(false)
        setGateIntelLoading(true)

        const campSystemIds = [
          ...new Set([...inRoute.route, ...outRoute.route].filter((systemId) => {
            const security = securities.get(systemId) ?? 0
            return shouldCheckCamp(systemId, security)
          })),
        ]

        const haulerKillsBySystem =
          haulerTypeIds && campSystemIds.length
            ? await getRouteHaulerKillCounts(campSystemIds, haulerTypeIds)
            : new Map<number, number>()

        if (fetchId !== fetchIdRef.current) return

        const gateLookup = await loadGateIntel()
        const shipKillsBySystem = new Map<number, number>(
          routeSystemIds.map((id) => [id, killMap.get(id)?.shipKills ?? 0]),
        )
        const gateIntelBySystem = new Map<number, SystemGateIntel>()

        const applyEnrichment = () => {
          if (fetchId !== fetchIdRef.current) return
          setHaulIn(enrichRouteJumps(inResult, haulerKillsBySystem, gateIntelBySystem))
          setHaulOut(enrichRouteJumps(outResult, haulerKillsBySystem, gateIntelBySystem))
        }

        applyEnrichment()

        await getRouteGateIntel(routeSystemIds, gateLookup, {
          securities,
          shipKillsBySystem,
          onSystemIntel: (systemId, intel) => {
            gateIntelBySystem.set(systemId, intel)
            applyEnrichment()
          },
        })

        if (fetchId !== fetchIdRef.current) return
        applyEnrichment()
      } catch {
        if (fetchId !== fetchIdRef.current) return
        setHaulIn(null)
        setHaulOut(null)
        setError('Could not load route risk data.')
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false)
          setGateIntelLoading(false)
        }
      }
    })()
  }, [sde, primaryHub, sellHub, manufacturingSystemId, haulerTypeIds])

  return { haulIn, haulOut, error, loading, gateIntelLoading, labels }
}
