import type {
  HubMarketData,
  MiningData,
  MiningItem,
  MiningIphSortKey,
  MiningRankedRow,
  MiningReprocessLine,
  MiningSpaceClass,
  MiningSubtype,
  TimeRange,
  TypeInfo,
} from '@/types'
import { buildWindowPriceMap, pickHistoryWindow } from '@/lib/ranking'

/**
 * Retriever + 2× Strip Miner I, average Mining/Astrogeology (~840 m³/min).
 * @see https://wiki.eveuniversity.org/Mining_yield
 */
export const RETRIEVER_ORE_M3_PER_HR = 50_400

/** Retriever + 2× Ice Harvester I, Ice Harvesting IV (SDE cycle times, no boosts). */
export const RETRIEVER_ICE_M3_PER_HR = 37_500

/** Venture + Gas Cloud Scoop II, reference gas skills (Retriever cannot harvest gas). */
export const VENTURE_GAS_M3_PER_HR = 2_400

export const DEFAULT_MINING_M3_PER_HR = RETRIEVER_ORE_M3_PER_HR

export const DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE: Record<MiningSubtype, number> = {
  ore: RETRIEVER_ORE_M3_PER_HR,
  moon: RETRIEVER_ORE_M3_PER_HR,
  ice: RETRIEVER_ICE_M3_PER_HR,
  gas: VENTURE_GAS_M3_PER_HR,
}

/** Labeled default reprocess yield (NPC-ish / unskilled structure). */
export const DEFAULT_REPROCESS_YIELD = 0.5

export const DEFAULT_MINING_IPH_SORT_KEY: MiningIphSortKey = 'compressed'

export const MINING_SUBTYPES: { id: MiningSubtype; label: string }[] = [
  { id: 'moon', label: 'Moon' },
  { id: 'ore', label: 'Ore' },
  { id: 'ice', label: 'Ice' },
  { id: 'gas', label: 'Gas' },
]

export const MINING_SPACES: { id: MiningSpaceClass; label: string; color: string }[] = [
  // CCP in-game security status colors (https://developers.eveonline.com/docs/guides/system-security/).
  { id: 'highsec', label: 'HS', color: '#71E754' }, // 0.6
  { id: 'lowsec', label: 'LS', color: '#DC6C06' }, // 0.4
  { id: 'nullsec', label: 'NS', color: '#8D3163' }, // ≤ 0.0
  // WH systems display as −1.0 (same band as null); slightly brighter so chips stay distinct.
  { id: 'wormhole', label: 'WH', color: '#B44AC0' },
]

export function spaceLabel(space: MiningSpaceClass): string {
  return MINING_SPACES.find((s) => s.id === space)?.label ?? space
}

export function spaceColor(space: MiningSpaceClass): string {
  return MINING_SPACES.find((s) => s.id === space)?.color ?? '#8D3163'
}

export function resolveMiningM3PerHr(mining: MiningData, subtype: MiningSubtype): number {
  return (
    mining.defaults.m3PerHrBySubtype?.[subtype] ??
    mining.defaults.m3PerHr ??
    DEFAULT_MINING_M3_PER_HR_BY_SUBTYPE[subtype] ??
    DEFAULT_MINING_M3_PER_HR
  )
}

export function miningVolumeLabel(window: TimeRange): string {
  return `Vol (${window})`
}

/** Table/modal labels and tooltips for the three ISK/hr valuation paths. */
/** Which valuation path is shown in the breakdown modal. */
export type MiningIphFocusPath = 'raw' | 'compressed' | 'minerals'

export const MINING_IPH_PATHS = {
  raw: {
    label: 'Raw ISK/hr',
    shortLabel: 'Raw',
    tooltip:
      'Sell uncompressed ore, ice, or gas at the hub. Uses your price window and sell/buy setting.',
  },
  compressed: {
    label: 'Compressed ISK/hr',
    shortLabel: 'Compressed',
    tooltip:
      'Same m³/hr, valued as the compressed form when this item has a compressed type on the market.',
  },
  minerals: {
    label: 'Reprocess ISK/hr',
    shortLabel: 'Reprocess',
    tooltip:
      'Reprocess at your yield setting and sell every output mineral at hub prices.',
  },
} as const

/** Prefer compressed hub volume when the raw market is thin. */
export function miningLiquidityVolume(row: MiningRankedRow): number {
  const raw = row.volDayRaw ?? 0
  const compressed = row.volDayCompressed ?? 0
  if (row.item.compressedTypeId != null) return Math.max(raw, compressed)
  return raw
}

/** Volume column for the active sort key (does not mutate row.volDay). */
export function miningDisplayVolume(
  row: MiningRankedRow,
  sortKey: MiningIphSortKey,
): number {
  switch (sortKey) {
    case 'raw':
    case 'compressed':
    case 'vol':
      // Same liquidity proxy for every direct-sale path (raw or compressed).
      return miningLiquidityVolume(row)
    case 'focus':
      return row.volDayFocus ?? row.volDay
    case 'minerals':
    default:
      return row.volDayMinerals ?? row.volDay
  }
}

