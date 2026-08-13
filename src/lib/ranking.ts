import type {
  BlueprintTier,
  BlueprintInfo,
  BlueprintRegistry,
  ContractsData,
  ManufacturingSettings,
  HubId,
  HubMarketData,
  MarketData,
  ProductWindowSummary,
  IphBreakdown,
  RankedBlueprintRow,
  RegionsData,
  SystemInfo,
  TimeRange,
  TypeInfo,
} from '@/types'
import { MAX_BATCH_SIZE, MIN_BATCH_SIZE } from '@/types'
import {
  advancedIndustryTimeFactor,
  applyReactionTime,
  applyTE,
  blueprintMeTe,
  industryTimeFactor,
  reactionsTimeFactor,
  revenueFromSale,
  teTimeFactor,
} from '@/lib/cost'
import { resolveRecipeModifiers } from '@/lib/facilityModifiers'
import { isReactionRecipe } from '@/lib/recipes'
import { computeFlatSetup, type PriceContext } from '@/lib/blueprintEconomics'
import { meetsBuildRequirements } from '@/lib/buildRequirements'
import { skillLevel } from '@/lib/skillFields'
import { tradingFeeRates } from '@/lib/tradingFees'
import { WIDER_TIME_RANGES } from '@/lib/profit'
import {
  buildPriceMap,
  buildBuyPriceMap,
  filterBlueprints,
  getHubMarket,
  isRankableBlueprint,
  resolveBuildSystem,
} from '@/services/data/sdeLoader'

export const TOP_N = 50
/** Rankings assume production up to this many days of average hub volume. */
export const MAX_DAYS_TO_CLEAR = 7

/** CCP placeholder recipes (e.g. Praxis, Gnosis): 1 Tritanium, not player manufacturing. */
export function isPlaceholderManufacturingBlueprint(blueprint: BlueprintInfo): boolean {
  const mats = blueprint.materials
  return mats.length === 1 && mats[0]?.typeId === 34 && mats[0]?.quantity === 1
}

/** Runs for setup cost and profit from the batch-size filter (clamped to allowed range). */
export function resolveRankingRuns(
  batchSize: number,
  productQuantity: number,
  avgVolume: number,
): number | null {
  if (!Number.isFinite(batchSize)) return null
  const runs = Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, Math.round(batchSize)))
  if (avgVolume <= 0) return runs

  const maxMarketRuns = Math.floor((avgVolume * MAX_DAYS_TO_CLEAR) / productQuantity)
  if (maxMarketRuns < 1) return null

  return runs
}

