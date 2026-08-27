import type {
  HubMarketData,
  MiningData,
  MiningItem,
  MiningIphSortKey,
  MiningRankedRow,
  MiningReprocessLine,
  MiningSpaceClass,
  MiningSubtype,
  SkillLevels,
  TimeRange,
  TypeInfo,
} from '@/types'
import { buildWindowPriceMap, pickHistoryWindow } from '@/lib/ranking'
import { reprocessYieldForItem } from '@/lib/miningReprocess'

/**
 * Retriever + 2× Strip Miner I (150 m³ / 45s), Mining/Astrogeology/Mining Barge IV, +10% role.
 * @see https://everef.net/types/17482
 */
export const RETRIEVER_ORE_M3_PER_HR = 42_163

/** Retriever + 2× Ice Harvester I (1000 m³ / 240s), Ice Harvesting IV, −12.5% role duration. */
export const RETRIEVER_ICE_M3_PER_HR = 42_857

/** Venture + Gas Cloud Scoop II, reference gas skills (Retriever cannot harvest gas). */
export const VENTURE_GAS_M3_PER_HR = 9_000

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
export type MiningIphFocusPath = 'compressed' | 'minerals'

export const MINING_IPH_PATHS = {
  compressed: {
    label: 'Compressed ISK/hr',
    shortLabel: 'Compressed',
    tooltip:
      'Same m³/hr, priced as the compressed type. Shows — when compressed hub volume is under 1,000/day.',
  },
  minerals: {
    label: 'Reprocess ISK/hr',
    shortLabel: 'Reprocess',
    tooltip:
      'Reprocess at your yield setting and sell outputs at hub prices. Thin-traded outputs (under 1,000/day) are left out of the total.',
  },
} as const

export const MINING_IPH_PATH_ORDER: MiningIphFocusPath[] = ['compressed', 'minerals']

/** Minimum hub avg daily volume to list an ore (matches Blueprints default minVolume). */
export const MIN_MINING_LIQUIDITY_VOLUME = 100

/** A path needs this much hub volume before we treat its price as real (ISK/hr). */
export const MIN_MINING_PATH_VOLUME = 1_000

export function miningPathVolume(
  path: MiningIphFocusPath | MiningIphSortKey,
  row: MiningRankedRow,
): number {
  switch (path) {
    case 'compressed':
      return row.volDayCompressed ?? 0
    case 'minerals':
      return row.volDayMinerals ?? 0
    default:
      return miningLiquidityVolume(row)
  }
}

export function miningPathHasQuote(path: MiningIphFocusPath, row: MiningRankedRow): boolean {
  switch (path) {
    case 'compressed':
      return row.compressedPrice != null && row.compressedPrice >= 1
    case 'minerals':
      return row.mineralsIph > 0 && row.reprocessLines.some((line) => line.price >= 1)
  }
}

export function miningPathHasPriceData(path: MiningIphFocusPath, row: MiningRankedRow): boolean {
  if (!miningPathHasQuote(path, row)) return false
  if (path === 'minerals') return true
  return miningPathVolume(path, row) >= MIN_MINING_PATH_VOLUME
}

/** Prefer a path that has hub prices; fall back to the requested path. */
export function resolveMiningBreakdownPath(
  row: MiningRankedRow,
  preferred: MiningIphFocusPath,
): MiningIphFocusPath {
  if (miningPathHasPriceData(preferred, row)) return preferred
  return MINING_IPH_PATH_ORDER.find((path) => miningPathHasPriceData(path, row)) ?? preferred
}

/** ISK/hr for table/sort, or null when hub quotes are missing or dust-thin. */
export function miningPathDisplayIph(
  path: MiningIphFocusPath,
  row: MiningRankedRow,
): number | null {
  if (!miningPathHasPriceData(path, row)) return null
  switch (path) {
    case 'compressed':
      return row.compressedIph
    case 'minerals':
      return row.mineralsIph
  }
}

/** Hub liquidity for listing: compressed market when a compressed type exists. */
export function miningLiquidityVolume(row: MiningRankedRow): number {
  if (row.item.compressedTypeId != null) return row.volDayCompressed ?? 0
  return row.volDayRaw ?? 0
}