export function shouldIncludeMiningRow(
  row: MiningRankedRow,
  subtype: MiningSubtype,
): boolean {
  switch (subtype) {
    case 'ore':
    case 'ice': {
      const hasRaw = (row.volDayRaw ?? 0) > 0 && row.rawIph > 0
      const hasComp =
        (row.volDayCompressed ?? 0) > 0 && (row.compressedIph ?? 0) > 0
      return hasRaw || hasComp
    }
    case 'gas':
      if ((row.volDayRaw ?? 0) > 0 && row.rawIph > 0) return true
      return row.mineralsIph > 0 && (row.volDayMinerals ?? 0) > 0
    case 'moon':
      return row.mineralsIph > 0 && (row.volDayMinerals ?? 0) > 0
    default:
      return true
  }
}

export function isCompressedMiningName(name: string): boolean {
  return /compress/i.test(name)
}

export function collectMiningPriceTypeIds(
  mining: MiningData,
  subtype?: MiningSubtype,
): number[] {
  const ids = new Set<number>()
  for (const item of mining.items) {
    if (subtype && item.subtype !== subtype) continue
    if (isCompressedMiningName(item.name)) continue
    ids.add(item.typeId)
    if (item.compressedTypeId != null) ids.add(item.compressedTypeId)
    for (const mat of item.reprocess) ids.add(mat.typeId)
  }
  for (const outputs of Object.values(mining.focusOutputs)) {
    for (const o of outputs) ids.add(o.typeId)
  }
  return [...ids]
}

function priceOf(
  typeId: number,
  windowPrices: Map<number, number>,
  buyPrices: Map<number, number> | null,
  priceMethod: 'sell_orders' | 'buy_orders',
): number {
  if (priceMethod === 'buy_orders') {
    return buyPrices?.get(typeId) ?? 0
  }
  return windowPrices.get(typeId) ?? 0
}

function avgVolumeOf(hubMarket: HubMarketData, typeId: number, window: TimeRange): number {
  const byWindow = hubMarket.products[String(typeId)]
  if (!byWindow) return 0
  const summary = pickHistoryWindow(byWindow, window, 'avgVolume')
  return summary?.avgVolume ?? 0
}

function topMineralTypeId(lines: MiningReprocessLine[]): number | null {
  let bestId: number | null = null
  let bestIph = 0
  for (const line of lines) {
    if (bestId == null || line.iskPerHr > bestIph) {
      bestId = line.typeId
      bestIph = line.iskPerHr
    }
  }
  return bestId
}

function buildReprocessLines(
  item: MiningItem,
  windowPrices: Map<number, number>,
  buyPrices: Map<number, number> | null,
  priceMethod: 'sell_orders' | 'buy_orders',
  typeName: (typeId: number) => string,
  m3PerHr: number,
  yieldFactor: number,
): MiningReprocessLine[] {
  if (!(item.volume > 0) || item.portionSize <= 0 || item.reprocess.length === 0) return []

  const batchesPerM3 = 1 / (item.volume * item.portionSize)
  const lines: MiningReprocessLine[] = []

  for (const mat of item.reprocess) {
    const price = priceOf(mat.typeId, windowPrices, buyPrices, priceMethod)
    const qtyPerM3 = mat.quantityPerBatch * batchesPerM3 * yieldFactor
    const iskPerHr = qtyPerM3 * price * m3PerHr
    lines.push({
      typeId: mat.typeId,
      name: typeName(mat.typeId),
      qtyPerM3,
      price,
      iskPerHr,
    })
  }

  return lines
}

