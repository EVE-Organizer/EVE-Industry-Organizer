import { useEffect, useMemo, useRef, useState } from 'react'
import type { HubId } from '@/types'
import { computeRouteDanger, type RouteDangerResult } from '@/lib/routeDanger'
import { buildHaulerTypeIds, enrichRouteJumps, shouldCheckCamp } from '@/lib/routeCamp'
import { getHubMarket, resolveBuildSystem } from '@/services/data/sdeLoader'
import { getRoute, getSystemInfo, getSystemKills } from '@/services/market/marketService'
import { getRouteHaulerKillCounts } from '@/services/market/zkillService'
import type { SdeData } from '@/services/data/sdeLoader'

export interface HaulRouteLabels {
  haulInLabel: string
  haulOutLabel: string
}

interface UseHaulRouteRiskOptions {
  sde: SdeData | undefined
  primaryHub: HubId
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

export function useHaulRouteRisk({
  sde,
  primaryHub,
  manufacturingSystemId,
  hubName,
}: UseHaulRouteRiskOptions) {
  const [haulIn, setHaulIn] = useState<RouteDangerResult | null>(null)
  const [haulOut, setHaulOut] = useState<RouteDangerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchIdRef = useRef(0)
  const haulerTypeIds = useMemo(() => (sde ? buildHaulerTypeIds(sde.types) : null), [sde])

  const buildSystem = sde?.systems.find((s) => s.systemId === manufacturingSystemId)
  const buildSystemName = buildSystem?.name ?? `System ${manufacturingSystemId}`
  const marketSystemId = sde ? getHubMarket(sde.market, primaryHub)?.marketSystemId : undefined
  const marketSystem = marketSystemId
    ? sde?.systems.find((s) => s.systemId === marketSystemId)
    : undefined
  const marketName = marketSystem?.name ?? hubName
  const labels: HaulRouteLabels = {
    haulInLabel: `${marketName} → ${buildSystemName}`,
    haulOutLabel: `${buildSystemName} → ${marketName}`,
  }

  useEffect(() => {
    if (!sde) {
      setHaulIn(null)
      setHaulOut(null)
      setError(null)
      setLoading(false)
      return
    }

    const hubMarket = getHubMarket(sde.market, primaryHub)
    if (!hubMarket) {
      setHaulIn(null)
      setHaulOut(null)
      setError(null)
      setLoading(false)
      return
    }

    const fetchId = ++fetchIdRef.current
    const marketSystemId = hubMarket.marketSystemId
    const { buildSystemId } = resolveBuildSystem(
      sde.systems,
      sde.regions,
      hubMarket,
      manufacturingSystemId,
    )

    setHaulIn(null)
    setHaulOut(null)
    setError(null)
    setLoading(true)

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
          getRoute(marketSystemId, buildSystemId),
          getRoute(buildSystemId, marketSystemId),
        ])

        const routeError =
          haulRouteError(marketSystemId, buildSystemId, inRoute) ??
          haulRouteError(buildSystemId, marketSystemId, outRoute)
        if (routeError) {
          if (fetchId !== fetchIdRef.current) return
          setError(routeError)
          return
        }

        const routeSystemIds = [...new Set([...inRoute.route, ...outRoute.route])]
        for (const systemId of routeSystemIds) {
          if (names.has(systemId)) continue
          const info = await getSystemInfo(systemId)
          names.set(systemId, info.name)
          securities.set(systemId, info.security)
        }

        if (fetchId !== fetchIdRef.current) return

        const killMap = new Map(
          Object.entries(kills).map(([id, k]) => [
            Number(id),
            { systemId: Number(id), shipKills: k.shipKills, podKills: k.podKills },
          ]),
        )

        const inResult = computeRouteDanger(inRoute.route, names, securities, killMap)
        const outResult = computeRouteDanger(outRoute.route, names, securities, killMap)

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

        setHaulIn(enrichRouteJumps(inResult, haulerKillsBySystem))
        setHaulOut(enrichRouteJumps(outResult, haulerKillsBySystem))
      } catch {
        if (fetchId !== fetchIdRef.current) return
        setHaulIn(null)
        setHaulOut(null)
        setError('Could not load route risk data.')
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false)
        }
      }
    })()
  }, [sde, primaryHub, manufacturingSystemId, haulerTypeIds])

  return { haulIn, haulOut, error, loading, labels }
}
