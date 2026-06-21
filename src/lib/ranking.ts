import type {
  BlueprintCostBreakdown,
  BlueprintFilterTier,
  BlueprintInfo,
  BlueprintRegistry,
  CharacterAccount,
  GlobalSettings,
  HubId,
  HubMarketData,
  MarketData,
  ProductWindowSummary,
  IphBreakdown,
  RankedBlueprintRow,
  RegionsData,
  SetupCostBreakdown,
  TimeRange,
  TypeInfo,
} from '@/types'
import {
  amortizedBpoCost,
  applyME,
  applyTE,
  blueprintMeTe,
  estimateJobCost,
  estimateResearchFee,
  inventionBlueprintCostPerRun,
  materialCost,
  revenueFromSale,
} from '@/lib/cost'
import { meetsBuildRequirements } from '@/lib/buildRequirements'
import { buildPriceMap, buildBuyPriceMap, filterBlueprints, getHubMarket } from '@/services/data/sdeLoader'

const TOP_N = 30
/** Rankings assume production up to this many days of average hub volume. */
export const MAX_DAYS_TO_CLEAR = 7

/** CCP placeholder recipes (e.g. Praxis, Gnosis): 1 Tritanium, not player manufacturing. */
export function isPlaceholderManufacturingBlueprint(blueprint: BlueprintInfo): boolean {
  const mats = blueprint.materials
  return mats.length === 1 && mats[0]?.typeId === 34 && mats[0]?.quantity === 1
}

/** Runs capped so output units fit within MAX_DAYS_TO_CLEAR at avg daily volume. */
function runsForMarketVolume(
  batchSize: number,
  productQuantity: number,
  avgVolume: number,
): number | null {
  if (avgVolume <= 0) return batchSize

  const maxRuns = Math.floor((avgVolume * MAX_DAYS_TO_CLEAR) / productQuantity)
  if (maxRuns < 1) return null

  return Math.min(batchSize, maxRuns)
}

export interface RankingFilters {
  minSetupCost: number
  maxSetupCost: number
  buildableOnly: boolean
  account?: CharacterAccount
  tier?: BlueprintFilterTier
  productGroup?: string
  sortBy?: BlueprintSortKey
  sortDirection?: SortDirection
}

export type BlueprintSortKey = 'setupCost' | 'netProfit' | 'iph' | 'margin' | 'avgVolume'
export type SortDirection = 'asc' | 'desc'

export function sortBlueprintRows(
  rows: RankedBlueprintRow[],
  key: BlueprintSortKey,
  direction: SortDirection,
): RankedBlueprintRow[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => factor * (a[key] - b[key]))
}

function haulRouteKey(from: number, to: number): string {
  return `${from}->${to}`
}

function medianValidIskPerM3(haulRates: MarketData['haulRates']): number {
  const rates = Object.values(haulRates)
    .filter((r) => r.valid)
    .map((r) => r.iskPerM3)
    .sort((a, b) => a - b)
  if (!rates.length) return 750
  return rates[Math.floor(rates.length / 2)]!
}

function resolveHaulRate(
  haulRates: MarketData['haulRates'],
  from: number,
  to: number,
): { iskPerM3: number; valid: boolean } | null {
  if (from === to) return { iskPerM3: 0, valid: true }
  const key = haulRouteKey(from, to)
  const rate = haulRates[key]
  if (rate?.valid) return { iskPerM3: rate.iskPerM3, valid: true }
  if (rate && !rate.valid) return null
  return { iskPerM3: medianValidIskPerM3(haulRates), valid: true }
}

function meetsSkillRequirements(blueprint: BlueprintInfo, account?: CharacterAccount): boolean {
  return meetsBuildRequirements(blueprint, account)
}

function hasValidPrices(
  blueprint: BlueprintInfo,
  spotPrices: Map<number, number>,
  windowPrices: Map<number, number>,
  avgPrice: number,
  settings: GlobalSettings,
  buyPrices: Map<number, number>,
  hubMarket: HubMarketData,
  window: TimeRange,
): boolean {
  const priceMethod = settings.priceMethod
  if (settings.includeBlueprintCost) {
    if (blueprint.tier === 't2') {
      // T2 has no BPO market: needs invention data and datacore prices instead.
      if (!blueprint.invention) return false
      for (const d of blueprint.invention.datacores) {
        if ((windowPrices.get(d.typeId) ?? 0) <= 0) return false
      }
    } else if (resolveBpoUnitPrice(blueprint.blueprintTypeId, hubMarket, spotPrices, window) <= 0) {
      return false
    }
  }
  if (priceMethod === 'buy_orders') {
    if ((buyPrices.get(blueprint.productTypeId) ?? 0) <= 0) return false
  } else {
    if (!avgPrice || avgPrice <= 0) return false
    if ((spotPrices.get(blueprint.productTypeId) ?? 0) <= 0) return false
  }
  for (const mat of blueprint.materials) {
    if ((windowPrices.get(mat.typeId) ?? 0) <= 0) return false
  }
  return true
}

