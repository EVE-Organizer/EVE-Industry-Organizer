/**
 * Shared blueprint economics for Blueprints ranking (flat) and Plan (chain).
 *
 * Intentional differences:
 * - Flat mode: single-recipe materials + one job + BPO/invention line (ranking).
 * - Plan chain: rolled-up build/buy via computePlanRootBuildCost + packaged self-buy.
 * - Ranking IPH uses marketAwareIph; Plan IPH uses netProfit / scheduled hours.
 * - Material buys always use sell-side window prices; revenue follows priceMethod.
 */
import type {
  BlueprintCostBreakdown,
  BlueprintInfo,
  GlobalSettings,
  HubId,
  HubMarketData,
  ManufacturingSettings,
  SetupCostBreakdown,
  TimeRange,
  TypeInfo,
} from '@/types'
import {
  applyME,
  amortizedBpoCost,
  estimateJobCost,
  estimateResearchFee,
  estimatedItemValue,
  inventionBlueprintCostPerRun,
  materialCost,
  resolveBlueprintMeTe,
  revenueFromSale,
  totalManufacturingCost,
} from '@/lib/cost'
import { resolveRecipeModifiers } from '@/lib/facilityModifiers'
import { isReactionRecipe } from '@/lib/recipes'
import { skillLevel } from '@/lib/skillFields'
import { tradingFeeRates } from '@/lib/tradingFees'
import {
  lifetimeCategoryKeyFromProductCategory,
  resolveBlueprintLifetimeRuns,
} from '@/lib/bpoLifetime'
import { manufacturingFacilityDetail } from '@/lib/facilityModifiers'

export type EconomicsMode = 'flat' | 'planChain'

export type PriceSourceKind = 'spot' | 'window_avg' | 'buy_max' | 'missing'

export interface PriceContext {
  hubId: HubId
  window: TimeRange
  spotSell: Map<number, number>
  buyOrders: Map<number, number>
  windowSell: Map<number, number>
  priceMethod: GlobalSettings['priceMethod']
}

export function materialUnitPrice(typeId: number, ctx: PriceContext): number {
  return ctx.windowSell.get(typeId) ?? 0
}

export function productRevenuePrice(productTypeId: number, ctx: PriceContext): number {
  if (ctx.priceMethod === 'buy_orders') {
    return ctx.buyOrders.get(productTypeId) ?? 0
  }
  return ctx.windowSell.get(productTypeId) ?? 0
}

export function buyLeafCost(qty: number, typeId: number, ctx: PriceContext): number {
  return materialUnitPrice(typeId, ctx) * qty
}

export function priceSourceForMaterial(typeId: number, ctx: PriceContext): PriceSourceKind {
  const window = ctx.windowSell.get(typeId) ?? 0
  const spot = ctx.spotSell.get(typeId) ?? 0
  if (window <= 0 && spot <= 0) return 'missing'
  if (window > 0 && spot > 0 && Math.abs(window - spot) < 1e-9) return 'spot'
  if (window > 0) return 'window_avg'
  return spot > 0 ? 'spot' : 'missing'
}

export function priceSourceForProduct(productTypeId: number, ctx: PriceContext): PriceSourceKind {
  if (ctx.priceMethod === 'buy_orders') {
    return (ctx.buyOrders.get(productTypeId) ?? 0) > 0 ? 'buy_max' : 'missing'
  }
  return priceSourceForMaterial(productTypeId, ctx)
}

export function collectMissingMaterialPrices(
  typeIds: number[],
  ctx: PriceContext,
): number[] {
  return typeIds.filter((id) => materialUnitPrice(id, ctx) <= 0)
}

/** Hub sell order for a BPO, then window average when spot is missing. */
export function bpoUnitPrice(
  blueprintTypeId: number,
  hubMarket: HubMarketData | null | undefined,
  ctx: PriceContext,
): number {
  const spot = ctx.spotSell.get(blueprintTypeId) ?? 0
  if (spot > 0) return spot
  if (!hubMarket) return 0
  const history = hubMarket.products[String(blueprintTypeId)]
  if (!history) return 0
  const fromWindow = history[ctx.window]
  if (fromWindow?.avgPrice && fromWindow.avgPrice > 0) return fromWindow.avgPrice
  const fromAll = history.all
  if (fromAll?.avgPrice && fromAll.avgPrice > 0) return fromAll.avgPrice
  return 0
}

