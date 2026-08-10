import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeRouteDanger, type RouteDangerResult } from '@/lib/routeDanger'
import { enrichJumpsWithCamp } from '@/lib/routeCamp'
import { loadGateIntel } from '@/services/data/gateIntelLoader'
import { getRoute, getSystemInfo, getSystemKills, type RouteFlag } from '@/services/market/marketService'
import { getRouteGateIntel } from '@/services/market/zkillGateIntel'
import type { MapSystem } from '@/types/map'

export type GateCheckJump = RouteDangerResult['jumps'][number]

export interface GateCheckResult {
  route: RouteDangerResult
  fromName: string
  toName: string
}

interface UseGateCheckRouteOptions {
  fromSystemId: number | null
  toSystemId: number | null
  flag: RouteFlag
  avoidSystemIds: number[]
  systemsById: Map<number, MapSystem>
}

function mergeGateIntelIntoRoute(
  route: RouteDangerResult,
  systemId: number,
  gateIntelBySystem: Map<number, import('@/lib/gateIntel').SystemGateIntel>,
): RouteDangerResult {
  const jumps = route.jumps.map((jump) => {
    if (jump.systemId !== systemId) return jump
    const gateIntel = gateIntelBySystem.get(systemId)
    if (!gateIntel) return jump
    return enrichJumpsWithCamp([jump], new Map(), gateIntelBySystem)[0]!
  })
  return { ...route, jumps }
}

export function useGateCheckRoute({
  fromSystemId,
  toSystemId,
  flag,
  avoidSystemIds,
  systemsById,
}: UseGateCheckRouteOptions) {
  const [result, setResult] = useState<GateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [gateIntelLoading, setGateIntelLoading] = useState(false)
  const fetchIdRef = useRef(0)

  const canCheck = fromSystemId != null && toSystemId != null && fromSystemId !== toSystemId

  const checkRoute = useCallback(async () => {
    if (!canCheck || fromSystemId == null || toSystemId == null) return

    const fetchId = ++fetchIdRef.current
    setLoading(true)
    setGateIntelLoading(false)
    setError(null)
    setResult(null)

    try {
      const [routeRes, gateLookup, { kills }] = await Promise.all([
        getRoute(fromSystemId, toSystemId, { flag, avoidSystemIds }),
        loadGateIntel(),
        getSystemKills(),
      ])

      if (fetchId !== fetchIdRef.current) return

      if (routeRes.source === 'none') {
        setError('Route lookup failed (ESI rate limit or network). Try again later.')
        return
      }
      if (routeRes.route.length === 0) {
        setError('No route found between these systems with the selected preferences.')
        return
      }

      const routeSystemIds = routeRes.route
      const securities = new Map<number, number>()
      const names = new Map<number, string>()
      const missingSystemIds: number[] = []

      for (const systemId of routeSystemIds) {
        const known = systemsById.get(systemId)
        if (known) {
          names.set(systemId, known.name)
          securities.set(systemId, known.security)
        } else {
          missingSystemIds.push(systemId)
        }
      }

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
      const shipKillsBySystem = new Map<number, number>(
        routeSystemIds.map((id) => [id, killMap.get(id)?.shipKills ?? 0]),
      )

      const routeDanger = computeRouteDanger(routeRes.route, names, securities, killMap)
      const fromName = names.get(fromSystemId) ?? `System ${fromSystemId}`
      const toName = names.get(toSystemId) ?? `System ${toSystemId}`

      setResult({ route: routeDanger, fromName, toName })
      setLoading(false)
      setGateIntelLoading(true)

      const gateIntelBySystem = new Map<number, import('@/lib/gateIntel').SystemGateIntel>()

      await getRouteGateIntel(routeSystemIds, gateLookup, {
        securities,
        shipKillsBySystem,
        onSystemIntel: (systemId, intel) => {
          if (fetchId !== fetchIdRef.current) return
          gateIntelBySystem.set(systemId, intel)
          setResult((prev) => {
            if (!prev) return prev
            const enriched = mergeGateIntelIntoRoute(prev.route, systemId, gateIntelBySystem)
            return { ...prev, route: enriched }
          })
        },
      })

      if (fetchId !== fetchIdRef.current) return

      const enriched = enrichJumpsWithCamp(routeDanger.jumps, new Map(), gateIntelBySystem)
      setResult({
        route: { ...routeDanger, jumps: enriched },
        fromName,
        toName,
      })
    } catch {
      if (fetchId !== fetchIdRef.current) return
      setError('Could not load route or gate intel.')
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false)
        setGateIntelLoading(false)
      }
    }
  }, [avoidSystemIds, canCheck, flag, fromSystemId, systemsById, toSystemId])

  useEffect(() => {
    setResult(null)
    setError(null)
    setGateIntelLoading(false)
  }, [fromSystemId, toSystemId, flag, avoidSystemIds])

  return { result, error, loading, gateIntelLoading, canCheck, checkRoute }
}

export function findSystemByName(
  systems: MapSystem[],
  name: string,
): MapSystem | null {
  const query = name.trim().toLowerCase()
  if (!query) return null
  const exact = systems.find((s) => s.name.toLowerCase() === query)
  if (exact) return exact
  const partial = systems.filter((s) => s.name.toLowerCase().includes(query))
  if (partial.length === 1) return partial[0]!
  return null
}

export function parseRouteFlag(value: string | null): RouteFlag {
  if (value === 'shortest' || value === 'insecure') return value
  return 'secure'
}

export function routeFlagLabel(flag: RouteFlag): string {
  switch (flag) {
    case 'shortest':
      return 'Shortest'
    case 'insecure':
      return 'Less secure'
    default:
      return 'Secure'
  }
}

export function useMapSystemsIndex(systems: MapSystem[] | undefined) {
  return useMemo(() => {
    const byId = new Map<number, MapSystem>()
    const byName = new Map<string, MapSystem>()
    if (!systems) return { byId, byName }
    for (const system of systems) {
      byId.set(system.systemId, system)
      byName.set(system.name.toLowerCase(), system)
    }
    return { byId, byName }
  }, [systems])
}