export function rankMiningItem(
  item: MiningItem,
  hubMarket: HubMarketData,
  window: TimeRange,
  windowPrices: Map<number, number>,
  buyPrices: Map<number, number> | null,
  priceMethod: 'sell_orders' | 'buy_orders',
  typeName: (typeId: number) => string,
  opts: {
    m3PerHr: number
    reprocessYield: number
    focusTypeId: number | null
  },
): MiningRankedRow | null {
  if (!(item.volume > 0)) return null

  const rawPrice = priceOf(item.typeId, windowPrices, buyPrices, priceMethod)
  const rawValuePerM3 = rawPrice > 0 ? rawPrice / item.volume : 0
  const rawIph = rawValuePerM3 * opts.m3PerHr

  let compressedPrice: number | null = null
  let compressedValuePerM3: number | null = null
  let compressedIph: number | null = null
  if (item.compressedTypeId != null) {
    const cPrice = priceOf(item.compressedTypeId, windowPrices, buyPrices, priceMethod)
    if (cPrice > 0) {
      compressedPrice = cPrice
      compressedValuePerM3 = cPrice / item.volume
      compressedIph = compressedValuePerM3 * opts.m3PerHr
    }
  }

  const reprocessLines = buildReprocessLines(
    item,
    windowPrices,
    buyPrices,
    priceMethod,
    typeName,
    opts.m3PerHr,
    opts.reprocessYield,
  )
  const mineralsIph = reprocessLines.reduce((sum, line) => sum + line.iskPerHr, 0)
  const mineralsValuePerM3 = opts.m3PerHr > 0 ? mineralsIph / opts.m3PerHr : 0

  let focusIph: number | null = null
  let focusQtyPerHr: number | null = null
  if (opts.focusTypeId != null) {
    const line = reprocessLines.find((l) => l.typeId === opts.focusTypeId)
    focusIph = line?.iskPerHr ?? 0
    focusQtyPerHr = line != null ? line.qtyPerM3 * opts.m3PerHr : 0
  }

  const topMineralId = topMineralTypeId(reprocessLines)

  const volRaw = avgVolumeOf(hubMarket, item.typeId, window)
  const volCompressed =
    item.compressedTypeId != null
      ? avgVolumeOf(hubMarket, item.compressedTypeId, window)
      : volRaw
  const volMinerals =
    topMineralId != null ? avgVolumeOf(hubMarket, topMineralId, window) : volRaw
  const volFocus =
    opts.focusTypeId != null ? avgVolumeOf(hubMarket, opts.focusTypeId, window) : volMinerals

  if (rawIph <= 0 && (compressedIph == null || compressedIph <= 0) && mineralsIph <= 0) {
    return null
  }

  const rowBase = {
    item,
    rawPrice,
    compressedPrice,
    rawValuePerM3,
    compressedValuePerM3,
    mineralsValuePerM3,
    rawIph,
    compressedIph,
    mineralsIph,
    focusIph,
    focusQtyPerHr,
    focusTypeId: opts.focusTypeId,
    volDayRaw: volRaw,
    volDayCompressed: volCompressed,
    volDayMinerals: volMinerals,
    volDayFocus: volFocus,
    reprocessLines,
  }

  return {
    ...rowBase,
    volDay: miningLiquidityVolume({ ...rowBase, volDay: volRaw }),
  }
}

export function sortMiningRows(
  rows: MiningRankedRow[],
  sortKey: MiningIphSortKey,
  sortDesc = true,
): MiningRankedRow[] {
  const value = (row: MiningRankedRow): number => {
    switch (sortKey) {
      case 'raw':
        return row.rawIph
      case 'compressed':
        return row.compressedIph ?? -1
      case 'minerals':
        return row.mineralsIph
      case 'focus':
        return row.focusQtyPerHr ?? -1
      case 'vol':
        return miningDisplayVolume(row, sortKey)
      default:
        return row.mineralsIph
    }
  }

  const sorted = [...rows]
  sorted.sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    if (av === bv) return a.item.name.localeCompare(b.item.name)
    return sortDesc ? bv - av : av - bv
  })

  return sorted
}

export interface RankMiningOptions {
  subtype: MiningSubtype
  foundIn: MiningSpaceClass[]
  focusTypeId: number | null
  window: TimeRange
  priceMethod: 'sell_orders' | 'buy_orders'
  m3PerHr?: number
  reprocessYield?: number
  sortKey?: MiningIphSortKey
  sortDesc?: boolean
}

export function rankMiningIph(
  mining: MiningData,
  hubMarket: HubMarketData,
  spotPrices: Map<number, number>,
  buyPrices: Map<number, number> | null,
  typeMap: Map<number, TypeInfo>,
  options: RankMiningOptions,
): MiningRankedRow[] {
  const m3PerHr =
    options.m3PerHr ?? resolveMiningM3PerHr(mining, options.subtype)
  const reprocessYield =
    options.reprocessYield ?? mining.defaults.reprocessYield ?? DEFAULT_REPROCESS_YIELD
  const typeName = (typeId: number) => typeMap.get(typeId)?.name ?? `Type ${typeId}`
  const foundFilter = options.foundIn

  const windowPrices = buildWindowPriceMap(hubMarket, options.window, spotPrices)

  const rows: MiningRankedRow[] = []
  for (const item of mining.items) {
    if (isCompressedMiningName(item.name)) continue
    if (item.subtype !== options.subtype) continue
    if (foundFilter.length > 0 && !foundFilter.every((s) => item.foundIn.includes(s))) continue

    const row = rankMiningItem(
      item,
      hubMarket,
      options.window,
      windowPrices,
      buyPrices,
      options.priceMethod,
      typeName,
      {
        m3PerHr,
        reprocessYield,
        focusTypeId: options.focusTypeId,
      },
    )
    if (!row) continue
    if (options.focusTypeId != null && (row.focusQtyPerHr == null || row.focusQtyPerHr <= 0)) continue
    if (!shouldIncludeMiningRow(row, options.subtype)) continue
    rows.push(row)
  }

  if (options.sortKey) {
    return sortMiningRows(rows, options.sortKey, options.sortDesc !== false)
  }
  return rows
}