/** Volume column for the active sort key (does not mutate row.volDay). */
export function miningDisplayVolume(
  row: MiningRankedRow,
  sortKey: MiningIphSortKey,
): number {
  switch (sortKey) {
    case 'compressed':
      return row.volDayCompressed ?? 0
    case 'focus':
      return row.volDayFocus ?? 0
    case 'minerals':
      return row.volDayMinerals ?? 0
    case 'vol':
    default:
      return miningLiquidityVolume(row)
  }
}

const EXCLUDED_MINING_GROUPS = new Set([
  'Fluorite',
  'Kangite',
  'Moissanite',
  'Raspite',
  'Polycrase',
])

/** Event gems, Exordium grades, crystallites — not belt ore rankings. */
export function isExcludedMiningItem(item: MiningItem): boolean {
  if (/Crystallite/i.test(item.name)) return true
  if (/\s(?:0|II|III|IV|X)-Grade$/.test(item.name)) return true
  if (EXCLUDED_MINING_GROUPS.has(item.group)) return true
  return false
}

export function shouldIncludeMiningRow(
  row: MiningRankedRow,
  subtype: MiningSubtype,
): boolean {
  const minVol = MIN_MINING_LIQUIDITY_VOLUME
  const minedLiq = miningLiquidityVolume(row)

  switch (subtype) {
    case 'ore':
    case 'ice':
      if (row.item.compressedTypeId == null) return false
      return (
        (row.volDayCompressed ?? 0) >= minVol && miningPathHasQuote('compressed', row)
      )
    case 'gas':
      if ((row.volDayRaw ?? 0) >= minVol && row.rawPrice >= 1) return true
      return minedLiq >= minVol && miningPathHasQuote('minerals', row)
    case 'moon':
      return minedLiq >= minVol && miningPathHasQuote('minerals', row)
    default:
      return true
  }
}

export function isCompressedMiningName(name: string): boolean {
  return /compress/i.test(name)
}

/** Hub item page type: compressed when the row has a compressed market type. */
export function miningRowMarketTypeId(item: MiningItem): number {
  return item.compressedTypeId ?? item.typeId
}

export function miningRowDisplayName(
  item: MiningItem,
  typeMap: Map<number, TypeInfo>,
): string {
  const compressedId = item.compressedTypeId
  if (compressedId == null) return item.name
  return typeMap.get(compressedId)?.name ?? item.name
}

