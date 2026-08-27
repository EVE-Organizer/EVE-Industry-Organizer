import type { BlueprintInfo, BlueprintMaterial, BlueprintTier, GlobalSettings, ManufacturingSettings, StructureModifiers } from '@/types'
import { isReactionRecipe, recipeKind } from '@/lib/recipes'
import {
  resolveManufacturingModifiers,
  resolveRecipeModifiers,
} from '@/lib/facilityModifiers'
import {
  BATCH_SIZE_STEP,
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  MIN_BATCH_SIZE,
  T2_INVENTED_ME,
  T2_INVENTED_TE,
} from '@/types'

const ME_BONUS = 0.01
/**
 * Blueprint TE is stored as the in-game display value 0–20 (TE 20 = −20% time).
 * Each point is 1% reduction; research steps are 2% each across 10 levels.
 */
const TE_BONUS = 0.01
/** Industry skill: 4% manufacturing time reduction per level (EVE SDE). */
const INDUSTRY_BONUS = 0.04
/** Advanced Industry: 3% manufacturing time reduction per level. */
const ADVANCED_INDUSTRY_BONUS = 0.03
/** Reactions skill: 4% reaction time reduction per level. */
const REACTIONS_BONUS = 0.04

/**
 * Rough EIV fraction for full ME10 + TE20 research, charged once per BPO.
 * Research job fees are small next to a BPO's price, so this stays a proxy
 * (one build-job equivalent) rather than the exact per-level EVE formula.
 */
const RESEARCH_FEE_FACTOR = 1

/** Multiplicative bonus as a factor in [0, 1] (40% bonus → 0.6). */
function bonusFactor(percent: number): number {
  return Math.max(0, 1 - percent / 100)
}

/** Owner tax as a multiplier (10% tax → 1.1). */
function taxFactor(percent: number): number {
  return Math.max(0, 1 + percent / 100)
}

export function resolveStructureModifiers(settings: GlobalSettings): StructureModifiers {
  return resolveManufacturingModifiers(settings)
}

/** TE time multiplier for display and breakdowns (TE 20 → 0.80). */
export function teTimeFactor(te: number): number {
  return 1 - te * TE_BONUS
}

export function industryTimeFactor(industry: number): number {
  return 1 - industry * INDUSTRY_BONUS
}

export function advancedIndustryTimeFactor(advancedIndustry: number): number {
  return 1 - advancedIndustry * ADVANCED_INDUSTRY_BONUS
}

export function reactionsTimeFactor(reactions: number): number {
  return 1 - reactions * REACTIONS_BONUS
}

/**
 * Materials for a manufacturing job after ME and structure bonuses.
 * EVE: max(runs, ceil(round(baseQty * runs * modifiers, 2))).
 */
export function applyME(
  materials: { typeId: number; quantity: number }[],
  me: number,
  runs: number,
  structureMeBonusPercent = 0,
) {
  if (runs <= 0) {
    return materials.map((m) => ({ typeId: m.typeId, quantity: 0 }))
  }
  const meFactor = Math.max(0, 1 - me * ME_BONUS)
  const structFactor = bonusFactor(structureMeBonusPercent)
  return materials.map((m) => {
    const raw = m.quantity * runs * meFactor * structFactor
    const rounded = Math.round(raw * 100) / 100
    return {
      typeId: m.typeId,
      quantity: Math.max(runs, Math.ceil(rounded)),
    }
  })
}

export function applyTE(
  baseTimeSeconds: number,
  te: number,
  runs: number,
  industry: number,
  advancedIndustry: number,
  structureTeBonusPercent = 0,
): number {
  const structFactor = bonusFactor(structureTeBonusPercent)
  return (
    baseTimeSeconds *
    runs *
    teTimeFactor(te) *
    industryTimeFactor(industry) *
    structFactor *
    advancedIndustryTimeFactor(advancedIndustry)
  )
}

/** Reaction job time: no blueprint TE; Reactions skill and structure TE only. */
export function applyReactionTime(
  baseTimeSeconds: number,
  runs: number,
  reactions: number,
  structureTeBonusPercent = 0,
): number {
  const structFactor = bonusFactor(structureTeBonusPercent)
  return baseTimeSeconds * runs * reactionsTimeFactor(reactions) * structFactor
}

export function reactionTimePerRun(
  baseTimeSeconds: number,
  reactions: number,
  structureTeBonusPercent = 0,
): number {
  return applyReactionTime(baseTimeSeconds, 1, reactions, structureTeBonusPercent)
}

export function manufacturingTimePerRun(
  baseTimeSeconds: number,
  te: number,
  industry: number,
  advancedIndustry: number,
  structureTeBonusPercent = 0,
): number {
  return applyTE(baseTimeSeconds, te, 1, industry, advancedIndustry, structureTeBonusPercent)
}