function buildWindowPriceMap(
  hubMarket: HubMarketData,
  window: TimeRange,
  spot: Map<number, number>,
): Map<number, number> {
  const map = new Map(spot)
  for (const [key, byWindow] of Object.entries(hubMarket.products)) {
    const summary = pickHistoryWindow(byWindow, window)
    if (summary?.avgPrice && summary.avgPrice > 0) map.set(Number(key), summary.avgPrice)
  }
  return map
}

function computeMaterialVolume(
  mats: { typeId: number; quantity: number }[],
  typeVolumes: Map<number, number>,
): number {
  return mats.reduce((sum, m) => sum + m.quantity * (typeVolumes.get(m.typeId) ?? 0), 0)
}

const WIDER_WINDOWS: Record<TimeRange, TimeRange[]> = {
  '1d': ['1w', '1m', '1y', 'all'],
  '1w': ['1m', '1y', 'all'],
  '1m': ['1y', 'all'],
  '1y': ['all'],
  all: [],
}

type WindowMetric = 'price' | 'volume'

function pickHistoryWindow(
  productHistory: Partial<Record<TimeRange, ProductWindowSummary>>,
  window: TimeRange,
  metric: WindowMetric = 'price',
): ProductWindowSummary | null {
  const tryWindow = (w: TimeRange) => {
    const summary = productHistory[w]
    if (!summary) return null
    if (metric === 'volume') return summary.avgVolume > 0 ? summary : null
    return summary.avgPrice > 0 ? summary : null
  }

  const exact = tryWindow(window)
  if (exact) return exact

  for (const wider of WIDER_WINDOWS[window]) {
    const summary = tryWindow(wider)
    if (summary) return summary
  }

  return null
}

function resolveWindowSummary(
  hubMarket: HubMarketData,
  productTypeId: number,
  window: TimeRange,
  prices: Map<number, number>,
): ProductWindowSummary | null {
  const productHistory = hubMarket.products[String(productTypeId)]
  if (productHistory) {
    const priceWindow = pickHistoryWindow(productHistory, window, 'price')
    if (!priceWindow) return null

    const volumeWindow = pickHistoryWindow(productHistory, window, 'volume')
    return {
      avgPrice: priceWindow.avgPrice,
      avgVolume: volumeWindow?.avgVolume ?? 0,
      high: priceWindow.high,
      low: priceWindow.low,
    }
  }

  // No batch history: spot price only applies to "all" (current sell orders).
  if (window !== 'all') return null

  const spot = prices.get(productTypeId) ?? 0
  if (spot <= 0) return null

  return { avgPrice: spot, avgVolume: 0, high: spot, low: spot }
}

/** Hub sell order for a BPO, then window average from BPO market history when spot is missing. */
function resolveBpoUnitPrice(
  blueprintTypeId: number,
  hubMarket: HubMarketData,
  spotPrices: Map<number, number>,
  window: TimeRange,
): number {
  const spot = spotPrices.get(blueprintTypeId) ?? 0
  if (spot > 0) return spot

  const bpoHistory = hubMarket.products[String(blueprintTypeId)]
  if (!bpoHistory) return 0

  const fromWindow = pickHistoryWindow(bpoHistory, window, 'price')
  if (fromWindow?.avgPrice && fromWindow.avgPrice > 0) return fromWindow.avgPrice

  const fromAll = pickHistoryWindow(bpoHistory, 'all', 'price')
  if (fromAll?.avgPrice && fromAll.avgPrice > 0) return fromAll.avgPrice

  return 0
}

