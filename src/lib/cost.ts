import type { BlueprintInfo, BlueprintMaterial, BlueprintTier, GlobalSettings } from '@/types'
import { T2_INVENTED_ME, T2_INVENTED_TE } from '@/types'

const ME_BONUS = 0.01
const TE_BONUS = 0.04

/**
 * Rough EIV fraction for full ME10 + TE20 research, charged once per BPO.
 * Research job fees are small next to a BPO's price, so this stays a proxy
 * (one build-job equivalent) rather than the exact per-level EVE formula.
 */
const RESEARCH_FEE_FACTOR = 1

export function applyME(materials: { typeId: number; quantity: number }[], me: number, runs: number) {
  const factor = 1 - me * ME_BONUS
  return materials.map((m) => ({
    typeId: m.typeId,
    quantity: Math.max(1, Math.ceil(m.quantity * runs * factor)),
  }))
}

export function applyTE(baseTimeSeconds: number, te: number, runs: number, advancedIndustry: number): number {
  const teFactor = 1 - te * TE_BONUS
  const advFactor = 1 - advancedIndustry * 0.03
  return baseTimeSeconds * runs * teFactor * advFactor
}

export function materialCost(
  materials: { typeId: number; quantity: number }[],
  prices: Map<number, number>,
): number {
  return materials.reduce((sum, m) => sum + (prices.get(m.typeId) ?? 0) * m.quantity, 0)
}

export function estimateJobCost(materialCostIsk: number, systemCostIndex: number, structureTax = 0): number {
  const eiv = materialCostIsk
  return eiv * systemCostIndex * (1 + structureTax)
}

export function totalManufacturingCost(
  blueprint: BlueprintInfo,
  prices: Map<number, number>,
  settings: GlobalSettings,
  me: number,
  systemCostIndex: number,
  advancedIndustry = 0,
): { materialCost: number; jobCost: number; capital: number; jobTime: number } {
  const runs = settings.batchSize
  const mats = applyME(blueprint.materials, me, runs)
  const matCost = materialCost(mats, prices)
  const jobCost = estimateJobCost(matCost, systemCostIndex)
  const jobTime = applyTE(blueprint.manufacturingTime, settings.teDefault, runs, advancedIndustry)
  return {
    materialCost: matCost,
    jobCost,
    capital: matCost + jobCost,
    jobTime,
  }
}

export function revenueFromSale(
  productPrice: number,
  productQty: number,
  settings: GlobalSettings,
): { gross: number; net: number; brokerFee: number; salesTax: number } {
  const gross = productPrice * productQty
  const brokerFee = gross * (settings.brokerFeePercent / 100)
  const afterBroker = gross - brokerFee
  const salesTax = afterBroker * (settings.salesTaxPercent / 100)
  return { gross, net: afterBroker - salesTax, brokerFee, salesTax }
}

export function profitPerBatch(
  blueprint: BlueprintInfo,
  prices: Map<number, number>,
  settings: GlobalSettings,
  me: number,
  systemCostIndex: number,
): number {
  const productPrice = prices.get(blueprint.productTypeId) ?? 0
  const { capital } = totalManufacturingCost(blueprint, prices, settings, me, systemCostIndex)
  const outputQty = blueprint.productQuantity * settings.batchSize
  const { net } = revenueFromSale(productPrice, outputQty, settings)
  return net - capital
}

/** ME/TE used for a blueprint: T2 invented BPCs are fixed at ME2/TE4, others use the global default. */
export function blueprintMeTe(
  tier: BlueprintTier,
  settings: GlobalSettings,
): { me: number; te: number } {
  if (tier === 't2') return { me: T2_INVENTED_ME, te: T2_INVENTED_TE }
  return { me: settings.meDefault, te: settings.teDefault }
}

/** Approximate one-time research job fee (ME10 + TE20) from one base run's material value. */
export function estimateResearchFee(baseRunMaterialValue: number, systemCostIndex: number): number {
  return baseRunMaterialValue * systemCostIndex * RESEARCH_FEE_FACTOR
}

/** T1/faction BPO: spread purchase price + research over its assumed lifetime, charged per batch. */
export function amortizedBpoCost(
  bpoPrice: number,
  researchFee: number,
  lifetimeRuns: number,
  runs: number,
): number {
  if (lifetimeRuns <= 0) return 0
  return ((bpoPrice + researchFee) / lifetimeRuns) * runs
}

export interface InventionCostResult {
  datacoreCost: number
  attemptCost: number
  chance: number
  expectedRunsPerAttempt: number
  costPerRun: number
}

/** T2 invention: datacore + copy cost per attempt, divided by expected successful runs. */
export function inventionBlueprintCostPerRun({
  datacores,
  prices,
  baseChance,
  runsPerBPC,
  skillLevel,
  copyFeePerAttempt = 0,
}: {
  datacores: BlueprintMaterial[]
  prices: Map<number, number>
  baseChance: number
  runsPerBPC: number
  skillLevel: number
  copyFeePerAttempt?: number
}): InventionCostResult {
  const datacoreCost = materialCost(datacores, prices)
  const attemptCost = datacoreCost + copyFeePerAttempt
  // Encryption skill divided by 40, the two datacore skills by 30 each.
  const chance = Math.min(1, baseChance * (1 + skillLevel / 40 + (2 * skillLevel) / 30))
  const expectedRunsPerAttempt = chance * runsPerBPC
  const costPerRun = expectedRunsPerAttempt > 0 ? attemptCost / expectedRunsPerAttempt : Infinity
  return { datacoreCost, attemptCost, chance, expectedRunsPerAttempt, costPerRun }
}

/** Spot margin for ranking only: raw blueprint materials, no ME or TE. */
export function spotProfitPerBatch(
  blueprint: BlueprintInfo,
  prices: Map<number, number>,
  settings: GlobalSettings,
  systemCostIndex: number,
): number {
  const runs = settings.batchSize
  const mats = blueprint.materials.map((m) => ({
    typeId: m.typeId,
    quantity: Math.max(1, Math.ceil(m.quantity * runs)),
  }))
  const matCost = materialCost(mats, prices)
  const capital = matCost + estimateJobCost(matCost, systemCostIndex)
  const productPrice = prices.get(blueprint.productTypeId) ?? 0
  const outputQty = blueprint.productQuantity * runs
  const { net } = revenueFromSale(productPrice, outputQty, settings)
  return net - capital
}
