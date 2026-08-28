import type { HubId } from '@/types'

export interface MapSystem {
  systemId: number
  name: string
  regionId: number
  constellationId: number
  security: number
  x: number
  z: number
}

export type MapJump = [number, number]

export interface MapData {
  generatedAt: string
  systems: MapSystem[]
  jumps: MapJump[]
}

export interface MapGraph {
  systems: Map<number, MapSystem>
  adjacency: Map<number, number[]>
  hubSystemIds: Set<number>
  hubBySystemId: Map<number, HubId>
}
