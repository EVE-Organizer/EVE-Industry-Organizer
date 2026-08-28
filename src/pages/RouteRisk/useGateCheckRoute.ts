import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { computeRouteDanger, type RouteDangerResult } from '@/lib/routeDanger'
import { enrichJumpsWithCamp } from '@/lib/routeCamp'
import type { SystemGateIntel } from '@/lib/gateIntel'
import { loadGateIntel } from '@/services/data/gateIntelLoader'
import {
  getRoute,
  getSystemInfo,
  getSystemKills,
  type RouteFlag,
} from '@/services/market/marketService'
import { getRouteGateIntel } from '@/services/market/zkillGateIntel'
import type { MapSystem } from '@/types/map'

export type GateCheckJump = RouteDangerResult['jumps'][number]

export interface GateCheckResult {
  route: RouteDangerResult
  fromName: string
  toName: string
}

interface GateCheckQueryData {
  result: GateCheckResult
  gateIntelLoading: boolean
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
  gateIntelBySystem: Map<number, SystemGateIntel>,
): RouteDangerResult {
  const jumps = route.jumps.map((jump) => {
    if (jump.systemId !== systemId) return jump
    const gateIntel = gateIntelBySystem.get(systemId)
    if (!gateIntel) return jump
    return enrichJumpsWithCamp([jump], new Map(), gateIntelBySystem)[0]!
  })
  return { ...route, jumps }
}

export function gateCheckRouteQueryKey(
  fromSystemId: number | null,
  toSystemId: number | null,
  flag: RouteFlag,
  avoidSystemIds: number[],
) {
  return ['gate-check-route', fromSystemId, toSystemId, flag, avoidSystemIds] as const
}

async function fetchGateCheckRoute(
  fromSystemId: number,
  toSystemId: number,
  flag: RouteFlag,
  avoidSystemIds: number[],
  systemsById: Map<number, MapSystem>,
  onPartial: (result: GateCheckResult) => void,
  signal: AbortSignal,
): Promise<GateCheckResult> {
  /* ----- Load route ----- */

  // ESI route + static gate lookup + 24h kills; abort if the user re-checks
  const [routeRes, gateLookup, { kills }] = await Promise.all([
    getRoute(fromSystemId, toSystemId, { flag, avoidSystemIds }),
    loadGateIntel(),
    getSystemKills(),
  ])
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  if (routeRes.source === 'none') {
    throw new Error('Route lookup failed (ESI rate limit or network). Try again later.')
  }
  if (routeRes.route.length === 0) {
    throw new Error('No route found between these systems with the selected preferences.')
  }

  /* ----- Resolve systems ----- */

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
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
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
  let current: GateCheckResult = { route: routeDanger, fromName, toName }
  onPartial(current)

  /* ----- Stream gate intel ----- */

  const gateIntelBySystem = new Map<number, SystemGateIntel>()

  await getRouteGateIntel(routeSystemIds, gateLookup, {
    securities,
    shipKillsBySystem,
    onSystemIntel: (systemId, intel) => {
      if (signal.aborted) return
      gateIntelBySystem.set(systemId, intel)
      current = {
        ...current,
        route: mergeGateIntelIntoRoute(current.route, systemId, gateIntelBySystem),
      }
      onPartial(current)
    },
  })

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const enriched = enrichJumpsWithCamp(routeDanger.jumps, new Map(), gateIntelBySystem)
  return { route: { ...routeDanger, jumps: enriched }, fromName, toName }
}

export function useGateCheckRoute({
  fromSystemId,
  toSystemId,
  flag,
  avoidSystemIds,
  systemsById,
}: UseGateCheckRouteOptions) {
  const queryClient = useQueryClient()
  const canCheck = fromSystemId != null && toSystemId != null && fromSystemId !== toSystemId
  const queryKey = gateCheckRouteQueryKey(fromSystemId, toSystemId, flag, avoidSystemIds)

  const {
    data,
    error: queryError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    enabled: false,
    queryFn: async ({ signal }): Promise<GateCheckQueryData> => {
      if (fromSystemId == null || toSystemId == null) {
        throw new Error('Pick origin and destination.')
      }
      const result = await fetchGateCheckRoute(
        fromSystemId,
        toSystemId,
        flag,
        avoidSystemIds,
        systemsById,
        (partial) => {
          queryClient.setQueryData<GateCheckQueryData>(queryKey, {
            result: partial,
            gateIntelLoading: true,
          })
        },
        signal,
      )
      return { result, gateIntelLoading: false }
    },
  })

  const checkRoute = useCallback(() => {
    if (!canCheck) return
    void refetch()
  }, [canCheck, refetch])

  const error = queryError instanceof Error ? queryError.message : null
  const gateIntelLoading = data?.gateIntelLoading === true
  const loading = isFetching && !gateIntelLoading

  return {
    result: data?.result ?? null,
    error,
    loading,
    gateIntelLoading,
    canCheck,
    checkRoute,
  }
}

export function findSystemByName(systems: MapSystem[], name: string): MapSystem | null {
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
