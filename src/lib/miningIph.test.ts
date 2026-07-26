import { describe, expect, it } from 'vitest'
import {
  miningDisplayVolume,
  rankMiningIph,
  sortMiningRows,
} from '@/lib/miningIph'
import type { HubMarketData, MiningData, TypeInfo } from '@/types'

const mining: MiningData = {
  generatedAt: '',
  defaults: { m3PerHr: 1000, reprocessYield: 0.5 },
  focusOutputs: {
    ore: [
      { typeId: 34, name: 'Tritanium' },
      { typeId: 36, name: 'Mexallon' },
    ],
    moon: [],
    ice: [],
    gas: [],
  },
  items: [
    {
      typeId: 18,
      name: 'Plagioclase',
      group: 'Plagioclase',
      volume: 0.35,
      portionSize: 100,
      subtype: 'ore',
      foundIn: ['highsec', 'lowsec'],
      compressedTypeId: 62528,
      reprocess: [
        { typeId: 34, quantityPerBatch: 175 },
        { typeId: 36, quantityPerBatch: 70 },
      ],
      iconUrl: '',
    },
    {
      typeId: 1230,
      name: 'Veldspar',
      group: 'Veldspar',
      volume: 0.1,
      portionSize: 100,
      subtype: 'ore',
      foundIn: ['highsec'],
      compressedTypeId: 62516,
      reprocess: [{ typeId: 34, quantityPerBatch: 400 }],
      iconUrl: '',
    },
  ],
}

const hubMarket: HubMarketData = {
  regionId: 10000002,
  marketSystemId: 30000142,
  buildSystemId: 30000142,
  costIndex: 0.01,
  prices: {
    '18': 10,
    '1230': 5,
    '34': 4,
    '36': 50,
    '62528': 12,
    '62516': 6,
  },
  products: {
    '18': { all: { avgPrice: 10, avgVolume: 5000, high: 10, low: 10 } },
    '1230': { all: { avgPrice: 5, avgVolume: 8000, high: 5, low: 5 } },
  },
}

