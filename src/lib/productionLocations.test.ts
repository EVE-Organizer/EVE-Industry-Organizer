import { describe, expect, it } from 'vitest'
import {
  findProductionLocation,
  inferOriginSystemId,
  makeProductionLocation,
  mergeProductionLocations,
  playerManufacturingStructures,
  playerStructuresInRange,
} from '@/lib/productionLocations'

function structure(
  locationId: number,
  solarSystemId: number,
  name = `S${locationId}`,
  source: 'corp_structure' | 'blueprint' | 'industry_job' | 'character_asset' = 'corp_structure',
) {
  return makeProductionLocation({
    locationId,
    kind: 'structure',
    name,
    solarSystemId,
    source,
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

  it('keeps far structures that already hold character items', () => {
    const hangar = makeProductionLocation({
      locationId: 9,
      kind: 'structure',
      name: 'Far hangar',
      solarSystemId: 99,
      source: 'character_asset',
    })
    const farCorp = structure(2, 99)
    const rows = playerStructuresInRange([hangar, farCorp], new Set([10]))
    expect(rows.map((r) => r.locationId)).toEqual([9])
  })

  it('keeps every player structure when range is unknown', () => {
    const rows = playerStructuresInRange([station(1, 1), structure(2, 9)], null)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.locationId).toBe(2)
  })
})

describe('playerManufacturingStructures', () => {
  it('keeps blueprint and industry job structures only', () => {
    const rows = playerManufacturingStructures([
      station(60003760, 30000142),
      structure(1, 10, 'Near yard', 'blueprint'),
      structure(2, 99, 'Far yard', 'blueprint'),
      structure(3, 10, 'Asset hangar', 'character_asset'),
      structure(4, 10, 'Active job', 'industry_job'),
      structure(5, 10, 'Empty corp', 'corp_structure'),
    ])
    expect(rows.map((r) => r.locationId).sort()).toEqual([1, 2, 4])
  })

  it('keeps far blueprint hangars without a jump filter', () => {
    const far = structure(9, 99, 'T-ZWA1 - NVU Public Shipyard', 'blueprint')
    expect(playerManufacturingStructures([far])).toEqual([far])
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

  it('prefers a real name over a placeholder', () => {
    const placeholder = structure(1_000_000_000_001, 10, 'Structure 1000000000001', 'blueprint')
    const named = makeProductionLocation({
      locationId: 1_000_000_000_001,
      kind: 'structure',
      name: 'T-ZWA1 - NVU Public Shipyard',
      solarSystemId: 10,
      structureTypeId: 35827,
      source: 'public_structure',
    })
    const merged = mergeProductionLocations([placeholder], [named])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.name).toBe('T-ZWA1 - NVU Public Shipyard')
  })

  it('upgrades source to blueprint when merging asset and blueprint rows', () => {
    const assetRow = structure(1, 10, 'Asset hangar', 'character_asset')
    const blueprintRow = structure(1, 10, 'Asset hangar', 'blueprint')
    const merged = mergeProductionLocations([assetRow], [blueprintRow])
    expect(merged[0]?.source).toBe('blueprint')
  })
})

describe('findProductionLocation', () => {
  const citadel = makeProductionLocation({
    locationId: 1_000_000_000_001,
    kind: 'structure',
    name: 'T-ZWA1 - NVU Public Shipyard',
    solarSystemId: 10,
    structureTypeId: 35827,
    source: 'blueprint',
  })

  it('matches by preferred kind', () => {
    expect(findProductionLocation([citadel], citadel.locationId, 'structure')).toBe(citadel)
  })

  it('matches when saved kind is wrong', () => {
    expect(findProductionLocation([citadel], citadel.locationId, 'station')).toBe(citadel)
  })

  it('matches by location id when kind is omitted', () => {
    expect(findProductionLocation([citadel], citadel.locationId, null)).toBe(citadel)
  })
})