export interface RankingFilters {
  minSetupCost: number
  maxSetupCost: number
  buildableOnly: boolean
  /** When false, haul in/out are excluded from setup and profit. Defaults to true. */
  includeHaulCost?: boolean
  /**
   * When true, hide T1 rows with no market BPO and no public BPC (including charges).
   * Defaults to false for callers; the Blueprints page defaults this on in the query UI.
   */
  requireBlueprintPrice?: boolean
  tiers?: BlueprintTier[]
  productGroups?: string[]
  /** Rank only these product type IDs (ignores tier/group filters). */
  productTypeIds?: number[]
  /** When false, reaction formulas are excluded. Defaults to true. */
  includeFormulas?: boolean
  /** Minimum avg daily hub volume (0 = no filter). Uses the same window as price. */
  minVolume?: number
  sortBy?: BlueprintSortKey
  sortDirection?: SortDirection
  /** Max rows returned; defaults to TOP_N. */
  limit?: number
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

/** Buy-hub → factory and factory → sell-hub haul rates. */
export function resolveHubHaulRates(
  haulRates: MarketData['haulRates'],
  buyMarketSystemId: number,
  buildSystemId: number,
  sellMarketSystemId: number = buyMarketSystemId,
): { haulInIskPerM3: number; haulOutIskPerM3: number } {
  const haulInRate = resolveHaulRate(haulRates, buyMarketSystemId, buildSystemId)
  const haulOutRate = resolveHaulRate(haulRates, buildSystemId, sellMarketSystemId)
  const haulFallback = medianValidIskPerM3(haulRates)
  return {
    haulInIskPerM3: haulInRate?.iskPerM3 ?? haulFallback,
    haulOutIskPerM3: haulOutRate?.iskPerM3 ?? haulFallback,
  }
}

function hasValidPrices(
  blueprint: BlueprintInfo,
  materialWindowPrices: Map<number, number>,
  productSellPrice: number,
  settings: ManufacturingSettings,
  productBuyPrices: Map<number, number>,
): boolean {
  const priceMethod = settings.priceMethod
  if (settings.includeBlueprintCost && blueprint.tier === 't2') {
    // T2 has no BPO market: needs invention data and datacore prices instead.
    if (!blueprint.invention) return false
    for (const d of blueprint.invention.datacores) {
      if ((materialWindowPrices.get(d.typeId) ?? 0) <= 0) return false
    }
  }
  if (priceMethod === 'buy_orders') {
    if ((productBuyPrices.get(blueprint.productTypeId) ?? 0) <= 0) return false
  } else if (!productSellPrice || productSellPrice <= 0) {
    return false
  }
  for (const mat of blueprint.materials) {
    if ((materialWindowPrices.get(mat.typeId) ?? 0) <= 0) return false
  }
  return true
}

export function buildWindowPriceMap(
  hubMarket: HubMarketData,
  window: TimeRange,
  spot: Map<number, number>,
): Map<number, number> {
  const map = new Map(spot)
  // "All" = current sell orders (spot). All-time history only fills types with no listing.
  if (window === 'all') {
    for (const [key, byWindow] of Object.entries(hubMarket.products)) {
      const typeId = Number(key)
      if ((map.get(typeId) ?? 0) > 0) continue
      const summary = byWindow.all
      if (summary?.avgPrice && summary.avgPrice > 0) map.set(typeId, summary.avgPrice)
    }
    return map
  }
  for (const [key, byWindow] of Object.entries(hubMarket.products)) {
    const summary = pickHistoryWindow(byWindow, window)
    if (summary?.avgPrice && summary.avgPrice > 0) map.set(Number(key), summary.avgPrice)
  }
  return map
}

export function pickHistoryWindow(
  productHistory: Partial<Record<TimeRange, ProductWindowSummary>>,
  window: TimeRange,
  field: 'avgPrice' | 'avgVolume' = 'avgPrice',
): ProductWindowSummary | null {
  const tryWindow = (w: TimeRange) => {
    const summary = productHistory[w]
    if (!summary) return null
    const value = field === 'avgVolume' ? summary.avgVolume : summary.avgPrice
    return value != null && value > 0 ? summary : null
  }

  const exact = tryWindow(window)
  if (exact) return exact

  for (const wider of WIDER_TIME_RANGES[window]) {
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
  const spot = prices.get(productTypeId) ?? 0

  if (window === 'all' && spot > 0) {
    const hist = productHistory?.all
    return {
      avgPrice: spot,
      avgVolume: hist?.avgVolume ?? 0,
      high: spot,
      low: spot,
    }
  }

  if (productHistory) {
    const windowSummary = pickHistoryWindow(productHistory, window)
    if (!windowSummary) return null

    return {
      avgPrice: windowSummary.avgPrice,
      avgVolume: windowSummary.avgVolume ?? 0,
      high: windowSummary.high,
      low: windowSummary.low,
    }
  }

  // No batch history: spot price only applies to "all" (current sell orders).
  if (window !== 'all') return null
  if (spot <= 0) return null

  return { avgPrice: spot, avgVolume: 0, high: spot, low: spot }
}

/**
 * Charges (ammo, scripts, etc.) are produced in huge quantities from a single
 * cheap, effectively reusable BPO, so amortizing its purchase price per batch
 * is noise. We skip the BPO cost for these products.
 */
export function isChargeProduct(category: string | undefined): boolean {
  return category === 'Charge'
}

function computeRow(
  blueprint: BlueprintInfo,
  product: TypeInfo,
  windowSummary: ProductWindowSummary,
  buySpotPrices: Map<number, number>,
  materialWindowPrices: Map<number, number>,
  productBuyPrices: Map<number, number>,
  settings: ManufacturingSettings,
  regionCostIndex: number,
  reactionCostIndex: number,
  haulInIskPerM3: number,
  haulOutIskPerM3: number,
  includeHaulCost: boolean,
  typeVolumes: Map<number, number>,
  buyHubMarket: HubMarketData,
  jitaHubMarket: HubMarketData | null,
  jitaSpotPrices: Map<number, number>,
  buyHub: HubId,
  window: TimeRange,
  advancedIndustry: number,
  feeRates: ReturnType<typeof tradingFeeRates>,
  contracts: ContractsData | null | undefined,
): RankedBlueprintRow | null {
  if (
    !hasValidPrices(
      blueprint,
      materialWindowPrices,
      windowSummary.avgPrice,
      settings,
      productBuyPrices,
    )
  ) {
    return null
  }

  const avgVolume = windowSummary.avgVolume
  const runs = resolveRankingRuns(settings.batchSize, blueprint.productQuantity, avgVolume)
  if (runs === null) return null

  const { me, te } = blueprintMeTe(blueprint.tier, settings, blueprint)
  const structure = resolveRecipeModifiers(settings, blueprint)
  const industry = skillLevel(settings.skills, 'industry')

  const priceCtx: PriceContext = {
    hubId: buyHub,
    window,
    spotSell: buySpotPrices,
    buyOrders: productBuyPrices,
    windowSell: materialWindowPrices,
    priceMethod: settings.priceMethod,
  }

  const flat = computeFlatSetup({
    blueprint,
    product,
    settings,
    runs,
    prices: materialWindowPrices,
    systemCostIndex: regionCostIndex,
    reactionCostIndex,
    hubId: buyHub,
    hubMarket: buyHubMarket,
    jitaHubMarket,
    spotPrices: buySpotPrices,
    jitaSpotPrices,
    contracts,
    priceCtx,
    haulInIskPerM3,
    haulOutIskPerM3,
    includeHaulCost,
    typeVolumes,
    avgVolume,
    volumeCapDays: MAX_DAYS_TO_CLEAR,
  })

  // Non-charge T1 with blueprint cost on: missing BPO/BPC is not rankable.
  // Charges (and includeBlueprintCost off) may still rank unless requireBlueprintPrice is set.
  if (
    flat.setup.blueprintCost.bpoPriceMissing &&
    settings.includeBlueprintCost &&
    !flat.setup.blueprintCost.chargeExcluded
  ) {
    return null
  }

  const setupBreakdown = flat.setup
  const {
    materialCost: matCost,
    estimatedItemValue: eiv,
    systemCostIndex: jobCostIndex,
    jobCost,
    facilityBonus,
    bpoUnitPrice,
    bpoCost,
    blueprintCost,
    upfrontCapital,
    materialVolumeM3: materialVolume,
    haulIn,
    haulExcluded,
    setupCost,
    outputQty,
  } = setupBreakdown
  const haulOut = flat.haulOut
  const productVolume = flat.productVolumeM3

  const sellPricePerUnit =
    settings.priceMethod === 'buy_orders'
      ? (productBuyPrices.get(blueprint.productTypeId) ?? 0)
      : windowSummary.avgPrice
  const usesBuyOrders = settings.priceMethod === 'buy_orders'
  const {
    gross: grossRevenue,
    net: netRevenue,
    brokerFee,
    salesTax,
  } = revenueFromSale(sellPricePerUnit, outputQty, feeRates, {
    includeBrokerFee: !usesBuyOrders,
  })
  const netProfit = netRevenue - setupCost - haulOut
  const margin = setupCost > 0 ? (netProfit / setupCost) * 100 : 0
  const baseTimePerRunSeconds = blueprint.manufacturingTime
  const isReaction = isReactionRecipe(blueprint)
  const reactionsSkill = skillLevel(settings.skills, 'reactions')
  const teFactor = isReaction ? 1 : teTimeFactor(te)
  const industryFactor = isReaction ? 1 : industryTimeFactor(industry)
  const structureTeFactor = 1 - structure.teBonusPercent / 100
  const advancedIndustryFactor = isReaction ? 1 : advancedIndustryTimeFactor(advancedIndustry)
  const reactionsFactor = reactionsTimeFactor(reactionsSkill)
  const jobTimeSeconds = isReaction
    ? applyReactionTime(
        baseTimePerRunSeconds,
        runs,
        reactionsSkill,
        structure.teBonusPercent,
      )
    : applyTE(
        baseTimePerRunSeconds,
        te,
        runs,
        industry,
        advancedIndustry,
        structure.teBonusPercent,
      )
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
    te: isReaction ? 0 : te,
    industry: isReaction ? 0 : industry,
    advancedIndustry: isReaction ? 0 : advancedIndustry,
    ...(isReaction
      ? { reactions: reactionsSkill, reactionsTimeFactor: reactionsFactor }
      : {}),
    batchSizeSetting: settings.batchSize,
    productQuantity: blueprint.productQuantity,
    avgVolume,
    volumeCapDays: MAX_DAYS_TO_CLEAR,
    runs,
    outputQty,
    baseTimePerRunSeconds,
    teTimeFactor: teFactor,
    industryTimeFactor: industryFactor,
    structureTeTimeFactor: structureTeFactor,
    advancedIndustryTimeFactor: advancedIndustryFactor,
    jobTimeSeconds,
    sellPricePerUnit,
    priceMethod: settings.priceMethod,
    grossRevenue,
    brokerFeePercent: usesBuyOrders ? 0 : feeRates.brokerFeePercent,
    brokerFee,
    salesTaxPercent: feeRates.salesTaxPercent,
    salesTax,
    netRevenue,
    materialCost: matCost,
    estimatedItemValue: eiv,
    systemCostIndex: jobCostIndex,
    structureType: settings.structureType,
    structureMeBonusPercent: structure.meBonusPercent,
    structureTeBonusPercent: structure.teBonusPercent,
    structureJobCostBonusPercent: structure.jobCostBonusPercent,
    structureTaxPercent: structure.taxPercent,
    facilityBonus,
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
    haulExcluded: haulExcluded || undefined,
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
  settings: ManufacturingSettings,
  filters: RankingFilters,
  systems: SystemInfo[] = [],
  contracts: ContractsData | null | undefined = null,
): RankedBlueprintRow[] {
  const buyHubMarket = getHubMarket(market, hub)
  if (!buyHubMarket) return []

  const jitaHubMarket = hub === 'jita' ? buyHubMarket : getHubMarket(market, 'jita')
  const jitaSpotPrices = jitaHubMarket ? buildPriceMap(jitaHubMarket) : new Map<number, number>()

  const sellHubId = settings.sellHubId ?? hub
  const sellHubMarket = getHubMarket(market, sellHubId) ?? buyHubMarket

  const { buildSystemId, costIndex: resolvedCostIndex, reactionCostIndex: resolvedReactionIndex } =
    resolveBuildSystem(systems, regions, buyHubMarket, settings.manufacturingSystemId)
  const reactionCostIndex =
    typeof resolvedReactionIndex === 'number' ? resolvedReactionIndex : resolvedCostIndex

  const buySpotPrices = buildPriceMap(buyHubMarket)
  const materialWindowPrices = buildWindowPriceMap(buyHubMarket, window, buySpotPrices)
  const productBuyPrices = buildBuyPriceMap(sellHubMarket)
  const sellSpotPrices = buildPriceMap(sellHubMarket)
  const buyMarketSystemId = buyHubMarket.marketSystemId
  const sellMarketSystemId = sellHubMarket.marketSystemId
  const includeHaulCost = filters.includeHaulCost ?? settings.includeHaulCost ?? true
  const { haulInIskPerM3, haulOutIskPerM3 } = resolveHubHaulRates(
    market.haulRates,
    buyMarketSystemId,
    buildSystemId,
    sellMarketSystemId,
  )

  const typeVolumes = new Map<number, number>()
  for (const [id, type] of typeMap) {
    typeVolumes.set(id, type.volume)
  }

  const tiers = filters.tiers ?? []
  const includeFormulas = filters.includeFormulas ?? true
  const productTypeFilter =
    filters.productTypeIds && filters.productTypeIds.length > 0
      ? new Set(filters.productTypeIds)
      : null
  const blueprints = productTypeFilter
    ? registry.blueprints.filter((bp) => productTypeFilter.has(bp.productTypeId))
    : filterBlueprints(registry.blueprints, tiers, filters.productGroups, {
        includeReactions: includeFormulas,
      })
  const advancedIndustry = skillLevel(settings.skills, 'advancedIndustry')
  const feeRates = tradingFeeRates(
    skillLevel(settings.skills, 'accounting'),
    skillLevel(settings.skills, 'brokerRelations'),
  )

  const rows: RankedBlueprintRow[] = []
  for (const bp of blueprints) {
    if (isPlaceholderManufacturingBlueprint(bp)) continue
    if (!isRankableBlueprint(bp, typeMap, { includeFormulas })) continue

    const product = typeMap.get(bp.productTypeId)!

    let summary = resolveWindowSummary(sellHubMarket, bp.productTypeId, window, sellSpotPrices)
    if (
      !summary &&
      settings.priceMethod === 'buy_orders' &&
      (productBuyPrices.get(bp.productTypeId) ?? 0) > 0
    ) {
      summary = { avgPrice: 0, avgVolume: 0, high: 0, low: 0 }
    }
    if (!summary) continue

    const row = computeRow(
      bp,
      product,
      summary,
      buySpotPrices,
      materialWindowPrices,
      productBuyPrices,
      settings,
      resolvedCostIndex,
      reactionCostIndex,
      haulInIskPerM3,
      haulOutIskPerM3,
      includeHaulCost,
      typeVolumes,
      buyHubMarket,
      jitaHubMarket,
      jitaSpotPrices,
      hub,
      window,
      advancedIndustry,
      feeRates,
      contracts,
    )
    if (!row) continue
    if (row.upfrontCapital < filters.minSetupCost) continue
    if (
      Number.isFinite(filters.maxSetupCost) &&
      row.upfrontCapital > filters.maxSetupCost
    ) {
      continue
    }
    if ((filters.minVolume ?? 0) > 0 && row.avgVolume < filters.minVolume!) continue
    if (filters.buildableOnly && !meetsBuildRequirements(bp, settings.skills)) continue
    if (filters.requireBlueprintPrice && row.setupBreakdown.blueprintCost.bpoPriceMissing) {
      continue
    }
    rows.push(row)
  }

  const sortBy = filters.sortBy ?? 'iph'
  const sortDirection = filters.sortDirection ?? 'desc'

  const limit = filters.limit ?? TOP_N
  return sortBlueprintRows(rows, sortBy, sortDirection).slice(0, limit)
}

export function defaultMinSetupCost(): number {
  return SETUP_BUDGET_MIN
}

export function defaultMaxSetupCost(): number {
  return 100_000_000
}

/** Setup budget slider: 0 ISK at step 0, log scale from 1 ISK to 500B, then no limit at max step. */
export const SETUP_BUDGET_MIN = 0
export const SETUP_BUDGET_MAX = Number.POSITIVE_INFINITY
/** Highest finite value on the log-scale portion of the slider (step SETUP_BUDGET_SLIDER_STEPS - 1). */
export const SETUP_BUDGET_SLIDER_CAP = 500_000_000_000
export const SETUP_BUDGET_SLIDER_STEPS = 1000
const SETUP_BUDGET_LOG_MIN = 1
const SETUP_BUDGET_FINITE_STEPS = SETUP_BUDGET_SLIDER_STEPS - 1

export function setupBudgetFromSlider(slider: number): number {
  if (slider <= 0) return 0
  if (slider >= SETUP_BUDGET_SLIDER_STEPS) return SETUP_BUDGET_MAX
  const t = Math.min(
    1,
    Math.max(0, (slider - 1) / (SETUP_BUDGET_FINITE_STEPS - 1)),
  )
  const logMin = Math.log(SETUP_BUDGET_LOG_MIN)
  const logMax = Math.log(SETUP_BUDGET_SLIDER_CAP)
  return Math.round(Math.exp(logMin + t * (logMax - logMin)))
}

export function setupBudgetToSlider(value: number): number {
  const clamped = clampSetupBudget(value)
  if (clamped <= 0) return 0
  if (!Number.isFinite(clamped)) return SETUP_BUDGET_SLIDER_STEPS
  if (clamped >= SETUP_BUDGET_SLIDER_CAP) return SETUP_BUDGET_SLIDER_STEPS
  const logMin = Math.log(SETUP_BUDGET_LOG_MIN)
  const logMax = Math.log(SETUP_BUDGET_SLIDER_CAP)
  const t =
    (Math.log(Math.max(clamped, SETUP_BUDGET_LOG_MIN)) - logMin) / (logMax - logMin)
  return Math.round(1 + t * (SETUP_BUDGET_FINITE_STEPS - 1))
}

export function clampSetupBudget(value: number): number {
  if (!Number.isFinite(value)) return SETUP_BUDGET_MAX
  return Math.max(SETUP_BUDGET_MIN, Math.round(value))
}