export interface FlatSetupInput {
  blueprint: BlueprintInfo
  product: TypeInfo
  settings: ManufacturingSettings
  runs: number
  prices: Map<number, number>
  systemCostIndex: number
  reactionCostIndex: number
  hubMarket?: HubMarketData | null
  priceCtx?: PriceContext
  haulInIskPerM3?: number
  haulOutIskPerM3?: number
  includeHaulCost?: boolean
  typeVolumes?: Map<number, number>
  avgVolume?: number
  volumeCapDays?: number
}

export interface FlatSetupResult {
  setup: SetupCostBreakdown
  missingPriceTypeIds: number[]
  hasReliablePrices: boolean
  haulOut: number
  productVolumeM3: number
}

function isChargeProduct(category: string | undefined): boolean {
  return category === 'Charge'
}

function computeBlueprintAcquisition(
  blueprint: BlueprintInfo,
  settings: ManufacturingSettings,
  prices: Map<number, number>,
  systemCostIndex: number,
  runs: number,
  productCategory: string | undefined,
  hubMarket: HubMarketData | null | undefined,
  priceCtx: PriceContext | undefined,
): { charged: number; upfront: number; bpoUnitPrice: number; breakdown: BlueprintCostBreakdown } {
  const isCharge = isChargeProduct(productCategory)
  const include = settings.includeBlueprintCost && !isCharge

  if (blueprint.tier === 't2' && blueprint.invention) {
    const inv = blueprint.invention
    const r = inventionBlueprintCostPerRun({
      datacores: inv.datacores,
      prices,
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
        chargeExcluded: isCharge,
        datacoreCost: r.datacoreCost,
        inventionChance: r.chance,
        runsPerBPC: inv.runsPerBPC,
        expectedRunsPerAttempt: r.expectedRunsPerAttempt,
        costPerRun: r.costPerRun,
      },
    }
  }

  if (blueprint.tier === 'faction') {
    return {
      charged: 0,
      upfront: 0,
      bpoUnitPrice: 0,
      breakdown: {
        mode: 'faction_bpc',
        charged: 0,
        upfront: 0,
        chargeExcluded: isCharge,
      },
    }
  }

  const unit =
    priceCtx && hubMarket
      ? bpoUnitPrice(blueprint.blueprintTypeId, hubMarket, priceCtx)
      : (prices.get(blueprint.blueprintTypeId) ?? 0)
  const bpoPriceMissing = include && unit <= 0
  const baseRunMaterialValue = materialCost(blueprint.materials, prices)
  const researchFee = estimateResearchFee(baseRunMaterialValue, systemCostIndex)
  const lifetimeCategory = lifetimeCategoryKeyFromProductCategory(productCategory)
  const lifetimeRuns = resolveBlueprintLifetimeRuns(
    productCategory,
    settings.blueprintLifetimeRunsByCategory,
  )
  const charged =
    include && !bpoPriceMissing
      ? amortizedBpoCost(unit, researchFee, lifetimeRuns, runs)
      : 0
  const upfront = include && !bpoPriceMissing ? unit : 0
  return {
    charged,
    upfront,
    bpoUnitPrice: unit,
    breakdown: {
      mode: 'bpo',
      charged,
      upfront,
      chargeExcluded: isCharge,
      bpoPriceMissing: bpoPriceMissing || undefined,
      bpoUnitPrice: unit,
      researchFee,
      lifetimeRuns,
      lifetimeCategory,
    },
  }
}

