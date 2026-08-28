import { describe, expect, it } from 'vitest'
import { industryStructuresInRange } from '@/lib/industryStructures'

const raitaru = {
  id: 1,
  name: 'Near Raitaru',
  solarSystemId: 10,
  typeId: 35825,
}
const tatara = {
  id: 2,
  name: 'Near Tatara',
  solarSystemId: 10,
  typeId: 35836,
}
const farAzbel = {
  id: 3,
  name: 'Far Azbel',
  solarSystemId: 99,
  typeId: 35826,
}

describe('industryStructuresInRange', () => {
  const nearby = new Set([10])

  it('keeps engineering complexes in range for manufacturing', () => {
    const rows = industryStructuresInRange([raitaru, tatara, farAzbel], nearby, 'manufacturing')
    expect(rows.map((r) => r.locationId)).toEqual([1])
  })

  it('keeps refineries in range for reactions', () => {
    const rows = industryStructuresInRange([raitaru, tatara, farAzbel], nearby, 'refinery')
    expect(rows.map((r) => r.locationId)).toEqual([2])
  })

  it('keeps every matching structure when range is not applied', () => {
    const rows = industryStructuresInRange([raitaru, tatara, farAzbel], null, 'manufacturing')
    expect(rows.map((r) => r.locationId).sort()).toEqual([1, 3])
  })
})