/** Charged (into profit) and upfront (real cash) blueprint cost for one batch, tier-aware. */
function computeBlueprintCost(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  hubMarket: HubMarketData,
  spotPrices: Map<number, number>,
  windowPrices: Map<number, number>,
  regionCostIndex: number,
  runs: number,
  window: TimeRange,
): { charged: number; upfront: number; bpoUnitPrice: number; breakdown: BlueprintCostBreakdown } {
  const include = settings.includeBlueprintCost

  if (blueprint.tier === 't2' && blueprint.invention) {
    const inv = blueprint.invention
    const r = inventionBlueprintCostPerRun({
      datacores: inv.datacores,
      prices: windowPrices,
      baseChance: inv.baseChance,
      runsPerBPC: inv.runsPerBPC,
      skillLevel: settings.inventionSkillLevel,
    })
    const charged = include && Number.isFinite(r.costPerRun) ? r.costPerRun * runs : 0
    return {
      charged,
      upfront: charged,
      bpoUnitPrice: 0,
      breakdown: {
        mode: 'invention',
        charged,
        upfront: charged,
        datacoreCost: r.datacoreCost,
        inventionChance: r.chance,
        runsPerBPC: inv.runsPerBPC,
        expectedRunsPerAttempt: r.expectedRunsPerAttempt,
        costPerRun: r.costPerRun,
      },
    }
  }

  const bpoUnitPrice = resolveBpoUnitPrice(blueprint.blueprintTypeId, hubMarket, spotPrices, window)
  const baseRunMaterialValue = materialCost(blueprint.materials, windowPrices)
  const researchFee = estimateResearchFee(baseRunMaterialValue, regionCostIndex)
  const charged = include
    ? amortizedBpoCost(bpoUnitPrice, researchFee, settings.blueprintLifetimeRuns, runs)
    : 0
  const upfront = include ? bpoUnitPrice : 0
  return {
    charged,
    upfront,
    bpoUnitPrice,
    breakdown: {
      mode: 'bpo',
      charged,
      upfront,
      bpoUnitPrice,
      researchFee,
      lifetimeRuns: settings.blueprintLifetimeRuns,
    },
  }
}

