import { describe, expect, it } from 'vitest'
import { aggregateAssetsAtLocation, toBuyQuantity } from '@/lib/locationInventory'
import type { EsiAsset } from '@/services/character/characterAssetsService'

function asset(partial: Partial<EsiAsset> & Pick<EsiAsset, 'type_id' | 'quantity'>): EsiAsset {
  return {
    item_id: partial.item_id ?? Math.floor(Math.random() * 1_000_000),
    is_singleton: partial.is_singleton ?? false,
    location_flag: partial.location_flag ?? 'Hangar',
    location_id: partial.location_id ?? 60003760,
    location_type: partial.location_type ?? 'station',
    quantity: partial.quantity,
    type_id: partial.type_id,
  }
}

describe('locationInventory', () => {
  it('aggregates quantities at a station', () => {
    const assets = [
      asset({ type_id: 34, quantity: 1000, location_id: 60003760 }),
      asset({ type_id: 34, quantity: 500, location_id: 60003760 }),
      asset({ type_id: 35, quantity: 200, location_id: 60003760 }),
      asset({ type_id: 34, quantity: 999, location_id: 60008494 }),
    ]

    const totals = aggregateAssetsAtLocation(assets, 60003760)
    expect(totals.get(34)).toBe(1500)
    expect(totals.get(35)).toBe(200)
    expect(totals.has(999)).toBe(false)
  })

  it('computes to-buy as need minus have floored at zero', () => {
    expect(toBuyQuantity(100, 40)).toBe(60)
    expect(toBuyQuantity(100, 120)).toBe(0)
    expect(toBuyQuantity(0, 10)).toBe(0)
  })
})