export function clampManufacturingRuns(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE
  const stepped = Math.round(value / BATCH_SIZE_STEP) * BATCH_SIZE_STEP
  return Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, stepped))
}

export function clampGraphRuns(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE
  return Math.max(MIN_BATCH_SIZE, Math.round(value))
}

function minRunsForStep(step: number): number {
  return step === 1 ? 1 : MIN_BATCH_SIZE
}

function clampRunsToStep(value: number, step: number, maxRuns?: number | null): number {
  const stepped = Math.round(value / step) * step
  const minClamped = Math.max(minRunsForStep(step), stepped)
  if (maxRuns == null) return minClamped
  return Math.min(maxRuns, minClamped)
}

export function runsForJobTime(
  jobTimeSeconds: number,
  baseTimeSeconds: number,
  te: number,
  industry: number,
  advancedIndustry: number,
  structureTeBonusPercent = 0,
  options?: { step?: number; maxRuns?: number | null },
): number {
  const perRun = manufacturingTimePerRun(
    baseTimeSeconds,
    te,
    industry,
    advancedIndustry,
    structureTeBonusPercent,
  )
  const step = options?.step ?? BATCH_SIZE_STEP
  const minRuns = minRunsForStep(step)
  if (!Number.isFinite(perRun) || perRun <= 0) return minRuns
  if (!Number.isFinite(jobTimeSeconds) || jobTimeSeconds <= 0) return minRuns

  const maxRuns = options && 'maxRuns' in options ? options.maxRuns : MAX_BATCH_SIZE
  const exactRuns = jobTimeSeconds / perRun

  if (maxRuns != null && exactRuns >= maxRuns) return maxRuns
  if (exactRuns <= minRuns) return minRuns

  const low = Math.floor(exactRuns / step) * step
  const high = Math.ceil(exactRuns / step) * step
  const candidates = new Set<number>([
    clampRunsToStep(low, step, maxRuns),
    clampRunsToStep(high, step, maxRuns),
    clampRunsToStep(exactRuns, step, maxRuns),
  ])

  let best = minRuns
  let bestError = Infinity
  for (const runs of candidates) {
    const error = Math.abs(perRun * runs - jobTimeSeconds)
    if (error < bestError) {
      bestError = error
      best = runs
    }
  }
  return best
}

export function runsForReactionJobTime(
  jobTimeSeconds: number,
  baseTimeSeconds: number,
  reactions: number,
  structureTeBonusPercent = 0,
  options?: { step?: number; maxRuns?: number | null },
): number {
  const perRun = reactionTimePerRun(baseTimeSeconds, reactions, structureTeBonusPercent)
  const step = options?.step ?? BATCH_SIZE_STEP
  const minRuns = minRunsForStep(step)
  if (!Number.isFinite(perRun) || perRun <= 0) return minRuns
  if (!Number.isFinite(jobTimeSeconds) || jobTimeSeconds <= 0) return minRuns

  const maxRuns = options && 'maxRuns' in options ? options.maxRuns : MAX_BATCH_SIZE
  const exactRuns = jobTimeSeconds / perRun

  if (maxRuns != null && exactRuns >= maxRuns) return maxRuns
  if (exactRuns <= minRuns) return minRuns

  const low = Math.floor(exactRuns / step) * step
  const high = Math.ceil(exactRuns / step) * step
  const candidates = new Set<number>([
    clampRunsToStep(low, step, maxRuns),
    clampRunsToStep(high, step, maxRuns),
    clampRunsToStep(exactRuns, step, maxRuns),
  ])

  let best = minRuns
  let bestError = Infinity
  for (const runs of candidates) {
    const error = Math.abs(perRun * runs - jobTimeSeconds)
    if (error < bestError) {
      bestError = error
      best = runs
    }
  }
  return best
}

export function materialCost(
  materials: { typeId: number; quantity: number }[],
  prices: Map<number, number>,
): number {
  return materials.reduce((sum, m) => sum + (prices.get(m.typeId) ?? 0) * m.quantity, 0)
}

/**
 * Estimated Item Value for job installation fees: base (ME 0) material qty × price × runs.
 * In-game EIV uses adjusted prices; this app approximates with hub market prices.
 */
export function estimatedItemValue(
  materials: { typeId: number; quantity: number }[],
  runs: number,
  prices: Map<number, number>,
): number {
  if (runs <= 0) return 0
  return materials.reduce(
    (sum, m) => sum + (prices.get(m.typeId) ?? 0) * m.quantity * runs,
    0,
  )
}

/** Job installation fee from EIV (base materials), system cost index, and structure modifiers. */
export function estimateJobCost(
  eiv: number,
  systemCostIndex: number,
  modifiers: Pick<StructureModifiers, 'jobCostBonusPercent' | 'taxPercent'> = {
    jobCostBonusPercent: 0,
    taxPercent: 0,
  },
): number {
  return (
    eiv *
    systemCostIndex *
    bonusFactor(modifiers.jobCostBonusPercent) *
    taxFactor(modifiers.taxPercent)
  )
}

