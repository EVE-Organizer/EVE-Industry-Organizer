import type { BlueprintInfo, GlobalSettings, ManufacturingPlanTemplate, PlanRootEntry } from '@/types'
import {
  applyME,
  resolveBlueprintMeTe,
  resolveStructureModifiers,
  revenueFromSale,
} from '@/lib/cost'
import {
  computePlanRootBuildCost,
  expandManufacturingPlan,
  type ExpandPlanInput,
} from '@/lib/manufacturingPlan'
import { skillLevel } from '@/lib/skillFields'
import { tradingFeeRates } from '@/lib/tradingFees'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'

export interface PlanBuyCostLine {
  productTypeId: number
  name: string
  qty: number
  unitPrice: number
  cost: number
}

export interface PlanSetupBreakdown {
  rootId: string
  productTypeId: number
  productName: string
  runs: number
  outputQty: number
  totalSetupCost: number
  packagedBuyCost: number
  buyLines: PlanBuyCostLine[]
  /** Rolled-up build cost after market buys and packaged inputs. */
  buildChainCost: number
}

export interface PlanProfitBreakdown {
  rootId: string
  productTypeId: number
  productName: string
  runs: number
  outputQty: number
  jobTimeHours: number
  sellPricePerUnit: number
  priceMethod: GlobalSettings['priceMethod']
  grossRevenue: number
  brokerFee: number
  salesTax: number
  netRevenue: number
  setupCost: number
  netProfit: number
  margin: number
  iph: number
  hasPrices: boolean
}

export interface RootProfitRow {
  rootId: string
  productTypeId: number
  runs: number
  outputQty: number
  setupCost: number
  netRevenue: number
  netProfit: number
  margin: number
  iph: number
  sellPricePerUnit: number
  hasPrices: boolean
}

export interface PlanProfitSummary {
  setupCost: number
  netRevenue: number
  netProfit: number
  margin: number
  iph: number
  jobHours: number
  rootRows: RootProfitRow[]
  hasPrices: boolean
}

function sellPriceForProduct(
  productTypeId: number,
  sellPrices: Map<number, number>,
  buyPrices: Map<number, number>,
  settings: GlobalSettings,
): number {
  if (settings.priceMethod === 'buy_orders') {
    return buyPrices.get(productTypeId) ?? 0
  }
  return sellPrices.get(productTypeId) ?? 0
}

function packagedSelfBuyCost(
  blueprint: BlueprintInfo,
  runs: number,
  prices: Map<number, number>,
  settings: GlobalSettings,
  meTeOverride?: { me?: number; te?: number },
): number {
  const { me } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride)
  const structure = resolveStructureModifiers(settings)
  const mats = applyME(blueprint.materials, me, runs, structure.meBonusPercent)
  const selfQty = mats
    .filter((m) => m.typeId === blueprint.productTypeId)
    .reduce((sum, m) => sum + m.quantity, 0)
  if (selfQty <= 0) return 0
  return (prices.get(blueprint.productTypeId) ?? 0) * selfQty
}

export function computeRootProfitRow(
  root: PlanRootEntry,
  blueprint: BlueprintInfo,
  expandInput: ExpandPlanInput,
  sellPrices: Map<number, number>,
  buyPrices: Map<number, number>,
  jobTimeHours: number,
): RootProfitRow {
  const { settings, template } = expandInput
  const meTeOverride = template.nodeOverrides[root.productTypeId]

  const chainCost = computePlanRootBuildCost(blueprint, root.runs, expandInput)
  const setupCost =
    chainCost + packagedSelfBuyCost(blueprint, root.runs, sellPrices, settings, meTeOverride)

  const outputQty = root.runs * blueprint.productQuantity
  const sellPricePerUnit = sellPriceForProduct(
    blueprint.productTypeId,
    sellPrices,
    buyPrices,
    settings,
  )
  const hasPrices = sellPricePerUnit > 0 && setupCost > 0

  const feeRates = tradingFeeRates(
    skillLevel(settings.skills, 'accounting'),
    skillLevel(settings.skills, 'brokerRelations'),
  )
  const usesBuyOrders = settings.priceMethod === 'buy_orders'
  const { net: netRevenue } = revenueFromSale(sellPricePerUnit, outputQty, feeRates, {
    includeBrokerFee: !usesBuyOrders,
  })
  const netProfit = netRevenue - setupCost
  const margin = setupCost > 0 ? (netProfit / setupCost) * 100 : 0
  const iph = jobTimeHours > 0 ? netProfit / jobTimeHours : 0

  return {
    rootId: root.id,
    productTypeId: root.productTypeId,
    runs: root.runs,
    outputQty,
    setupCost,
    netRevenue,
    netProfit,
    margin,
    iph,
    sellPricePerUnit,
    hasPrices,
  }
}