function computeRow(
  blueprint: BlueprintInfo,
  product: TypeInfo,
  windowSummary: ProductWindowSummary,
  spotPrices: Map<number, number>,
  windowPrices: Map<number, number>,
  buyPrices: Map<number, number>,
  settings: GlobalSettings,
  regionCostIndex: number,
  haulInIskPerM3: number,
  haulOutIskPerM3: number,
  typeVolumes: Map<number, number>,
  hubMarket: HubMarketData,
  window: TimeRange,
): RankedBlueprintRow | null {
  if (
    !hasValidPrices(
      blueprint,
      spotPrices,
      windowPrices,
      windowSummary.avgPrice,
      settings,
      buyPrices,
      hubMarket,
      window,
    )
  ) {
    return null
  }

  const avgVolume = windowSummary.avgVolume
  const runs = runsForMarketVolume(settings.batchSize, blueprint.productQuantity, avgVolume)
  if (runs === null) return null

  const { me, te } = blueprintMeTe(blueprint.tier, settings)
  const mats = applyME(blueprint.materials, me, runs)
  const matCost = materialCost(mats, windowPrices)
  const jobCost = estimateJobCost(matCost, regionCostIndex)
  const outputQty = blueprint.productQuantity * runs
  const materialVolume = computeMaterialVolume(mats, typeVolumes)
  const productVolume = (typeVolumes.get(blueprint.productTypeId) ?? product.volume) * outputQty
  const haulIn = materialVolume * haulInIskPerM3
  const haulOut = productVolume * haulOutIskPerM3
  const operatingCost = matCost + jobCost + haulIn
  const blueprintCostResult = computeBlueprintCost(
    blueprint,
    settings,
    hubMarket,
    spotPrices,
    windowPrices,
    regionCostIndex,
    runs,
    window,
  )
  const blueprintCost = blueprintCostResult.breakdown
  const bpoUnitPrice = blueprintCostResult.bpoUnitPrice
  const bpoCost = blueprintCostResult.charged
  const setupCost = operatingCost + blueprintCostResult.charged
  const upfrontCapital = operatingCost + blueprintCostResult.upfront

  const baseQtyByType = new Map(blueprint.materials.map((m) => [m.typeId, m.quantity]))
  const setupBreakdown: SetupCostBreakdown = {
    batchSizeSetting: settings.batchSize,
    productQuantity: blueprint.productQuantity,
    avgVolume,
    volumeCapDays: MAX_DAYS_TO_CLEAR,
    runs,
    outputQty,
    me,
    materials: mats.map((m) => {
      const unitPrice = windowPrices.get(m.typeId) ?? 0
      const unitVolumeM3 = typeVolumes.get(m.typeId) ?? 0
      return {
        typeId: m.typeId,
        baseQtyPerRun: baseQtyByType.get(m.typeId) ?? m.quantity,
        quantity: m.quantity,
        unitPrice,
        lineTotal: unitPrice * m.quantity,
        unitVolumeM3,
        lineVolumeM3: unitVolumeM3 * m.quantity,
      }
    }),
    materialCost: matCost,
    systemCostIndex: regionCostIndex,
    jobCost,
    bpoTypeId: blueprint.blueprintTypeId,
    bpoUnitPrice,
    bpoCost,
    blueprintCost,
    upfrontCapital,
    materialVolumeM3: materialVolume,
    haulInIskPerM3,
    haulIn,
    setupCost,
  }
  const advancedIndustry = 0
  const sellPricePerUnit =
    settings.priceMethod === 'buy_orders'
      ? (buyPrices.get(blueprint.productTypeId) ?? 0)
      : windowSummary.avgPrice
  const revenueSettings =
    settings.priceMethod === 'buy_orders'
      ? { ...settings, brokerFeePercent: 0 }
      : settings
  const {
    gross: grossRevenue,
    net: netRevenue,
    brokerFee,
    salesTax,
  } = revenueFromSale(sellPricePerUnit, outputQty, revenueSettings)
  const netProfit = netRevenue - setupCost - haulOut
  const margin = setupCost > 0 ? (netProfit / setupCost) * 100 : 0
  const baseTimePerRunSeconds = blueprint.manufacturingTime
  const teTimeFactor = 1 - te * 0.04
  const advancedIndustryTimeFactor = 1 - advancedIndustry * 0.03
  const jobTimeSeconds = applyTE(baseTimePerRunSeconds, te, runs, advancedIndustry)
  const jobHours = jobTimeSeconds / 3600
  const daysToClear = avgVolume > 0 ? outputQty / avgVolume : Infinity
  const { iph, marketShare, competitionFactor } = marketAwareIph(
    netProfit,
    outputQty,
    jobHours,
    avgVolume,
  )
  const profitPerUnit = outputQty > 0 ? netProfit / outputQty : 0
  const productionPerDay = jobHours > 0 ? (outputQty * 24) / jobHours : 0
  const sellablePerDay =
    avgVolume > 0 ? Math.min(productionPerDay, avgVolume) : productionPerDay
  const realizedDailyProfit = sellablePerDay * profitPerUnit * competitionFactor
  const iphBreakdown: IphBreakdown = {
    me,
    te,
    advancedIndustry,
    batchSizeSetting: settings.batchSize,
    productQuantity: blueprint.productQuantity,
    avgVolume,
    volumeCapDays: MAX_DAYS_TO_CLEAR,
    runs,
    outputQty,
    baseTimePerRunSeconds,
    teTimeFactor,
    advancedIndustryTimeFactor,
    jobTimeSeconds,
    sellPricePerUnit,
    priceMethod: settings.priceMethod,
    grossRevenue,
    brokerFeePercent: revenueSettings.brokerFeePercent,
    brokerFee,
    salesTaxPercent: settings.salesTaxPercent,
    salesTax,
    netRevenue,
    materialCost: matCost,
    systemCostIndex: regionCostIndex,
    jobCost,
    bpoTypeId: blueprint.blueprintTypeId,
    bpoUnitPrice,
    bpoCost,
    blueprintCost,
    upfrontCapital,
    materialVolumeM3: materialVolume,
    haulInIskPerM3,
    haulIn,
    productVolumeM3: productVolume,
    haulOutIskPerM3,
    haulOut,
    setupCost,
    netProfit,
    profitPerUnit,
    productionPerDay,
    sellablePerDay,
    marketShare,
    competitionFactor,
    realizedDailyProfit,
    iph,
  }
  const volatility =
    windowSummary.avgPrice > 0
      ? (windowSummary.high - windowSummary.low) / windowSummary.avgPrice
      : 0

  return {
    blueprint,
    product,
    setupCost,
    upfrontCapital,
    setupBreakdown,
    iphBreakdown,
    haulIn,
    haulOut,
    capital: setupCost,
    netProfit,
    margin,
    iph,
    avgVolume,
    daysToClear,
    volatility,
    jobTimeSeconds,
    marketShare,
    competitionFactor,
  }
}

/** Realized ISK/hr from min(production/day, market volume/day) × profit/unit, with market-share penalty. */
export function marketAwareIph(
  netProfit: number,
  outputQty: number,
  jobHours: number,
  avgVolume: number,
): { iph: number; marketShare: number; competitionFactor: number } {
  const profitPerUnit = outputQty > 0 ? netProfit / outputQty : 0
  const productionPerDay = jobHours > 0 ? (outputQty * 24) / jobHours : 0
  const sellablePerDay =
    avgVolume > 0 ? Math.min(productionPerDay, avgVolume) : productionPerDay
  const marketShare =
    avgVolume > 0 && productionPerDay > 0 ? productionPerDay / avgVolume : 0
  const competitionFactor = 1 / (1 + marketShare)
  const realizedDailyProfit = sellablePerDay * profitPerUnit * competitionFactor
  const iph = realizedDailyProfit / 24
  return { iph, marketShare, competitionFactor }
}

