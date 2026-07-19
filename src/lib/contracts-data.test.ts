import { describe, expect, it } from 'vitest'
import { buildRegionBpcIndex } from '../../scripts/lib/contracts-data.mjs'

describe('buildRegionBpcIndex', () => {
  const contractsCsv = [
    {
      contract_id: '100',
      region_id: '10000002',
      type: 'item_exchange',
      price: '1500000',
      buyout: '0',
      date_expired: '2026-08-01T00:00:00Z',
      station_id: '60003760',
    },
    {
      contract_id: '200',
      region_id: '10000043',
      type: 'item_exchange',
      price: '900000',
      buyout: '0',
      date_expired: '2026-08-02T00:00:00Z',
      station_id: '60008494',
    },
  ]

  const itemsCsv = [
    {
      contract_id: '100',
      type_id: '5001',
      is_blueprint_copy: 'true',
      material_efficiency: '10',
      time_efficiency: '20',
      runs: '10',
    },
    {
      contract_id: '100',
      type_id: '9999',
      is_blueprint_copy: 'false',
      material_efficiency: '0',
      time_efficiency: '0',
      runs: '-1',
    },
  ]

  it('indexes blueprint copies for the hub region only', () => {
    const blueprintTypeIds = new Set([5001])
    const index = buildRegionBpcIndex(contractsCsv, itemsCsv, blueprintTypeIds, 10000002)

    expect(index.byBlueprintTypeId['5001']?.count).toBe(1)
    expect(index.byBlueprintTypeId['5001']?.listings[0]).toMatchObject({
      contractId: 100,
      me: 10,
      te: 20,
      runs: 10,
    })
    expect(index.byBlueprintTypeId['9999']).toBeUndefined()
  })
})