function isolatedExpandInput(input: ExpandPlanInput, root: PlanRootEntry): ExpandPlanInput {
  return {
    ...input,
    template: {
      ...input.template,
      roots: [root],
    },
  }
}

export function computeRootSetupBreakdown(
  root: PlanRootEntry,
  blueprint: BlueprintInfo,
  expandInput: ExpandPlanInput,
  productName: string,
): PlanSetupBreakdown {
  const { settings, template } = expandInput
  const meTeOverride = template.nodeOverrides[root.productTypeId]
  const isolated = isolatedExpandInput(expandInput, root)
  const { nodes } = expandManufacturingPlan(isolated)

  const packagedBuyCost = packagedSelfBuyCost(
    blueprint,
    root.runs,
    expandInput.prices,
    settings,
    meTeOverride,
  )
  const totalSetupCost =
    computePlanRootBuildCost(blueprint, root.runs, expandInput) + packagedBuyCost

  const buyLines: PlanBuyCostLine[] = nodes
    .filter((node) => node.mode === 'buy' && (node.buyCost ?? 0) > 0)
    .map((node) => ({
      productTypeId: node.productTypeId,
      name: node.name,
      qty: node.totalDemandQty,
      unitPrice: node.unitPrice ?? 0,
      cost: node.buyCost ?? 0,
    }))
    .sort((a, b) => b.cost - a.cost)

  const buyTotal = buyLines.reduce((sum, line) => sum + line.cost, 0)
  const buildChainCost = Math.max(0, totalSetupCost - buyTotal - packagedBuyCost)

  return {
    rootId: root.id,
    productTypeId: root.productTypeId,
    productName,
    runs: root.runs,
    outputQty: root.runs * blueprint.productQuantity,
    totalSetupCost,
    packagedBuyCost,
    buyLines,
    buildChainCost,
  }
}

export function computeRootProfitBreakdown(
  root: PlanRootEntry,
  blueprint: BlueprintInfo,
  expandInput: ExpandPlanInput,
  sellPrices: Map<number, number>,
  buyPrices: Map<number, number>,
  jobTimeHours: number,
  productName: string,
): PlanProfitBreakdown {
  const { settings } = expandInput
  const base = computeRootProfitRow(
    root,
    blueprint,
    expandInput,
    sellPrices,
    buyPrices,
    jobTimeHours,
  )

  const sellPricePerUnit = sellPriceForProduct(
    blueprint.productTypeId,
    sellPrices,
    buyPrices,
    settings,
  )
  const feeRates = tradingFeeRates(
    skillLevel(settings.skills, 'accounting'),
    skillLevel(settings.skills, 'brokerRelations'),
  )
  const usesBuyOrders = settings.priceMethod === 'buy_orders'
  const { gross, net, brokerFee, salesTax } = revenueFromSale(
    sellPricePerUnit,
    base.outputQty,
    feeRates,
    { includeBrokerFee: !usesBuyOrders },
  )

  return {
    rootId: root.id,
    productTypeId: root.productTypeId,
    productName,
    runs: root.runs,
    outputQty: base.outputQty,
    jobTimeHours,
    sellPricePerUnit,
    priceMethod: settings.priceMethod,
    grossRevenue: gross,
    brokerFee,
    salesTax,
    netRevenue: net,
    setupCost: base.setupCost,
    netProfit: base.netProfit,
    margin: base.margin,
    iph: base.iph,
    hasPrices: base.hasPrices,
  }
}

export function computePlanProfitSummary(
  template: ManufacturingPlanTemplate,
  expandInput: ExpandPlanInput,
  sellPrices: Map<number, number>,
  buyPrices: Map<number, number>,
  jobTimeHoursByRootId: Map<string, number>,
): PlanProfitSummary {
  const rootRows: RootProfitRow[] = []

  for (const root of template.roots) {
    const blueprint = getBlueprintForProduct(expandInput.blueprints, root.productTypeId)
    if (!blueprint) continue
    rootRows.push(
      computeRootProfitRow(
        root,
        blueprint,
        expandInput,
        sellPrices,
        buyPrices,
        jobTimeHoursByRootId.get(root.id) ?? root.productionDurationHours,
      ),
    )
  }

  const setupCost = rootRows.reduce((sum, row) => sum + row.setupCost, 0)
  const netRevenue = rootRows.reduce((sum, row) => sum + row.netRevenue, 0)
  const netProfit = netRevenue - setupCost
  const margin = setupCost > 0 ? (netProfit / setupCost) * 100 : 0
  const jobHours = rootRows.reduce(
    (sum, row) => sum + (jobTimeHoursByRootId.get(row.rootId) ?? 0),
    0,
  )
  const iph = jobHours > 0 ? netProfit / jobHours : 0
  const hasPrices = rootRows.some((row) => row.hasPrices)

  return {
    setupCost,
    netRevenue,
    netProfit,
    margin,
    iph,
    jobHours,
    rootRows,
    hasPrices,
  }
}
