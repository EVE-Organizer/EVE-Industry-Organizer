import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { buildWindowPriceMap } from '@/lib/ranking'
import {
  miningDisplayVolume,
  miningPathHasPriceData,
  miningPathDisplayIph,
  isExcludedMiningItem,
  rankMiningIph,
  rankMiningItem,
  resolveMiningBreakdownPath,
  miningRowDisplayName,
  miningRowMarketTypeId,
  miningRowMatchesNameQuery,
  RETRIEVER_ORE_M3_PER_HR,
  sortMiningRows,
} from '@/lib/miningIph'
import { buildPriceMap, buildTypeMap, getHubMarket } from '@/services/data/sdeLoader'
import type { HubMarketData, MiningData, MarketData, TypeInfo } from '@/types'

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
      foundIn: ['highsec', 'lowsec', 'nullsec', 'wormhole'],
      compressedTypeId: 62528,
      reprocess: [
        { typeId: 34, quantityPerBatch: 175 },
        { typeId: 36, quantityPerBatch: 70 },
      ],
      iconUrl: '',
    },
    {
      typeId: 11396,
      name: 'Mercoxit',
      group: 'Mercoxit',
      volume: 0.6,
      portionSize: 100,
      subtype: 'ore',
      foundIn: ['nullsec'],
      compressedTypeId: null,
      reprocess: [{ typeId: 40, quantityPerBatch: 140 }],
      iconUrl: '',
    },
    {
      typeId: 1230,
      name: 'Veldspar',
      group: 'Veldspar',
      volume: 0.1,
      portionSize: 100,
      subtype: 'ore',
      foundIn: ['highsec', 'lowsec', 'nullsec', 'wormhole'],
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
    '62528': { all: { avgPrice: 12, avgVolume: 5000, high: 12, low: 12 } },
    '62516': { all: { avgPrice: 6, avgVolume: 8000, high: 6, low: 6 } },
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
    expect(rows.every((r) => r.compressedIph != null && r.compressedIph > 0)).toBe(true)
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

  it('uses hub window average sell prices instead of spot', () => {
    const windowedHub: HubMarketData = {
      ...hubMarket,
      prices: { '18': 99, '1230': 99, '34': 99, '36': 99 },
      products: {
        '18': {
          '1w': { avgPrice: 10, avgVolume: 1000, high: 10, low: 10 },
          '1m': { avgPrice: 20, avgVolume: 1000, high: 20, low: 20 },
        },
        '1230': {
          '1w': { avgPrice: 5, avgVolume: 1000, high: 5, low: 5 },
          '1m': { avgPrice: 8, avgVolume: 1000, high: 8, low: 8 },
        },
        '34': { '1w': { avgPrice: 4, avgVolume: 1e9, high: 4, low: 4 } },
        '36': { '1w': { avgPrice: 50, avgVolume: 1e6, high: 50, low: 50 } },
        '62528': {
          '1w': { avgPrice: 12, avgVolume: 1000, high: 12, low: 12 },
          '1m': { avgPrice: 15, avgVolume: 1000, high: 15, low: 15 },
        },
        '62516': {
          '1w': { avgPrice: 6, avgVolume: 1000, high: 6, low: 6 },
          '1m': { avgPrice: 7, avgVolume: 1000, high: 7, low: 7 },
        },
      },
    }
    const spot = new Map<number, number>([
      [18, 99],
      [1230, 99],
      [34, 99],
      [36, 99],
    ])
    const sell1w = buildWindowPriceMap(windowedHub, '1w', spot)
    const sell1m = buildWindowPriceMap(windowedHub, '1m', spot)
    const rows1w = rankMiningIph(mining, windowedHub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1w',
      priceMethod: 'sell_orders',
      sellPrices: sell1w,
    })
    const rows1m = rankMiningIph(mining, windowedHub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
      sellPrices: sell1m,
    })
    const plagi1w = rows1w.find((r) => r.item.typeId === 18)
    const plagi1m = rows1m.find((r) => r.item.typeId === 18)
    expect(plagi1w?.compressedPrice).toBe(12)
    expect(plagi1m?.compressedPrice).toBe(15)
    expect(plagi1w?.compressedIph).not.toBe(plagi1m?.compressedIph)
  })

  it('treats dust compressed quotes as missing when hub volume is thin', () => {
    const dustRow = {
      ...mining.items[0],
      typeId: 999,
      name: 'Dust Ore',
    }
    const row = {
      item: dustRow,
      rawPrice: 0.02,
      compressedPrice: 1000,
      rawValuePerM3: 0.001,
      compressedValuePerM3: 50,
      mineralsValuePerM3: 0,
      rawIph: 30,
      compressedIph: 50_000,
      mineralsIph: 0,
      focusIph: null,
      focusQtyPerHr: null,
      focusTypeId: null,
      volDayRaw: 12,
      volDayCompressed: 5_000,
      volDayMinerals: 0,
      volDayFocus: null,
      volDay: 100,
      reprocessLines: [],
    }
    expect(miningPathHasPriceData('compressed', row)).toBe(true)
    expect(miningPathDisplayIph('compressed', {
      ...row,
      compressedPrice: 50_000,
      volDayCompressed: 50,
    })).toBeNull()
    expect(resolveMiningBreakdownPath(row, 'compressed')).toBe('compressed')
  })

  it('reprocess minerals always use window sell averages (like blueprint material buys)', () => {
    const windowedHub: HubMarketData = {
      ...hubMarket,
      prices: { '18': 99, '34': 99, '62528': 99 },
      buyPrices: { '18': 5, '34': 2, '62528': 12 },
      products: {
        '18': {
          '1w': { avgPrice: 10, avgVolume: 1000, high: 10, low: 10 },
          '1m': { avgPrice: 10, avgVolume: 1000, high: 10, low: 10 },
        },
        '34': {
          '1w': { avgPrice: 4, avgVolume: 1e9, high: 4, low: 4 },
          '1m': { avgPrice: 8, avgVolume: 1e9, high: 8, low: 8 },
        },
        '62528': {
          '1w': { avgPrice: 12, avgVolume: 1000, high: 12, low: 12 },
          '1m': { avgPrice: 12, avgVolume: 1000, high: 12, low: 12 },
        },
      },
    }
    const oreOnly: MiningData = {
      ...mining,
      items: [mining.items[0]],
    }
    const spot = new Map<number, number>([
      [18, 99],
      [34, 99],
      [62528, 99],
    ])
    const buy = new Map<number, number>([
      [18, 5],
      [34, 2],
      [62528, 12],
    ])
    const sell1w = buildWindowPriceMap(windowedHub, '1w', spot)
    const sell1m = buildWindowPriceMap(windowedHub, '1m', spot)
    const rows1w = rankMiningIph(oreOnly, windowedHub, spot, buy, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1w',
      priceMethod: 'buy_orders',
      sellPrices: sell1w,
      sortKey: 'minerals',
    })
    const rows1m = rankMiningIph(oreOnly, windowedHub, spot, buy, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'buy_orders',
      sellPrices: sell1m,
      sortKey: 'minerals',
    })
    expect(rows1w[0]?.compressedPrice).toBe(12)
    expect(rows1m[0]?.compressedPrice).toBe(12)
    expect(rows1w[0]?.mineralsIph).not.toBe(rows1m[0]?.mineralsIph)
  })

  it('requires every selected Found in space (AND)', () => {
    const spot = new Map(Object.entries(hubMarket.prices).map(([k, v]) => [Number(k), v]))
    const beltMining: MiningData = {
      ...mining,
      items: [mining.items[0], mining.items[1]],
    }
    const rows = rankMiningIph(beltMining, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: ['highsec', 'lowsec'],
      focusTypeId: null,
      window: 'all',
      priceMethod: 'sell_orders',
    })
    // Plagioclase spans HS+LS; Mercoxit is null-only.
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
        '62528': { all: { avgPrice: 12, avgVolume: 1000, high: 12, low: 12 } },
        // 1230 Veldspar / 62516: no product history
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
    expect(rows[0]?.volDayCompressed).toBeGreaterThan(0)
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
    expect(rows.every((r) => r.compressedIph != null && (r.volDayCompressed ?? 0) >= 100)).toBe(true)
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
      sortKey: 'compressed',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].volDayRaw).toBe(279)
    expect(rows[0].volDayCompressed).toBe(3057)
    expect(rows[0].volDay).toBe(3057)
    expect(miningDisplayVolume(rows[0], 'compressed')).toBe(3057)
  })

  it('hides Mercoxit when canMineItem rejects non-deep-core fleets', () => {
    const mercoxitMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 40_000, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
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
      prices: { '1230': 10, '11396': 24480, '62586': 20000, '11399': 20000, '34': 5 },
      products: {
        '1230': { '1y': { avgPrice: 10, avgVolume: 5000, high: 12, low: 8 } },
        '62516': { '1y': { avgPrice: 6, avgVolume: 5000, high: 7, low: 5 } },
        '11396': { '1y': { avgPrice: 16500, avgVolume: 279, high: 125000, low: 42 } },
        '62586': { '1y': { avgPrice: 20000, avgVolume: 3057, high: 25000, low: 10000 } },
      },
    }
    const spot = new Map([
      [1230, 10],
      [62516, 6],
      [11396, 24480],
      [62586, 20000],
      [11399, 20000],
      [34, 5],
    ])
    const opts = {
      subtype: 'ore' as const,
      foundIn: [] as const,
      focusTypeId: null,
      window: '1y' as const,
      priceMethod: 'sell_orders' as const,
    }
    const all = rankMiningIph(mercoxitMining, hub, spot, null, typeMap, opts)
    expect(all.map((r) => r.item.name).sort()).toEqual(['Mercoxit', 'Veldspar'])
    const msmOnly = rankMiningIph(mercoxitMining, hub, spot, null, typeMap, {
      ...opts,
      canMineItem: (item) => item.group !== 'Mercoxit',
    })
    expect(msmOnly.map((r) => r.item.name)).toEqual(['Veldspar'])
    const mercOnly = rankMiningIph(mercoxitMining, hub, spot, null, typeMap, {
      ...opts,
      canMineItem: (item) => item.group === 'Mercoxit',
    })
    expect(mercOnly.map((r) => r.item.name)).toEqual(['Mercoxit'])
  })

  it('excludes ore when compressed hub volume is below listing threshold', () => {
    const rakoveneMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 50_400, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 52315,
          name: 'Rakovene',
          group: 'Rakovene',
          volume: 16,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['nullsec'],
          compressedTypeId: 62579,
          reprocess: [
            { typeId: 34, quantityPerBatch: 40000 },
            { typeId: 37, quantityPerBatch: 3200 },
            { typeId: 39, quantityPerBatch: 200 },
          ],
          iconUrl: '',
        },
      ],
    }
    const hub: HubMarketData = {
      regionId: 10000042,
      marketSystemId: 30002053,
      buildSystemId: 30002053,
      costIndex: 0.01,
      prices: { '52315': 3261, '62579': 12650, '34': 4, '37': 50, '39': 1200 },
      products: {
        '52315': { '1y': { avgPrice: 3261, avgVolume: 209.4, high: 19000, low: 0.01 } },
        '62579': { '1m': { avgPrice: 12650, avgVolume: 1, high: 12650, low: 12650 } },
      },
    }
    const spot = new Map([
      [52315, 3261],
      [62579, 12650],
      [34, 4],
      [37, 50],
      [39, 1200],
    ])
    const rows = rankMiningIph(rakoveneMining, hub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
    })
    expect(rows).toHaveLength(0)
  })

  it('uses compressed hub volume for liquidity when listed', () => {
    const rakoveneMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 42_163, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 52315,
          name: 'Rakovene',
          group: 'Rakovene',
          volume: 16,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['nullsec'],
          compressedTypeId: 62579,
          reprocess: [
            { typeId: 34, quantityPerBatch: 40000 },
            { typeId: 37, quantityPerBatch: 3200 },
            { typeId: 39, quantityPerBatch: 200 },
          ],
          iconUrl: '',
        },
      ],
    }
    const hub: HubMarketData = {
      regionId: 10000042,
      marketSystemId: 30002053,
      buildSystemId: 30002053,
      costIndex: 0.01,
      prices: { '52315': 3261, '62579': 12650, '34': 4, '37': 50, '39': 1200 },
      products: {
        '52315': { '1y': { avgPrice: 3261, avgVolume: 209.4, high: 19000, low: 0.01 } },
        '62579': { '1m': { avgPrice: 12650, avgVolume: 500, high: 12650, low: 12650 } },
      },
    }
    const spot = new Map([
      [52315, 3261],
      [62579, 12650],
      [34, 4],
      [37, 50],
      [39, 1200],
    ])
    const rows = rankMiningIph(rakoveneMining, hub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].volDayRaw).toBe(209.4)
    expect(rows[0].volDayCompressed).toBe(500)
    expect(rows[0].volDay).toBe(500)
    expect(miningDisplayVolume(rows[0], 'compressed')).toBe(500)
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

  it('hides gas without mined-type hub volume (not mineral proxy)', () => {
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
    expect(rows).toHaveLength(0)
  })

  it('excludes event grades and crystallites from rankings', () => {
    const junkMining: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 50_400, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 92568,
          name: 'Kangite X-Grade',
          group: 'Kangite',
          volume: 1,
          portionSize: 100,
          subtype: 'ore',
          foundIn: ['highsec'],
          compressedTypeId: 92821,
          reprocess: [{ typeId: 34, quantityPerBatch: 1000 }],
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
    const hub: HubMarketData = {
      regionId: 10000002,
      marketSystemId: 30000142,
      buildSystemId: 30000142,
      costIndex: 0.01,
      prices: { '92568': 5000, '1230': 10, '62516': 11, '34': 4 },
      products: {
        '92568': { '1m': { avgPrice: 5000, avgVolume: 10_000, high: 6000, low: 4000 } },
        '1230': { '1m': { avgPrice: 10, avgVolume: 20_000, high: 11, low: 9 } },
        '62516': { '1m': { avgPrice: 11, avgVolume: 50_000, high: 12, low: 10 } },
      },
    }
    const spot = new Map([
      [92568, 5000],
      [1230, 10],
      [62516, 11],
      [34, 4],
    ])
    const rows = rankMiningIph(junkMining, hub, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
    })
    expect(rows.every((r) => r.item.typeId !== 92568)).toBe(true)
    expect(rows.some((r) => r.item.typeId === 1230)).toBe(true)
  })

  it('isExcludedMiningItem flags grades and gem groups', () => {
    expect(
      isExcludedMiningItem({
        typeId: 92568,
        name: 'Kangite X-Grade',
        group: 'Kangite',
        volume: 1,
        portionSize: 100,
        subtype: 'ore',
        foundIn: ['highsec'],
        compressedTypeId: null,
        reprocess: [],
        iconUrl: '',
      }),
    ).toBe(true)
    expect(
      isExcludedMiningItem({
        typeId: 1230,
        name: 'Veldspar',
        group: 'Veldspar',
        volume: 0.1,
        portionSize: 100,
        subtype: 'ore',
        foundIn: ['highsec'],
        compressedTypeId: 62516,
        reprocess: [],
        iconUrl: '',
      }),
    ).toBe(false)
  })

  it('uses real hub window averages that differ by window (Jita Plagioclase)', () => {
    const market = JSON.parse(
      readFileSync('public/data/market.json', 'utf8'),
    ) as MarketData
    const miningData = JSON.parse(
      readFileSync('public/data/mining.json', 'utf8'),
    ) as MiningData
    const typesRaw = JSON.parse(readFileSync('public/data/types.json', 'utf8')) as
      | { types: Parameters<typeof buildTypeMap>[0] }
      | Parameters<typeof buildTypeMap>[0]
    const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types
    const hubMarket = getHubMarket(market, 'jita')!
    const spot = buildPriceMap(hubMarket)
    const typeMap = buildTypeMap(types)
    const sell1w = buildWindowPriceMap(hubMarket, '1w', spot)
    const sell1m = buildWindowPriceMap(hubMarket, '1m', spot)

    const rows1w = rankMiningIph(miningData, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1w',
      priceMethod: 'sell_orders',
      sellPrices: sell1w,
    })
    const rows1m = rankMiningIph(miningData, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
      sellPrices: sell1m,
    })

    const plagi1w = rows1w.find((r) => r.item.name === 'Plagioclase')
    const plagi1m = rows1m.find((r) => r.item.name === 'Plagioclase')
    expect(plagi1w?.rawPrice).toBe(hubMarket.products['18']?.['1w']?.avgPrice)
    expect(plagi1m?.rawPrice).toBe(hubMarket.products['18']?.['1m']?.avgPrice)
    expect(plagi1w?.rawPrice).not.toBe(plagi1m?.rawPrice)
    expect(plagi1w?.rawIph).not.toBe(plagi1m?.rawIph)
  })

  it('matches Jita Veldspar ISK/hr from hub window price and Retriever m³/hr', () => {
    const market = JSON.parse(
      readFileSync('public/data/market.json', 'utf8'),
    ) as MarketData
    const miningData = JSON.parse(
      readFileSync('public/data/mining.json', 'utf8'),
    ) as MiningData
    const typesRaw = JSON.parse(readFileSync('public/data/types.json', 'utf8')) as
      | { types: Parameters<typeof buildTypeMap>[0] }
      | Parameters<typeof buildTypeMap>[0]
    const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types
    const hubMarket = getHubMarket(market, 'jita')!
    const spot = buildPriceMap(hubMarket)
    const typeMap = buildTypeMap(types)
    const sell1m = buildWindowPriceMap(hubMarket, '1m', spot)

    const rows = rankMiningIph(miningData, hubMarket, spot, null, typeMap, {
      subtype: 'ore',
      foundIn: [],
      focusTypeId: null,
      window: '1m',
      priceMethod: 'sell_orders',
      sellPrices: sell1m,
      m3PerHr: RETRIEVER_ORE_M3_PER_HR,
    })

    const veld = rows.find((r) => r.item.name === 'Veldspar')
    expect(veld).toBeDefined()
    const rawPrice = hubMarket.products['1230']?.['1m']?.avgPrice
    expect(rawPrice).toBeGreaterThan(0)
    expect(veld!.rawIph).toBe(Math.round((rawPrice! / 0.1) * RETRIEVER_ORE_M3_PER_HR))

    const compressedPrice = hubMarket.products['62516']?.['1m']?.avgPrice
    expect(compressedPrice).toBeGreaterThan(0)
    expect(veld!.compressedIph).toBe(
      Math.round((compressedPrice! / 0.1) * RETRIEVER_ORE_M3_PER_HR),
    )
    expect(veld!.compressedIph).not.toBe(veld!.rawIph * 100)
  })

  it('excludes ice without a compressed market type', () => {
    const iceLike: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 40_000, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 16262,
          name: 'Water Ice',
          group: 'Ice',
          volume: 1000,
          portionSize: 1,
          subtype: 'ice',
          foundIn: ['highsec'],
          compressedTypeId: null,
          reprocess: [{ typeId: 16272, quantityPerBatch: 69 }],
          iconUrl: '',
        },
      ],
    }
    const hub: HubMarketData = {
      regionId: 10000002,
      marketSystemId: 30000142,
      buildSystemId: 30000142,
      costIndex: 0.01,
      prices: { '16262': 100_000, '16272': 500 },
      products: {
        '16262': { '1y': { avgPrice: 100_000, avgVolume: 5_000, high: 110_000, low: 90_000 } },
      },
    }
    const spot = new Map([
      [16262, 100_000],
      [16272, 500],
    ])
    const rows = rankMiningIph(iceLike, hub, spot, null, typeMap, {
      subtype: 'ice',
      foundIn: [],
      focusTypeId: null,
      window: '1y',
      priceMethod: 'sell_orders',
    })
    expect(rows).toHaveLength(0)
  })

  it('does not copy raw hub volume into compressed volume when there is no compressed type', () => {
    const iceLike: MiningData = {
      generatedAt: '',
      defaults: { m3PerHr: 40_000, reprocessYield: 0.5 },
      focusOutputs: { ore: [], moon: [], ice: [], gas: [] },
      items: [
        {
          typeId: 16262,
          name: 'Water Ice',
          group: 'Ice',
          volume: 1000,
          portionSize: 1,
          subtype: 'ice',
          foundIn: ['highsec'],
          compressedTypeId: 28433,
          reprocess: [{ typeId: 16272, quantityPerBatch: 69 }],
          iconUrl: '',
        },
      ],
    }
    const hub: HubMarketData = {
      regionId: 10000002,
      marketSystemId: 30000142,
      buildSystemId: 30000142,
      costIndex: 0.01,
      prices: { '16262': 100_000, '28433': 120_000, '16272': 500 },
      products: {
        '16262': { '1y': { avgPrice: 100_000, avgVolume: 5_000, high: 110_000, low: 90_000 } },
        // compressed type: no hub history (live fetch would fill this)
      },
    }
    const spot = new Map([
      [16262, 100_000],
      [28433, 120_000],
      [16272, 500],
    ])
    const sell = buildWindowPriceMap(hub, '1y', spot)
    const rows = rankMiningIph(iceLike, hub, spot, null, typeMap, {
      subtype: 'ice',
      foundIn: [],
      focusTypeId: null,
      window: '1y',
      priceMethod: 'sell_orders',
    })
    expect(rows).toHaveLength(0)
    const row = rankMiningItem(
      iceLike.items[0],
      hub,
      '1y',
      sell,
      null,
      'sell_orders',
      (id) => `Type ${id}`,
      { m3PerHr: 40_000, reprocessYield: 0.5, focusTypeId: null },
    )
    expect(row?.volDayCompressed).toBe(0)
    expect(row?.compressedIph).toBeGreaterThan(0)
    expect(miningPathDisplayIph('compressed', row!)).toBeNull()
    expect(miningDisplayVolume(row!, 'compressed')).toBe(0)
  })

  it('leaves thin-traded reprocess outputs out of Reprocess ISK/hr', () => {
    const pochvenItem = {
      typeId: 76373,
      name: 'Nesosilicate Rakovene',
      group: 'Rakovene',
      volume: 0.5,
      portionSize: 100,
      subtype: 'ore' as const,
      foundIn: ['nullsec' as const],
      compressedTypeId: null,
      reprocess: [
        { typeId: 34, quantityPerBatch: 1500 },
        { typeId: 76374, quantityPerBatch: 65 },
      ],
      iconUrl: '',
    }
    const hub: HubMarketData = {
      regionId: 10000002,
      marketSystemId: 30000142,
      buildSystemId: 30000142,
      costIndex: 0.01,
      prices: { '76373': 10_000, '34': 5, '76374': 2_000_000 },
      products: {
        '76373': { '1m': { avgPrice: 10_000, avgVolume: 2_000, high: 12_000, low: 8_000 } },
        '34': { '1m': { avgPrice: 5, avgVolume: 50_000_000, high: 6, low: 4 } },
        '76374': { '1m': { avgPrice: 2_000_000, avgVolume: 40, high: 3_000_000, low: 1_000_000 } },
      },
    }
    const spot = new Map([
      [76373, 10_000],
      [34, 5],
      [76374, 2_000_000],
    ])
    const sell = buildWindowPriceMap(hub, '1m', spot)
    const listed = rankMiningIph(
      { generatedAt: '', defaults: { m3PerHr: 42_163, reprocessYield: 0.5 }, focusOutputs: { ore: [], moon: [], ice: [], gas: [] }, items: [pochvenItem] },
      hub,
      spot,
      null,
      typeMap,
      {
        subtype: 'ore',
        foundIn: [],
        focusTypeId: null,
        window: '1m',
        priceMethod: 'sell_orders',
        m3PerHr: 42_163,
      },
    )
    expect(listed).toHaveLength(0)

    const row = rankMiningItem(
      pochvenItem,
      hub,
      '1m',
      sell,
      null,
      'sell_orders',
      (id) => (id === 34 ? 'Tritanium' : `Type ${id}`),
      { m3PerHr: 42_163, reprocessYield: 0.5, focusTypeId: null },
    )
    expect(row).not.toBeNull()
    const tritIph = (1500 / (0.5 * 100)) * 0.5 * 5 * 42_163
    expect(row!.mineralsIph).toBe(Math.round(tritIph))
    expect(row!.mineralsIph).toBeLessThan(10_000_000)
    expect(row!.reprocessLines.some((l) => l.typeId === 76374 && l.iskPerHr > 1_000_000_000)).toBe(
      true,
    )
  })

  it('uses compressed type for row display name and search', () => {
    const types = new Map<number, TypeInfo>([
      ...typeMap,
      [62516, { typeId: 62516, name: 'Compressed Veldspar', group: '', category: '', volume: 0.1, iconUrl: '', renderUrl: '', bpIconUrl: '' }],
    ])
    const veld = mining.items[2]
    expect(miningRowDisplayName(veld, types)).toBe('Compressed Veldspar')
    expect(miningRowMarketTypeId(veld)).toBe(62516)
    expect(
      miningRowMatchesNameQuery(
        { item: veld } as import('@/types').MiningRankedRow,
        'compressed veld',
        types,
      ),
    ).toBe(true)
    expect(
      miningRowMatchesNameQuery(
        { item: veld } as import('@/types').MiningRankedRow,
        'plain veld',
        types,
      ),
    ).toBe(false)
  })
})
