import type { HubId } from '@/types'
import { HUBS } from '@/types'
import type { MapGraph } from '@/types/map'

const HUB_PRIORITY: HubId[] = ['jita', 'amarr', 'dodixie', 'rens', 'hek', 'ympwl']

export interface NearestHubResult {
  hubId: HubId
  marketSystemId: number
  jumps: number
}

export interface RestockContext {
  factorySystemId: number
  sellHubMarketSystemId: number
  sellHubId: HubId
}

export function isNullsecSystem(graph: MapGraph, systemId: number): boolean {
  const security = graph.systems.get(systemId)?.security
  return security !== undefined && security <= 0
}

/**
 * BFS from war system to the nearest public trade hub market system.
 */
export function nearestPublicHub(
  graph: MapGraph,
  fromSystemId: number,
): NearestHubResult | null {
  if (graph.hubSystemIds.has(fromSystemId)) {
    const hubId = graph.hubBySystemId.get(fromSystemId)
    if (hubId) return { hubId, marketSystemId: fromSystemId, jumps: 0 }
  }

  const visited = new Map<number, number>()
  const queue: number[] = [fromSystemId]
  visited.set(fromSystemId, 0)

  const hubsByDistance = new Map<number, HubId[]>()

  while (queue.length > 0) {
    const current = queue.shift()!
    const dist = visited.get(current) ?? 0

    if (graph.hubSystemIds.has(current)) {
      const hubId = graph.hubBySystemId.get(current)
      if (hubId) {
        const list = hubsByDistance.get(dist) ?? []
        list.push(hubId)
        hubsByDistance.set(dist, list)
      }
    }

    if (hubsByDistance.size > 0 && dist > Math.min(...hubsByDistance.keys())) {
      break
    }

    for (const next of graph.adjacency.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.set(next, dist + 1)
      queue.push(next)
    }
  }

  if (hubsByDistance.size === 0) return null

  const minDist = Math.min(...hubsByDistance.keys())
  const candidates = hubsByDistance.get(minDist) ?? []
  const hubId = pickHub(candidates, minDist, hubsByDistance)
  const hub = HUBS.find((h) => h.id === hubId)
  if (!hub) return null
  return { hubId, marketSystemId: hub.marketSystemId, jumps: minDist }
}

/**
 * Restock distance for war theaters. Null factories sell locally, so use jumps
 * to the factory or a null sell market, not a path out to empire trade hubs.
 */
export function nearestRestockPoint(
  graph: MapGraph,
  warSystemId: number,
  context: RestockContext,
): NearestHubResult | null {
  const { factorySystemId, sellHubMarketSystemId, sellHubId } = context
  if (!isNullsecSystem(graph, factorySystemId)) {
    return nearestPublicHub(graph, warSystemId)
  }

  const targets: { systemId: number; hubId: HubId }[] = [
    { systemId: factorySystemId, hubId: sellHubId },
  ]
  if (
    sellHubMarketSystemId !== factorySystemId &&
    isNullsecSystem(graph, sellHubMarketSystemId)
  ) {
    targets.push({ systemId: sellHubMarketSystemId, hubId: sellHubId })
  }

  let best: NearestHubResult | null = null
  for (const target of targets) {
    const jumps = jumpDistance(graph, warSystemId, target.systemId)
    if (jumps === null) continue
    if (!best || jumps < best.jumps) {
      best = { hubId: target.hubId, marketSystemId: target.systemId, jumps }
    }
  }
  return best
}

function pickHub(
  candidates: HubId[],
  minDist: number,
  hubsByDistance: Map<number, HubId[]>,
): HubId {
  if (candidates.length === 1) return candidates[0]!
  for (const preferred of HUB_PRIORITY) {
    if (candidates.includes(preferred)) return preferred
  }
  const nextDist = minDist + 1
  const nextCandidates = hubsByDistance.get(nextDist)
  if (nextCandidates) {
    for (const preferred of HUB_PRIORITY) {
      if (nextCandidates.includes(preferred)) return preferred
    }
  }
  return candidates[0]!
}

/**
 * BFS jump distance between two systems (undirected).
 */
export function jumpDistance(
  graph: MapGraph,
  fromSystemId: number,
  toSystemId: number,
): number | null {
  if (fromSystemId === toSystemId) return 0
  const visited = new Set<number>()
  const queue: { id: number; dist: number }[] = [{ id: fromSystemId, dist: 0 }]
  visited.add(fromSystemId)

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!
    for (const next of graph.adjacency.get(id) ?? []) {
      if (next === toSystemId) return dist + 1
      if (visited.has(next)) continue
      visited.add(next)
      queue.push({ id: next, dist: dist + 1 })
    }
  }
  return null
}

/**
 * Systems within N jumps of center (for war candidate filtering).
 */
export function systemsWithinJumps(
  graph: MapGraph,
  centerSystemId: number,
  maxJumps: number,
): Set<number> {
  const result = new Set<number>()
  const visited = new Map<number, number>()
  const queue: number[] = [centerSystemId]
  visited.set(centerSystemId, 0)
  result.add(centerSystemId)

  while (queue.length > 0) {
    const current = queue.shift()!
    const dist = visited.get(current) ?? 0
    if (dist >= maxJumps) continue
    for (const next of graph.adjacency.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.set(next, dist + 1)
      result.add(next)
      queue.push(next)
    }
  }
  return result
}