export function rankBlueprintsFromMarket(
  registry: BlueprintRegistry,
  market: MarketData,
  regions: RegionsData,
  typeMap: Map<number, TypeInfo>,
  hub: HubId,
  window: TimeRange,
  settings: GlobalSettings,
  filters: RankingFilters,
): RankedBlueprintRow[] {
  const hubMarket = getHubMarket(market, hub)
  if (!hubMarket) return []

  const region =
    regions.regions.find((r) => r.regionId === settings.manufacturingRegionId) ??
    regions.regions.find((r) => r.regionId === hubMarket.regionId)
  if (!region) return []

  const spotPrices = buildPriceMap(hubMarket)
  const buyPrices = buildBuyPriceMap(hubMarket)
  const windowPrices = buildWindowPriceMap(hubMarket, window, spotPrices)
  const marketSystemId = hubMarket.marketSystemId
  const buildSystemId = region.buildSystemId
  const haulIn = resolveHaulRate(market.haulRates, marketSystemId, buildSystemId)
  const haulOut = resolveHaulRate(market.haulRates, buildSystemId, marketSystemId)
  if (!haulIn || !haulOut) return []

  const typeVolumes = new Map<number, number>()
  for (const [id, type] of typeMap) {
    typeVolumes.set(id, type.volume)
  }

  const tier = filters.tier ?? 'all'
  const blueprints = filterBlueprints(registry.blueprints, tier, filters.productGroup)

  const rows: RankedBlueprintRow[] = []
  for (const bp of blueprints) {
    if (isPlaceholderManufacturingBlueprint(bp)) continue

    const product = typeMap.get(bp.productTypeId)
    if (!product) continue

    let summary = resolveWindowSummary(hubMarket, bp.productTypeId, window, spotPrices)
    if (
      !summary &&
      settings.priceMethod === 'buy_orders' &&
      (buyPrices.get(bp.productTypeId) ?? 0) > 0
    ) {
      summary = { avgPrice: 0, avgVolume: 0, high: 0, low: 0 }
    }
    if (!summary) continue

    const row = computeRow(
      bp,
      product,
      summary,
      spotPrices,
      windowPrices,
      buyPrices,
      settings,
      region.costIndex,
      haulIn.iskPerM3,
      haulOut.iskPerM3,
      typeVolumes,
      hubMarket,
      window,
    )
    if (!row) continue
    if (row.upfrontCapital < filters.minSetupCost) continue
    if (row.upfrontCapital > filters.maxSetupCost) continue
    if (filters.buildableOnly && !meetsSkillRequirements(bp, filters.account)) continue
    rows.push(row)
  }

  const sortBy = filters.sortBy ?? 'iph'
  const sortDirection = filters.sortDirection ?? 'desc'

  return sortBlueprintRows(rows, sortBy, sortDirection).slice(0, TOP_N)
}

export function defaultMinSetupCost(): number {
  return SETUP_BUDGET_MIN
}

export function defaultMaxSetupCost(): number {
  return 100_000_000
}

/** Setup budget slider: 0 ISK at step 0, then log scale from 1 ISK to 500B. */
export const SETUP_BUDGET_MIN = 0
export const SETUP_BUDGET_MAX = 500_000_000_000
export const SETUP_BUDGET_SLIDER_STEPS = 1000
const SETUP_BUDGET_LOG_MIN = 1

export function setupBudgetFromSlider(slider: number): number {
  if (slider <= 0) return 0
  const t = Math.min(1, Math.max(0, (slider - 1) / (SETUP_BUDGET_SLIDER_STEPS - 1)))
  const logMin = Math.log(SETUP_BUDGET_LOG_MIN)
  const logMax = Math.log(SETUP_BUDGET_MAX)
  return Math.round(Math.exp(logMin + t * (logMax - logMin)))
}

export function setupBudgetToSlider(value: number): number {
  const clamped = clampSetupBudget(value)
  if (clamped <= 0) return 0
  const logMin = Math.log(SETUP_BUDGET_LOG_MIN)
  const logMax = Math.log(SETUP_BUDGET_MAX)
  const t = (Math.log(Math.max(clamped, SETUP_BUDGET_LOG_MIN)) - logMin) / (logMax - logMin)
  return Math.round(1 + t * (SETUP_BUDGET_SLIDER_STEPS - 1))
}

export function clampSetupBudget(value: number): number {
  return Math.min(SETUP_BUDGET_MAX, Math.max(SETUP_BUDGET_MIN, Math.round(value)))
}
