import { describe, expect, it } from 'vitest'
import {
  inferOriginSystemId,
  makeProductionLocation,
  mergeProductionLocations,
  playerStructuresInRange,
} from '@/lib/productionLocations'

function structure(locationId: number, solarSystemId: number, name = `S${locationId}`) {
  return makeProductionLocation({
    locationId,
    kind: 'structure',
    name,
    solarSystemId,
    source: 'corp_structure',
  })
}

function station(locationId: number, solarSystemId: number) {
  return makeProductionLocation({
    locationId,
    kind: 'station',
    name: `Station ${locationId}`,
    solarSystemId,
    source: 'character_asset',
  })
}

describe('playerStructuresInRange', () => {
  it('drops NPC stations and keeps structures in range', () => {
    const npc = station(60003760, 30000142)
    const near = structure(1, 10)
    const far = structure(2, 99)
    const rows = playerStructuresInRange([npc, near, far], new Set([10, 11]))
    expect(rows.map((r) => r.locationId)).toEqual([1])
  })

  it('keeps every player structure when range is unknown', () => {
    const rows = playerStructuresInRange([station(1, 1), structure(2, 9)], null)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.locationId).toBe(2)
  })
})

describe('inferOriginSystemId', () => {
  it('picks the system with the most player structures', () => {
    expect(
      inferOriginSystemId([structure(1, 10), structure(2, 10), structure(3, 20), station(4, 30)]),
    ).toBe(10)
  })
})

describe('mergeProductionLocations', () => {
  it('dedupes by id', () => {
    const a = structure(1, 10, 'A')
    const copy = structure(1, 10, 'A')
    const b = structure(2, 11, 'B')
    expect(mergeProductionLocations([a], [copy, b])).toHaveLength(2)
  })
})