const typeMap = new Map<number, TypeInfo>([
  [34, { typeId: 34, name: 'Tritanium', group: '', category: '', volume: 0.01, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
  [36, { typeId: 36, name: 'Mexallon', group: '', category: '', volume: 0.01, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
])

describe('rankMiningIph', () => {
  it('ranks by minerals ISK/hr by default path', () => {
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), v]))
    const rows = rankMiningIph(mining, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'sell_orders',
      sortKey: 'minerals',
    })
    expect(rows.length).toBe(2)
    expect(rows[0].mineralsIph).toBeGreaterThan(0)
  })

  it('hides ores with zero focused material', () => {
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), v]))
    const rows = rankMiningIph(mining, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: ['highsec'],
      focusTypeId: 36,
      window: 'all',
      priceMethod: 'sell_orders',
      sortKey: 'focus',
    })
    expect(rows.every((r) => r.item.name === 'Plagioclase')).toBe(true)
    expect(rows[0].focusQtyPerHr).toBeGreaterThan(0)
  })

  it('requires every selected Found in space (AND)', () => {
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), v]))
    const rows = rankMiningIph(mining, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: ['highsec', 'lowsec'],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'sell_orders',
    })
    // Plagioclase is HS+LS; Veldspar is HS only.
    expect(rows.every((r) => r.item.name === 'Plagioclase')).toBe(true)
    expect(rows).toHaveLength(1)
  })

  it('ranks focused material by units/hr not ISK/hr', () => {
    // Cheap high-yield Trit vs expensive low-yield Trit: qty sort picks Veldspar.
    const focusMining: MiningData = {
      ...mining,
      items: [
        {
          typeId: 18,
          name: 'Plagioclase',
          group: 'Plagioclase',
          volume: 0.35,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['highsec'],
          compressedTypeId: 62528,
          reprocess: [{ typeId: 34, quantityPerBatch: 50 }],
          iconUrl: '',
        },
        {
          typeId: 1230,
          name: 'Veldspar',
          group: 'Veldspar',
          volume: 0.1,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['highsec'],
          compressedTypeId: 62516,
          reprocess: [{ typeId: 34, quantityPerBatch: 400 }],
          iconUrl: '',
        },
      ],
    }
    const spot = new Map([
      [18, 10],
      [1230, 5],
      [34, 4],
      [62528, 12],
      [62516, 6],
    ])
    const rows = rankMiningIph(focusMining, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: 34,
      window: 'all',
      priceMethod: 'sell_orders',
      sortKey: 'focus',
    })
    expect(rows[0].item.name).toBe('Veldspar')
    expect(rows[0].focusQtyPerHr!).toBeGreaterThan(rows[1].focusQtyPerHr!)
  })

  it('never lists compressed names as rows', () => {
    const withCompressed: MiningData = {
      ...mining,
      items: [
        ...mining.items,
        {
          typeId: 999,
          name: 'Batch Compressed Mercoxit',
          group: 'Mercoxit',
          volume: 0.01,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['nullsec'],
          compressedTypeId: null,
          reprocess: [{ typeId: 34, quantityPerBatch: 100 }],
          iconUrl: '',
        },
      ],
    }
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), Number(v)]))
    spot.set(999, 100)
    const rows = rankMiningIph(withCompressed, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'sell_orders',
      sortKey: 'minerals',
    })
    expect(rows.every((r) => !/compress/i.test(r.item.name))).toBe(true)
  })

  it('hides items with no hub volume', () => {
    const hubWithVol: HubMarketData = {
      ...hubMarket,
      products: {
        '18': { all: { avgPrice: 10, avgVolume: 1000, high: 10, low: 10 } },
        // 1230 Veldspar: no product history
      },
    }
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), Number(v)]))
    const rows = rankMiningIph(mining, hubWithVol, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'sell_orders',
      sortKey: 'minerals',
    })
    expect(rows.every((r) => r.item.typeId === 18)).toBe(true)
    expect(rows[0]?.volDayRaw).toBeGreaterThan(0)
  })

  it('hides ores with only mineral volume (no raw hub trades)', () => {
    const ghostOre: MiningData = {
      ...mining,
      items: [
        ...mining.items,
        {
          typeId: 9991,
          name: 'Glowing Veldspar',
          group: 'Veldspar',
          volume: 0.1,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['highsec'],
          compressedTypeId: null,
          reprocess: [{ typeId: 34, quantityPerBatch: 400 }],
          iconUrl: '',
        },
      ],
    }
    const hubWithMineralVol: HubMarketData = {
      ...hubMarket,
      products: {
        '18': { all: { avgPrice: 10, avgVolume: 1000, high: 10, low: 10 } },
        '1230': { all: { avgPrice: 5, avgVolume: 8000, high: 5, low: 10 } },
        '34': { all: { avgPrice: 4, avgVolume: 500_000, high: 4, low: 4 } },
        // 9991 ghost ore: price but no raw volume
      },
    }
    const spot = new Map(Object.entries(hubWithMineralVol.prices).map(([k, v]) => [Number(k), Number(v)]))
    spot.set(9991, 8)
    const rows = rankMiningIph(ghostOre, hubWithMineralVol, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'sell_orders',
    })
    expect(rows.every((r) => r.item.typeId !== 9991)).toBe(true)
    expect(rows.every((r) => r.rawIph > 0 && (r.volDayRaw ?? 0) > 0)).toBe(true)
  })

  it('shows compressed hub volume for ore when raw volume is tiny (Mercoxit-style)', () => {
    const mercoxitMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 40_000, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 11396,
          name: 'Mercoxit',
          group: 'Mercoxit',
          volume: 40,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['nullsec'],
          compressedTypeId: 62586,
          reprocess: [{ typeId: 11399, quantityPerBatch: 140 }],
          iconUrl: '',
        },
      ],
    }
    const hub: HubMarketData = {
      regionId: 10000043,
      marketSystemId: 30002187,
      buildSystemId: 30002187,
      costIndex: 0.01,
      prices: {
        '11396': 24480,
        '62586': 20000,
        '11399': 20000,
      },
      products: {
        '11396': { '1y': { avgPrice: 16500, avgVolume: 279, high: 125000, low: 42 } },
        '62586': { '1y': { avgPrice: 20000, avgVolume: 3057, high: 25000, low: 10000 } },
      },
    }
    const spot = new Map([
      [11396, 24480],
      [62586, 20000],
      [11399, 20000],
    ])
    const rows = rankMiningIph(mercoxitMining, hub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1y',
      priceMethod: 'sell_orders',
      sortKey: 'raw',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].volDayRaw).toBe(279)
    expect(rows[0].volDayCompressed).toBe(3057)
    expect(rows[0].volDay).toBe(3057)
    expect(miningDisplayVolume(rows[0], 'raw')).toBe(3057)
  })

  it('sortMiningRows does not rewrite volDay', () => {
    const mercoxitMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 40_000, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 11396,
          name: 'Mercoxit',
          group: 'Mercoxit',
          volume: 40,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['nullsec'],
          compressedTypeId: 62586,
          reprocess: [{ typeId: 11399, quantityPerBatch: 140 }],
          iconUrl: '',
        },
      ],
    }
    const hub: HubMarketData = {
      regionId: 10000043,
      marketSystemId: 30002187,
      buildSystemId: 30002187,
      costIndex: 0.01,
      prices: { '11396': 24480, '62586': 20000, '11399': 20000 },
      products: {
        '11396': { '1y': { avgPrice: 16500, avgVolume: 279, high: 125000, low: 42 } },
        '62586': { '1y': { avgPrice: 20000, avgVolume: 3057, high: 25000, low: 10000 } },
      },
    }
    const spot = new Map([
      [11396, 24480],
      [62586, 20000],
      [11399, 20000],
    ])
    const rows = rankMiningIph(mercoxitMining, hub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1y',
      priceMethod: 'sell_orders',
    })
    const sorted = sortMiningRows(rows, 'minerals')
    expect(sorted[0].volDay).toBe(3057)
    expect(miningDisplayVolume(sorted[0], 'minerals')).toBe(0)
  })

  it('buy mode drops rows without buy quotes', () => {
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), v]))
    const buyPrices = new Map<number, number>([[18, 8]])
    const rows = rankMiningIph(mining, hubMarket, spot, buyPrices, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'buy_orders',
    })
    expect(rows.every((r) => r.item.typeId === 18)).toBe(true)
  })

  it('hides gas with spot price but no volume history (non-Jita hubs)', () => {
    const gasMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 40_000, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 25268,
          name: 'Amber Cytoserocin',
          group: 'Booster Cloud',
          volume: 10,
          portionSize: 1,
          subtype: 'gas',
          foundIn: ['lowsec', 'nullsec', 'wormhole'],
          compressedTypeId: null,
          reprocess: [],
          iconUrl: '',
        },
        {
          typeId: 49787,
          name: 'Hiemal Tricarboxyl Vapor',
          group: 'Harvestable Cloud',
          volume: 10,
          portionSize: 15,
          subtype: 'gas',
          foundIn: ['lowsec', 'nullsec', 'wormhole'],
          compressedTypeId: null,
          reprocess: [{ typeId: 48927, quantityPerBatch: 1 }],
          iconUrl: '',
        },
      ],
    }
    const hubNoGasHistory: HubMarketData = {
      regionId: 10000002,
      marketSystemId: 30000142,
      buildSystemId: 30000142,
      costIndex: 0.01,
      prices: {
        '25268': 44300,
        '49787': 0,
        '48927': 23500,
      },
      products: {
        // Reprocess output has history; raw gas types do not (typical outside Jita).
        '48927': { '1m': { avgPrice: 15410, avgVolume: 345, high: 39500, low: 13140 } },
      },
    }
    const spot = new Map([
      [25268, 44300],
      [48927, 23500],
    ])
    const rows = rankMiningIph(gasMining, hubNoGasHistory, spot, null, typeMap, {
      subtype: 'gas',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].item.name).toBe('Hiemal Tricarboxyl Vapor')
  })
})
