import { useEffect, useMemo, useRef, useState } from 'react'
import type { HubId, RegionsData } from '@/types'
import { computeRouteDanger, type RouteDangerResult } from '@/lib/routeDanger'
import { buildHaulerTypeIds, enrichRouteJumps, shouldCheckCamp } from '@/lib/routeCamp'
import { getHubMarket } from '@/services/data/sdeLoader'
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
  manufacturingRegionId: number
  hubName: string
  regions: RegionsData | undefined
}

export function useHaulRouteRisk({
  sde,
  primaryHub,
  manufacturingRegionId,
  hubName,
  regions,
}: UseHaulRouteRiskOptions) {
  const [haulIn, setHaulIn] = useState<RouteDangerResult | null>(null)
  const [haulOut, setHaulOut] = useState<RouteDangerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchIdRef = useRef(0)
  const haulerTypeIds = useMemo(() => (sde ? buildHaulerTypeIds(sde.types) : null), [sde])

  const region = regions?.regions.find((r) => r.regionId === manufacturingRegionId)
  const labels: HaulRouteLabels = region
    ? {
        haulInLabel: `${hubName} → ${region.buildSystemName}`,
        haulOutLabel: `${region.buildSystemName} → ${hubName}`,
      }
    : { haulInLabel: 'Market → build', haulOutLabel: 'Build → market' }

  useEffect(() => {
    if (!sde || !regions) {
      setHaulIn(null)
      setHaulOut(null)
      setLoading(false)
      return
    }

    const hubMarket = getHubMarket(sde.market, primaryHub)
    const activeRegion = regions.regions.find((r) => r.regionId === manufacturingRegionId)
    if (!hubMarket || !activeRegion) {
      setHaulIn(null)
      setHaulOut(null)
      setLoading(false)
      return
    }

    const fetchId = ++fetchIdRef.current
    const marketSystemId = hubMarket.marketSystemId
    const buildSystemId = activeRegion.buildSystemId

    setHaulIn(null)
    setHaulOut(null)
    setLoading(true)

    ;(async () => {
      try {
        const { kills } = await getSystemKills()
        const securities = new Map<number, number>()
        const names = new Map<number, string>()

        for (const sys of regions.regions) {
          securities.set(sys.buildSystemId, sys.buildSystemSecurity)
          names.set(sys.buildSystemId, sys.buildSystemName)
        }
        for (const sys of sde.systems) {
          securities.set(sys.systemId, sys.security)
          names.set(sys.systemId, sys.name)
        }

        const [inRoute, outRoute] = await Promise.all([
          getRoute(marketSystemId, buildSystemId),
          getRoute(buildSystemId, marketSystemId),
        ])

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
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false)
        }
      }
    })()
  }, [sde, regions, primaryHub, manufacturingRegionId, haulerTypeIds])

  return { haulIn, haulOut, loading, labels }
}
