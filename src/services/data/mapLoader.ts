import type { HubId } from '@/types'
import { HUBS } from '@/types'
import type { MapData, MapGraph } from '@/types/map'
import { publicDataUrl } from '@/lib/paths'

let cache: MapData | null = null

export async function loadMapData(): Promise<MapData> {
  if (cache) return cache
  const res = await fetch(publicDataUrl('map.json'))
  if (!res.ok) throw new Error(`Failed to load map.json: ${res.status}`)
  cache = (await res.json()) as MapData
  return cache
}

export function buildMapGraph(mapData: MapData): MapGraph {
  const systems = new Map(mapData.systems.map((s) => [s.systemId, s]))
  const adjacency = new Map<number, number[]>()

  for (const [a, b] of mapData.jumps) {
    const listA = adjacency.get(a) ?? []
    listA.push(b)
    adjacency.set(a, listA)
    const listB = adjacency.get(b) ?? []
    listB.push(a)
    adjacency.set(b, listB)
  }

  const hubSystemIds = new Set<number>()
  const hubBySystemId = new Map<number, HubId>()
  for (const hub of HUBS) {
    hubSystemIds.add(hub.marketSystemId)
    hubBySystemId.set(hub.marketSystemId, hub.id)
  }

  return { systems, adjacency, hubSystemIds, hubBySystemId }
}

export function getSystemById(graph: MapGraph, systemId: number) {
  return graph.systems.get(systemId)
}

export function getSystemName(graph: MapGraph, systemId: number): string {
  return graph.systems.get(systemId)?.name ?? `System ${systemId}`
}
