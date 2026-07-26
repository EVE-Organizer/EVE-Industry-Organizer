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
import { buildWindowPriceMap } from '@/lib/ranking'

/** Mid-tier barge reference rate for comparable ranks. */
export const DEFAULT_MINING_M3_PER_HR = 40_000

/** Labeled default reprocess yield (NPC-ish / unskilled structure). */
export const DEFAULT_REPROCESS_YIELD = 0.5

export const MINING_SUBTYPES: { id: MiningSubtype; label: string }[] = [
  { id: 'moon', label: 'Moon' },
  { id: 'ore', label: 'Ore' },
  { id: 'ice', label: 'Ice' },
  { id: 'gas', label: 'Gas' },
]

export const MINING_SPACES: { id: MiningSpaceClass; label: string }[] = [
  { id: 'highsec', label: 'HS' },
  { id: 'lowsec', label: 'LS' },
  { id: 'nullsec', label: 'NS' },
  { id: 'wormhole', label: 'WH' },
]

export function spaceLabel(space: MiningSpaceClass): string {
  return MINING_SPACES.find((s) => s.id === space)?.label ?? space
}

/** Hub avg traded volume for the active price window (same source as Blueprints). */
export function miningVolumeLabel(window: TimeRange): string {
  return `Vol (${window})`
}

/**
 * Hub liquidity for Vol column. Ores/ice mostly trade compressed at hubs —
 * raw Mercoxit volume is tiny while Compressed Mercoxit is the real market.
 */
export function miningLiquidityVolume(row: MiningRankedRow): number {
  const raw = row.volDayRaw ?? 0
  const compressed = row.volDayCompressed ?? 0
  if (row.item.compressedTypeId != null) return Math.max(raw, compressed)
  return raw
}

/** Drop rows that are not meaningfully traded at the hub for their subtype. */
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
      // Require ore/ice itself to trade (raw or compressed), not mineral-only ghosts.
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

/** Compressed / batch-compressed types belong in the Comp column, never as rows. */
export function isCompressedMiningName(name: string): boolean {
  return /compress/i.test(name)
}

/** All type IDs needed for mining ISK/hr (raw, compressed, reprocess outputs). */
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
  if (priceMethod === 'buy_orders' && buyPrices) {
    const buy = buyPrices.get(typeId) ?? 0
    if (buy > 0) return buy
  }
  return windowPrices.get(typeId) ?? 0
}

function avgVolumeOf(hubMarket: HubMarketData, typeId: number, window: TimeRange): number {
  const byWindow = hubMarket.products[String(typeId)]
  if (!byWindow) return 0
  const summary = byWindow[window] ?? byWindow['1m'] ?? byWindow['1d'] ?? byWindow.all
  return summary?.avgVolume ?? 0
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

  // No sort here — ranking only needs totals; modal can sort if needed.
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
  if (opts.focusTypeId != null) {
    const line = reprocessLines.find((l) => l.typeId === opts.focusTypeId)
    focusIph = line?.iskPerHr ?? 0
  }

  // Precompute volumes for every sort key so sort never re-ranks economics.
  const topMineralId = reprocessLines.reduce<number | null>((best, line) => {
    if (best == null) return line.typeId
    const bestLine = reprocessLines.find((l) => l.typeId === best)
    return (line.iskPerHr > (bestLine?.iskPerHr ?? 0) ? line.typeId : best)
  }, null)

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

  return {
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
    focusTypeId: opts.focusTypeId,
    volDay: volRaw,
    volDayRaw: volRaw,
    volDayCompressed: volCompressed,
    volDayMinerals: volMinerals,
    volDayFocus: volFocus,
    reprocessLines,
  }
}

export function sortMiningRows(
  rows: MiningRankedRow[],
  sortKey: MiningIphSortKey,
  sortDesc = true,
): MiningRankedRow[] {
  // When sorting by vol, use the volume that matches how the user last ranked economics.
  const value = (row: MiningRankedRow): number => {
    switch (sortKey) {
      case 'raw':
        return row.rawIph
      case 'compressed':
        return row.compressedIph ?? -1
      case 'minerals':
        return row.mineralsIph
      case 'focus':
        return row.focusIph ?? -1
      case 'vol':
        return row.volDay
      default:
        return row.mineralsIph
    }
  }

  const volForDisplay = (row: MiningRankedRow): number => {
    switch (sortKey) {
      case 'raw':
      case 'vol':
        // Prefer compressed hub volume when present (ores trade compressed).
        return miningLiquidityVolume(row)
      case 'compressed':
        return row.volDayCompressed ?? row.volDay
      case 'focus':
        return row.volDayFocus ?? row.volDay
      case 'minerals':
      default:
        return row.volDayMinerals ?? row.volDay
    }
  }

  const decorated = rows.map((row) => ({
    ...row,
    volDay: volForDisplay(row),
  }))

  decorated.sort((a, b) => {
    const av = sortKey === 'vol' ? volForDisplay(a) : value(a)
    const bv = sortKey === 'vol' ? volForDisplay(b) : value(b)
    if (av === bv) return a.item.name.localeCompare(b.item.name)
    return sortDesc ? bv - av : av - bv
  })

  return decorated
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

/** Build ranked rows once (prices computed a single time). Pass sortKey to also sort. */
export function rankMiningIph(
  mining: MiningData,
  hubMarket: HubMarketData,
  spotPrices: Map<number, number>,
  buyPrices: Map<number, number> | null,
  typeMap: Map<number, TypeInfo>,
  options: RankMiningOptions,
): MiningRankedRow[] {
  const m3PerHr = options.m3PerHr ?? mining.defaults.m3PerHr ?? DEFAULT_MINING_M3_PER_HR
  const reprocessYield =
    options.reprocessYield ?? mining.defaults.reprocessYield ?? DEFAULT_REPROCESS_YIELD
  const typeName = (typeId: number) => typeMap.get(typeId)?.name ?? `Type ${typeId}`
  const foundFilter = options.foundIn

  // One window price map for the whole hub — not once per item.
  const windowPrices = buildWindowPriceMap(hubMarket, options.window, spotPrices)

  const rows: MiningRankedRow[] = []
  for (const item of mining.items) {
    if (isCompressedMiningName(item.name)) continue
    if (item.subtype !== options.subtype) continue
    if (foundFilter.length > 0 && !item.foundIn.some((s) => foundFilter.includes(s))) continue

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
    if (options.focusTypeId != null && (row.focusIph == null || row.focusIph <= 0)) continue
    if (!shouldIncludeMiningRow(row, options.subtype)) continue
    rows.push(row)
  }

  if (options.sortKey) {
    return sortMiningRows(rows, options.sortKey, options.sortDesc !== false)
  }
  return rows
}