export function totalManufacturingCost(
  blueprint: BlueprintInfo,
  prices: Map<number, number>,
  settings: ManufacturingSettings,
  me: number,
  systemCostIndex: number,
  reactionCostIndex = systemCostIndex,
  productCategory?: string,
): { materialCost: number; jobCost: number; capital: number; jobTime: number } {
  const runs = settings.batchSize
  const kind = recipeKind(blueprint)
  const costIndex =
    kind === 'reaction' ? reactionCostIndex : systemCostIndex
  const structure = resolveRecipeModifiers(settings, {
    ...blueprint,
    category: productCategory,
  })

  if (isReactionRecipe(blueprint)) {
    const mats = applyME(blueprint.materials, 0, runs, structure.meBonusPercent)
    const matCost = materialCost(mats, prices)
    const eiv = estimatedItemValue(blueprint.materials, runs, prices)
    const jobCost = estimateJobCost(eiv, costIndex, structure)
    const reactions = settings.skills.reactions ?? 0
    const jobTime = applyReactionTime(
      blueprint.manufacturingTime,
      runs,
      reactions,
      structure.teBonusPercent,
    )
    return {
      materialCost: matCost,
      jobCost,
      capital: matCost + jobCost,
      jobTime,
    }
  }

  const mats = applyME(blueprint.materials, me, runs, structure.meBonusPercent)
  const matCost = materialCost(mats, prices)
  const eiv = estimatedItemValue(blueprint.materials, runs, prices)
  const jobCost = estimateJobCost(eiv, costIndex, structure)
  const { te } = blueprintMeTe(blueprint.tier, settings, blueprint)
  const jobTime = applyTE(
    blueprint.manufacturingTime,
    te,
    runs,
    settings.skills.industry ?? 0,
    settings.skills.advancedIndustry ?? 0,
    structure.teBonusPercent,
  )
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
  fees: { brokerFeePercent: number; salesTaxPercent: number },
  options: { includeBrokerFee?: boolean } = {},
): { gross: number; net: number; brokerFee: number; salesTax: number } {
  const gross = productPrice * productQty
  const brokerFee =
    options.includeBrokerFee === false ? 0 : gross * (fees.brokerFeePercent / 100)
  const salesTax = gross * (fees.salesTaxPercent / 100)
  return { gross, net: gross - brokerFee - salesTax, brokerFee, salesTax }
}

/**
 * ME/TE used for a blueprint. T2 invented BPCs are fixed at ME2/TE4. Faction
 * blueprints are BPCs that cannot be researched, so they stay at ME0/TE0 as
 * acquired. T1 BPOs use the global researched default.
 */
export function blueprintMeTe(
  tier: BlueprintTier,
  settings: GlobalSettings,
  blueprint?: Pick<BlueprintInfo, 'kind'>,
): { me: number; te: number } {
  if (blueprint && isReactionRecipe(blueprint as BlueprintInfo)) {
    return { me: 0, te: 0 }
  }
  if (tier === 't2') return { me: T2_INVENTED_ME, te: T2_INVENTED_TE }
  if (tier === 'faction') return { me: 0, te: 0 }
  return { me: settings.meDefault, te: settings.teDefault }
}

export interface MeTeOverride {
  me?: number
  te?: number
}

/** ME/TE for a blueprint, applying per-plan overrides on researchable T1 BPOs. */
export function resolveBlueprintMeTe(
  tier: BlueprintTier,
  settings: GlobalSettings,
  override?: MeTeOverride,
  blueprint?: Pick<BlueprintInfo, 'kind'>,
): { me: number; te: number; locked: boolean } {
  if (blueprint && isReactionRecipe(blueprint as BlueprintInfo)) {
    return { me: 0, te: 0, locked: true }
  }
  const base = blueprintMeTe(tier, settings, blueprint)
  if (tier === 't2' || tier === 'faction') {
    return { me: base.me, te: base.te, locked: true }
  }
  return {
    me: override?.me ?? base.me,
    te: override?.te ?? base.te,
    locked: false,
  }
}

/** Approximate one-time research job fee (ME10 + TE20) from one base run's material value. */
export function estimateResearchFee(baseRunMaterialValue: number, systemCostIndex: number): number {
  return baseRunMaterialValue * systemCostIndex * RESEARCH_FEE_FACTOR
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
  // Encryption and both datacore skills add +1% per level (multiplicative).
  const skillFactor = 1 + skillLevel * 0.01
  const chance = Math.min(1, baseChance * skillFactor * skillFactor * skillFactor)
  const expectedRunsPerAttempt = chance * runsPerBPC
  const costPerRun = expectedRunsPerAttempt > 0 ? attemptCost / expectedRunsPerAttempt : Infinity
  return { datacoreCost, attemptCost, chance, expectedRunsPerAttempt, costPerRun }
}
