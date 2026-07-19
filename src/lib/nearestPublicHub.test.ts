import { describe, expect, it } from 'vitest'
import type { MapGraph } from '@/types/map'
import { HUBS } from '@/types'
import { jumpDistance, nearestPublicHub, nearestRestockPoint } from '@/lib/nearestPublicHub'

function makeGraph(
  systems: { id: number; hubId?: 'jita' | 'amarr' }[],
  edges: [number, number][],
): MapGraph {
  const hubSystemIds = new Set<number>()
  const hubBySystemId = new Map<number, 'jita' | 'amarr'>()
  const adjacency = new Map<number, number[]>()

  for (const s of systems) {
    adjacency.set(s.id, [])
    if (s.hubId) {
      hubSystemIds.add(s.id)
      hubBySystemId.set(s.id, s.hubId)
    }
  }
  for (const [a, b] of edges) {
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
  }

  const systemMap = new Map(
    systems.map((s) => [
      s.id,
      {
        systemId: s.id,
        name: `System ${s.id}`,
        regionId: 1,
        constellationId: 1,
        security: s.hubId ? 0.9 : -0.5,
        x: s.id,
        z: 0,
      },
    ]),
  )

  return { systems: systemMap, adjacency, hubSystemIds, hubBySystemId }
}

describe('nearestPublicHub', () => {
  it('returns the closest public hub by jumps', () => {
    const graph = makeGraph(
      [
        { id: 1 },
        { id: 2 },
        { id: 3, hubId: 'jita' },
        { id: 4, hubId: 'amarr' },
      ],
      [
        [1, 2],
        [2, 3],
        [2, 4],
      ],
    )
    const result = nearestPublicHub(graph, 1)
    expect(result?.hubId).toBe('jita')
    expect(result?.marketSystemId).toBe(HUBS.find((h) => h.id === 'jita')!.marketSystemId)
    expect(result?.jumps).toBe(2)
  })

  it('prefers larger hubs when jump distance is within two', () => {
    const graph = makeGraph(
      [
        { id: 1 },
        { id: 2, hubId: 'amarr' },
        { id: 3, hubId: 'jita' },
      ],
      [
        [1, 2],
        [1, 3],
      ],
    )
    const result = nearestPublicHub(graph, 1)
    expect(result?.hubId).toBe('jita')
    expect(result?.jumps).toBe(1)
  })
})

describe('nearestRestockPoint', () => {
  it('uses local factory jumps when the factory is in nullsec', () => {
    const graph = makeGraph(
      [
        { id: 1 },
        { id: 2 },
        { id: 3, hubId: 'jita' },
      ],
      [
        [1, 2],
        [2, 3],
      ],
    )
    graph.systems.get(1)!.security = -0.5
    graph.systems.get(2)!.security = -0.5

    const result = nearestRestockPoint(graph, 2, {
      factorySystemId: 1,
      sellHubMarketSystemId: 30000142,
      sellHubId: 'jita',
    })

    expect(result?.marketSystemId).toBe(1)
    expect(result?.jumps).toBe(1)
  })

  it('falls back to empire hub distance when the factory is in highsec', () => {
    const graph = makeGraph(
      [
        { id: 1 },
        { id: 2 },
        { id: 3, hubId: 'jita' },
      ],
      [
        [1, 2],
        [2, 3],
      ],
    )
    graph.systems.get(1)!.security = 0.9

    const result = nearestRestockPoint(graph, 1, {
      factorySystemId: 1,
      sellHubMarketSystemId: 30000142,
      sellHubId: 'jita',
    })

    expect(result?.hubId).toBe('jita')
    expect(result?.jumps).toBe(2)
  })
})

describe('jumpDistance', () => {
  it('returns null when systems are disconnected', () => {
    const graph = makeGraph([{ id: 1 }, { id: 2 }], [])
    expect(jumpDistance(graph, 1, 2)).toBeNull()
  })
})