/** Flat single-recipe setup (Blueprints ranking / Plan parity for all-mineral T1). */
export function computeFlatSetup(input: FlatSetupInput): FlatSetupResult {
  const {
    blueprint,
    product,
    settings,
    runs,
    prices,
    systemCostIndex,
    reactionCostIndex,
    hubMarket,
    priceCtx,
    haulInIskPerM3 = 0,
    haulOutIskPerM3 = 0,
    includeHaulCost = settings.includeHaulCost ?? true,
    typeVolumes = new Map(),
    avgVolume = 0,
    volumeCapDays = 7,
  } = input

  const { me } = resolveBlueprintMeTe(blueprint.tier, settings, undefined, blueprint)
  const structure = resolveRecipeModifiers(settings, blueprint)
  const facilityBonus = manufacturingFacilityDetail(settings)
  const effectiveMe = isReactionRecipe(blueprint) ? 0 : me
  const mats = applyME(blueprint.materials, effectiveMe, runs, structure.meBonusPercent)
  const matCost = materialCost(mats, prices)
  const eiv = estimatedItemValue(blueprint.materials, runs, prices)
  const costIndex = isReactionRecipe(blueprint) ? reactionCostIndex : systemCostIndex
  const jobCost = estimateJobCost(eiv, costIndex, structure)
  const outputQty = blueprint.productQuantity * runs
  const materialVolume = mats.reduce(
    (sum, m) => sum + m.quantity * (typeVolumes.get(m.typeId) ?? 0),
    0,
  )
  const productVolume = (typeVolumes.get(blueprint.productTypeId) ?? product.volume) * outputQty
  const haulExcluded = !includeHaulCost
  const haulIn = haulExcluded ? 0 : materialVolume * haulInIskPerM3
  const haulOut = haulExcluded ? 0 : productVolume * haulOutIskPerM3

  const bpCost = computeBlueprintAcquisition(
    blueprint,
    settings,
    prices,
    systemCostIndex,
    runs,
    product.category,
    hubMarket,
    priceCtx,
  )

  const operatingCost = matCost + jobCost + haulIn
  const setupCost = operatingCost + bpCost.charged
  const upfrontCapital = operatingCost + bpCost.upfront

  const missingPriceTypeIds = mats
    .filter((m) => (prices.get(m.typeId) ?? 0) <= 0)
    .map((m) => m.typeId)

  const baseQtyByType = new Map(blueprint.materials.map((m) => [m.typeId, m.quantity]))
  const setup: SetupCostBreakdown = {
    batchSizeSetting: settings.batchSize,
    productQuantity: blueprint.productQuantity,
    avgVolume,
    volumeCapDays,
    runs,
    outputQty,
    me: effectiveMe,
    materials: mats.map((m) => {
      const unitPrice = prices.get(m.typeId) ?? 0
      const unitVolumeM3 = typeVolumes.get(m.typeId) ?? 0
      return {
        typeId: m.typeId,
        baseQtyPerRun: baseQtyByType.get(m.typeId) ?? m.quantity,
        quantity: m.quantity,
        unitPrice,
        lineTotal: unitPrice * m.quantity,
        unitVolumeM3,
        lineVolumeM3: unitVolumeM3 * m.quantity,
        priceSource: priceCtx ? priceSourceForMaterial(m.typeId, priceCtx) : undefined,
      }
    }),
    materialCost: matCost,
    estimatedItemValue: eiv,
    systemCostIndex: costIndex,
    structureType: settings.structureType,
    structureMeBonusPercent: structure.meBonusPercent,
    structureTeBonusPercent: structure.teBonusPercent,
    structureJobCostBonusPercent: structure.jobCostBonusPercent,
    structureTaxPercent: structure.taxPercent,
    facilityBonus,
    jobCost,
    bpoTypeId: blueprint.blueprintTypeId,
    bpoUnitPrice: bpCost.bpoUnitPrice,
    bpoCost: bpCost.charged,
    blueprintCost: bpCost.breakdown,
    upfrontCapital,
    materialVolumeM3: materialVolume,
    haulInIskPerM3,
    haulIn,
    haulExcluded: haulExcluded || undefined,
    setupCost,
  }

  return {
    setup,
    missingPriceTypeIds,
    hasReliablePrices: missingPriceTypeIds.length === 0,
    haulOut,
    productVolumeM3: productVolume,
  }
}

export function computeRevenue(
  productTypeId: number,
  outputQty: number,
  settings: GlobalSettings,
  priceCtx: PriceContext,
): {
  sellPricePerUnit: number
  gross: number
  net: number
  brokerFee: number
  salesTax: number
} {
  const sellPricePerUnit = productRevenuePrice(productTypeId, priceCtx)
  const feeRates = tradingFeeRates(
    skillLevel(settings.skills, 'accounting'),
    skillLevel(settings.skills, 'brokerRelations'),
  )
  const usesBuyOrders = settings.priceMethod === 'buy_orders'
  const { gross, net, brokerFee, salesTax } = revenueFromSale(
    sellPricePerUnit,
    outputQty,
    feeRates,
    { includeBrokerFee: !usesBuyOrders },
  )
  return { sellPricePerUnit, gross, net, brokerFee, salesTax }
}

/** Quick operating capital for a blueprint batch (materials + job), used by plan rollups. */
export function operatingCapitalForRuns(
  blueprint: BlueprintInfo,
  runs: number,
  prices: Map<number, number>,
  settings: GlobalSettings,
  me: number,
  systemCostIndex: number,
  reactionCostIndex: number,
): number {
  const mfg = { ...settings, batchSize: runs }
  const { capital } = totalManufacturingCost(
    blueprint,
    prices,
    mfg,
    me,
    systemCostIndex,
    reactionCostIndex,
  )
  return capital
}