export function miningRowMatchesNameQuery(
  row: MiningRankedRow,
  query: string,
  typeMap: Map<number, TypeInfo>,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (row.item.name.toLowerCase().includes(q)) return true
  const compressedId = row.item.compressedTypeId
  if (compressedId == null) return false
  const compressedName = typeMap.get(compressedId)?.name ?? ''
  return compressedName.toLowerCase().includes(q)
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

function materialPrice(typeId: number, windowSell: Map<number, number>): number {
  return windowSell.get(typeId) ?? 0
}

/** Raw/compressed sale price; reprocess outputs always use window sell (see materialPrice). */
function productPrice(
  typeId: number,
  windowSell: Map<number, number>,
  buyPrices: Map<number, number> | null,
  priceMethod: 'sell_orders' | 'buy_orders',
): number {
  if (priceMethod === 'buy_orders') {
    return buyPrices?.get(typeId) ?? 0
  }
  return windowSell.get(typeId) ?? 0
}

function avgVolumeOf(hubMarket: HubMarketData, typeId: number, window: TimeRange): number {
  const byWindow = hubMarket.products[String(typeId)]
  if (!byWindow) return 0
  const summary = pickHistoryWindow(byWindow, window, 'avgVolume')
  return summary?.avgVolume ?? 0
}

/** Hub history exists and average daily volume is below the ISK/hr floor. */
function hasThinHubVolume(hubMarket: HubMarketData, typeId: number, window: TimeRange): boolean {
  if (!hubMarket.products[String(typeId)]) return false
  return avgVolumeOf(hubMarket, typeId, window) < MIN_MINING_PATH_VOLUME
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
  windowSell: Map<number, number>,
  typeName: (typeId: number) => string,
  m3PerHr: number,
  yieldFactor: number,
): MiningReprocessLine[] {
  if (!(item.volume > 0) || item.portionSize <= 0 || item.reprocess.length === 0) return []

  const batchesPerM3 = 1 / (item.volume * item.portionSize)
  const lines: MiningReprocessLine[] = []

  for (const mat of item.reprocess) {
    const price = materialPrice(mat.typeId, windowSell)
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
  windowSell: Map<number, number>,
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

  const rawPrice = productPrice(item.typeId, windowSell, buyPrices, priceMethod)
  const rawValuePerM3 = rawPrice > 0 ? rawPrice / item.volume : 0
  const rawIph = Math.round(rawValuePerM3 * opts.m3PerHr)

  let compressedPrice: number | null = null
  let compressedValuePerM3: number | null = null
  let compressedIph: number | null = null
  if (item.compressedTypeId != null) {
    const cPrice = productPrice(item.compressedTypeId, windowSell, buyPrices, priceMethod)
    if (cPrice > 0) {
      compressedPrice = cPrice
      compressedValuePerM3 = cPrice / item.volume
      compressedIph = Math.round(compressedValuePerM3 * opts.m3PerHr)
    }
  }

  const reprocessLines = buildReprocessLines(
    item,
    windowSell,
    typeName,
    opts.m3PerHr,
    opts.reprocessYield,
  )
  const liquidReprocessIph = reprocessLines.reduce((sum, line) => {
    if (line.price < 1) return sum
    if (hasThinHubVolume(hubMarket, line.typeId, window)) return sum
    return sum + line.iskPerHr
  }, 0)
  const mineralsIph = Math.round(liquidReprocessIph)
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
      : 0
  const liquidTopId = topMineralTypeId(
    reprocessLines.filter(
      (line) => line.price >= 1 && !hasThinHubVolume(hubMarket, line.typeId, window),
    ),
  )
  const volMinerals =
    liquidTopId != null
      ? avgVolumeOf(hubMarket, liquidTopId, window)
      : topMineralId != null
        ? avgVolumeOf(hubMarket, topMineralId, window)
        : 0
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
    reprocessYield: opts.reprocessYield,
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
      case 'compressed':
        return miningPathDisplayIph('compressed', row) ?? -1
      case 'minerals':
        return miningPathDisplayIph('minerals', row) ?? -1
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
  /** Hub sell-side window averages (same as Blueprints buildWindowPriceMap). */
  sellPrices?: Map<number, number>
  m3PerHr?: number
  /** Per-ore m³/hr when fleet module choice varies by rock (e.g. Mercoxit needs MDCSM II). */
  m3PerHrForItem?: (item: MiningItem) => number
  /** Hide ores the fleet cannot mine with its selected modules. */
  canMineItem?: (item: MiningItem) => boolean
  /** Character skills for per-row reprocess yield. */
  skills?: Partial<SkillLevels>
  /** Fallback when skills are omitted (legacy flat yield). */
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
  const flatReprocessYield =
    options.reprocessYield ?? mining.defaults.reprocessYield ?? DEFAULT_REPROCESS_YIELD
  const typeName = (typeId: number) => typeMap.get(typeId)?.name ?? `Type ${typeId}`
  const foundFilter = options.foundIn

  const windowSell =
    options.sellPrices ?? buildWindowPriceMap(hubMarket, options.window, spotPrices)

  const rows: MiningRankedRow[] = []
  for (const item of mining.items) {
    if (isCompressedMiningName(item.name)) continue
    if (isExcludedMiningItem(item)) continue
    if (item.subtype !== options.subtype) continue
    if (foundFilter.length > 0 && !foundFilter.every((s) => item.foundIn.includes(s))) continue
    if (options.canMineItem && !options.canMineItem(item)) continue

    const itemReprocessYield = options.skills
      ? reprocessYieldForItem(item, options.skills, flatReprocessYield)
      : flatReprocessYield

    const row = rankMiningItem(
      item,
      hubMarket,
      options.window,
      windowSell,
      buyPrices,
      options.priceMethod,
      typeName,
      {
        m3PerHr: options.m3PerHrForItem?.(item) ?? m3PerHr,
        reprocessYield: itemReprocessYield,
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
