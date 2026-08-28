import type {
  BlueprintInfo,
  GlobalSettings,
  ManufacturingPlanTemplate,
  PlanBuildMode,
  PlanNode,
  PlanNodeOverride,
  SystemInfo,
} from '@/types'
import { MIN_BATCH_SIZE } from '@/types'
import {
  applyME,
  inventionBlueprintCostForSettings,
  materialCost,
  resolveBlueprintMeTe,
  totalManufacturingCost,
} from '@/lib/cost'
import { resolveRecipeModifiers } from '@/lib/facilityModifiers'
import {
  bpcCountForRuns,
  defaultRunsPerBpc,
  inGameDurationHoursFromRuns,
  jobTimeSecondsForRuns,
  runsForDemand,
} from '@/lib/rootRunsDuration'
import { activeConcurrentCopies, totalRootRuns } from '@/lib/supplyChainSlots'
import { templateWithActiveRoots } from '@/lib/planRootEnabled'
import { manufacturingSlotsFromSkills, researchSlotsFromSkills } from '@/lib/manufacturingSlots'
import { getBlueprintForBpo, getBlueprintForProduct } from '@/services/data/sdeLoader'
import { isRawMaterial } from '@/lib/supplyChain'
import { canRunReactionJobs, isReactionRecipe } from '@/lib/recipes'
import type { TypeInfo } from '@/types'

interface NodeAccum {
  productTypeId: number
  name: string
  tier?: BlueprintInfo['tier']
  blueprint?: BlueprintInfo
  mode: PlanBuildMode
  demandByParent: { parentProductTypeId: number; qty: number }[]
  parentProductTypeIds: Set<number>
  childProductTypeIds: Set<number>
  isRoot: boolean
  isLeaf: boolean
  depth: number
  /** Packaged self-input bought from market (POS / structure kits). */
  selfBuyQty: number
  missingPrice?: boolean
}

export interface ExpandPlanInput {
  template: ManufacturingPlanTemplate
  blueprints: BlueprintInfo[]
  typeMap: Map<number, TypeInfo>
  prices: Map<number, number>
  settings: GlobalSettings
  systemCostIndex: number
  reactionCostIndex: number
  systems?: SystemInfo[]
}

export interface ExpandPlanResult {
  nodes: PlanNode[]
  slots: number
  scienceSlots: number
  windowHours: number
  missingPriceTypeIds: number[]
  warnings: { productTypeId: number; message: string }[]
}

function modeOverridesMap(template: ManufacturingPlanTemplate): Map<number, PlanBuildMode> {
  return new Map(Object.entries(template.modeOverrides).map(([k, v]) => [Number(k), v]))
}

/** Whether a material can be built in-plan (has recipe and facility allows it). */
function canBuildMaterial(
  subBp: BlueprintInfo | undefined,
  typeId: number,
  settings: GlobalSettings,
  depth: number,
  maxDepth: number,
): boolean {
  if (!subBp || isRawMaterial(typeId) || depth >= maxDepth) return false
  if (isReactionRecipe(subBp) && !canRunReactionJobs(settings)) return false
  return true
}

/**
 * Resolve buy vs build. Missing buy price forces build when possible.
 * Returns missingPrice=true when neither buy nor build can price the item.
 */
function resolveBuildBuyMode(args: {
  override: PlanBuildMode | undefined
  forceBuild: boolean | undefined
  unitPrice: number
  buyCost: number
  buildCost: number
  canBuild: boolean
}): { mode: PlanBuildMode; missingPrice: boolean } {
  const { override, forceBuild, unitPrice, buyCost, buildCost, canBuild } = args
  if (override === 'buy') {
    return { mode: 'buy', missingPrice: unitPrice <= 0 }
  }
  if (override === 'build') {
    return { mode: 'build', missingPrice: false }
  }
  if (unitPrice <= 0) {
    if (canBuild) return { mode: 'build', missingPrice: false }
    return { mode: 'buy', missingPrice: true }
  }
  if (forceBuild) return { mode: 'build', missingPrice: false }
  return { mode: buildCost <= buyCost ? 'build' : 'buy', missingPrice: false }
}

export type BuildCostCache = Map<string, number>

export function createBuildCostCache(): BuildCostCache {
  return new Map()
}

function buildCostCacheKey(productTypeId: number, runs: number, depth: number): string {
  return `${productTypeId}\0${runs}\0${depth}`
}

function cachedBuildCost(
  cache: BuildCostCache | undefined,
  productTypeId: number,
  runs: number,
  depth: number,
): number | undefined {
  return cache?.get(buildCostCacheKey(productTypeId, runs, depth))
}

function storeBuildCost(
  cache: BuildCostCache | undefined,
  productTypeId: number,
  runs: number,
  depth: number,
  cost: number,
): void {
  cache?.set(buildCostCacheKey(productTypeId, runs, depth), cost)
}

/** Datacores and T1 copies needed to invent T2 BPCs for `runs` manufacturing runs. */
function computeInventionPrereqCost(
  blueprint: BlueprintInfo,
  runs: number,
  blueprints: BlueprintInfo[],
  typeMap: Map<number, TypeInfo>,
  prices: Map<number, number>,
  settings: GlobalSettings,
  systemCostIndex: number,
  reactionCostIndex: number,
  modeOverrides: Map<number, PlanBuildMode>,
  nodeOverrides: Record<number, PlanNodeOverride>,
  nodeMap: Map<number, NodeAccum>,
  depth: number,
  maxDepth: number,
  cache?: BuildCostCache,
  systems?: SystemInfo[],
): number {
  const inv = blueprint.invention
  if (!inv || blueprint.tier !== 't2') return 0

  const t1Bp = getBlueprintForBpo(blueprints, inv.t1BlueprintTypeId)
  const invCost = inventionBlueprintCostForSettings({
    blueprint,
    t1Blueprint: t1Bp,
    settings,
    prices,
    systems,
  })
  if (!invCost) return 0
  const attempts = Math.max(
    1,
    Math.ceil(runs / Math.max(1, invCost.expectedRunsPerAttempt)),
  )

  let cost = invCost.attemptCost * attempts
  if (!t1Bp || depth >= maxDepth) return cost

  const t1Runs = attempts
  const buildCost = computePlanBuildCostForRuns(
    t1Bp,
    t1Runs,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    modeOverrides,
    nodeOverrides,
    nodeMap,
    depth + 1,
    maxDepth,
    cache,
    systems,
  )
  const buyCost = (prices.get(t1Bp.productTypeId) ?? 0) * t1Runs
  const override = modeOverrides.get(t1Bp.productTypeId)
  const mode: PlanBuildMode = override ?? (buildCost <= buyCost ? 'build' : 'buy')
  cost += mode === 'build' ? buildCost : buyCost

  return cost
}

/** Rolled-up build cost for a blueprint's runs using the plan's build/buy overrides. */
export function computePlanBuildCostForRuns(
  blueprint: BlueprintInfo,
  runs: number,
  blueprints: BlueprintInfo[],
  typeMap: Map<number, TypeInfo>,
  prices: Map<number, number>,
  settings: GlobalSettings,
  systemCostIndex: number,
  reactionCostIndex: number,
  modeOverrides: Map<number, PlanBuildMode>,
  nodeOverrides: Record<number, PlanNodeOverride>,
  nodeMap: Map<number, NodeAccum>,
  depth: number,
  maxDepth: number,
  cache?: BuildCostCache,
  systems?: SystemInfo[],
): number {
  const cached = cachedBuildCost(cache, blueprint.productTypeId, runs, depth)
  if (cached !== undefined) return cached

  const { me } = resolveBlueprintMeTe(
    blueprint.tier,
    settings,
    nodeOverrides[blueprint.productTypeId],
    blueprint,
  )
  const structure = resolveRecipeModifiers(settings, blueprint)
  const mfgSettings = { ...settings, batchSize: runs }
  const effectiveMe = isReactionRecipe(blueprint) ? 0 : me
  const mats = applyME(blueprint.materials, effectiveMe, runs, structure.meBonusPercent)
  const buyTotal = materialCost(mats, prices)
  const { capital: buildTotal } = totalManufacturingCost(
    blueprint,
    prices,
    mfgSettings,
    effectiveMe,
    systemCostIndex,
    reactionCostIndex,
  )

  let childBuild = 0
  for (const mat of mats) {
    const unitPrice = prices.get(mat.typeId) ?? 0
    const buyCost = unitPrice * mat.quantity
    if (mat.typeId === blueprint.productTypeId) {
      // Packaged self-input is charged separately in planProfit.packagedSelfBuyCost.
      continue
    }
    const subBp = getBlueprintForProduct(blueprints, mat.typeId)
    const override = modeOverrides.get(mat.typeId)

    if (!subBp || isRawMaterial(mat.typeId) || depth >= maxDepth) {
      childBuild += buyCost
      continue
    }

    if (isReactionRecipe(subBp) && !canRunReactionJobs(settings)) {
      childBuild += buyCost
      continue
    }

    const subRuns = runsForDemand(subBp.productQuantity, mat.quantity)
    const subBuildCost = computePlanBuildCostForRuns(
      subBp,
      subRuns,
      blueprints,
      typeMap,
      prices,
      settings,
      systemCostIndex,
      reactionCostIndex,
      modeOverrides,
      nodeOverrides,
      nodeMap,
      depth + 1,
      maxDepth,
      cache,
      systems,
    )
    const mode: PlanBuildMode = override ?? (subBuildCost <= buyCost ? 'build' : 'buy')
    childBuild += mode === 'build' ? subBuildCost : buyCost
  }

  const inventionCost = computeInventionPrereqCost(
    blueprint,
    runs,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    modeOverrides,
    nodeOverrides,
    nodeMap,
    depth,
    maxDepth,
    cache,
    systems,
  )

  const total = childBuild + (buildTotal - buyTotal) + inventionCost
  storeBuildCost(cache, blueprint.productTypeId, runs, depth, total)
  return total
}

function ensureNode(
  nodeMap: Map<number, NodeAccum>,
  productTypeId: number,
  typeMap: Map<number, TypeInfo>,
  blueprint?: BlueprintInfo,
): NodeAccum {
  let node = nodeMap.get(productTypeId)
  if (!node) {
    node = {
      productTypeId,
      name: typeMap.get(productTypeId)?.name ?? `Type ${productTypeId}`,
      tier: blueprint?.tier,
      blueprint,
      mode: 'build',
      demandByParent: [],
      parentProductTypeIds: new Set(),
      childProductTypeIds: new Set(),
      isRoot: false,
      isLeaf: true,
      depth: 0,
      selfBuyQty: 0,
    }
    nodeMap.set(productTypeId, node)
  }
  if (blueprint) node.blueprint = blueprint
  return node
}

function addDemand(
  node: NodeAccum,
  parentProductTypeId: number,
  qty: number,
  depth: number,
): void {
  const existing = node.demandByParent.find((d) => d.parentProductTypeId === parentProductTypeId)
  if (existing) existing.qty += qty
  else node.demandByParent.push({ parentProductTypeId, qty })
  node.parentProductTypeIds.add(parentProductTypeId)
  node.depth = Math.max(node.depth, depth)
  node.isLeaf = false
}

function expandInventionPrereqs(
  blueprint: BlueprintInfo,
  runs: number,
  input: ExpandPlanInput,
  nodeMap: Map<number, NodeAccum>,
  modeOverrides: Map<number, PlanBuildMode>,
  maxDepth: number,
  cache: BuildCostCache,
): void {
  const inv = blueprint.invention
  if (!inv || blueprint.tier !== 't2') return

  const { settings, blueprints, typeMap, prices, systemCostIndex, reactionCostIndex, systems } = input
  const t1ForFees = getBlueprintForBpo(blueprints, inv.t1BlueprintTypeId)
  const invCost = inventionBlueprintCostForSettings({
    blueprint,
    t1Blueprint: t1ForFees,
    settings,
    prices,
    systems,
  })
  if (!invCost) return
  const attempts = Math.max(
    1,
    Math.ceil(runs / Math.max(1, invCost.expectedRunsPerAttempt)),
  )

  const parentNode = ensureNode(nodeMap, blueprint.productTypeId, typeMap, blueprint)
  for (const dc of inv.datacores) {
    const leaf = ensureNode(nodeMap, dc.typeId, typeMap)
    leaf.mode = 'buy'
    leaf.isLeaf = true
    const unitPrice = prices.get(dc.typeId) ?? 0
    if (unitPrice <= 0) leaf.missingPrice = true
    addDemand(leaf, blueprint.productTypeId, dc.quantity * attempts, parentNode.depth + 1)
    parentNode.childProductTypeIds.add(dc.typeId)
  }

  const t1Bp = getBlueprintForBpo(blueprints, inv.t1BlueprintTypeId)
  if (!t1Bp || maxDepth <= 0) return

  const t1Runs = attempts
  const buildCost = computePlanBuildCostForRuns(
    t1Bp,
    t1Runs,
    blueprints,
    typeMap,
    prices,
    settings,
    systemCostIndex,
    reactionCostIndex,
    modeOverrides,
    input.template.nodeOverrides,
    nodeMap,
    parentNode.depth + 1,
    maxDepth,
    cache,
    systems,
  )
  const unitPrice = prices.get(t1Bp.productTypeId) ?? 0
  const buyCost = unitPrice * t1Runs
  const override = modeOverrides.get(t1Bp.productTypeId)
  const { mode, missingPrice } = resolveBuildBuyMode({
    override,
    forceBuild: undefined,
    unitPrice,
    buyCost,
    buildCost,
    canBuild: canBuildMaterial(t1Bp, t1Bp.productTypeId, settings, parentNode.depth + 1, maxDepth),
  })

  const child = ensureNode(nodeMap, t1Bp.productTypeId, typeMap, t1Bp)
  child.mode = mode
  if (missingPrice) child.missingPrice = true
  addDemand(child, blueprint.productTypeId, t1Runs, parentNode.depth + 1)
  parentNode.childProductTypeIds.add(t1Bp.productTypeId)

  if (mode === 'build') {
    expandMaterials(t1Bp, t1Runs, blueprint.productTypeId, parentNode.depth + 1, input, nodeMap, modeOverrides, maxDepth, cache)
  } else {
    child.isLeaf = true
  }
}

function expandMaterials(
  blueprint: BlueprintInfo,
  runs: number,
  parentProductTypeId: number,
  depth: number,
  input: ExpandPlanInput,
  nodeMap: Map<number, NodeAccum>,
  modeOverrides: Map<number, PlanBuildMode>,
  maxDepth: number,
  cache: BuildCostCache,
): void {
  const { settings, blueprints, typeMap, prices, systemCostIndex, reactionCostIndex, template } = input
  const { me } = resolveBlueprintMeTe(
    blueprint.tier,
    settings,
    template.nodeOverrides[blueprint.productTypeId],
    blueprint,
  )
  const structure = resolveRecipeModifiers(settings, blueprint)
  const effectiveMe = isReactionRecipe(blueprint) ? 0 : me
  const mats = applyME(blueprint.materials, effectiveMe, runs, structure.meBonusPercent)
  const parentNode = ensureNode(nodeMap, blueprint.productTypeId, typeMap, blueprint)

  if (blueprint.tier === 't2' && blueprint.invention) {
    expandInventionPrereqs(blueprint, runs, input, nodeMap, modeOverrides, maxDepth, cache)
  }

  for (const mat of mats) {
    if (mat.typeId === blueprint.productTypeId) {
      parentNode.selfBuyQty += mat.quantity
      continue
    }

    const subBp = getBlueprintForProduct(blueprints, mat.typeId)
    const unitPrice = prices.get(mat.typeId) ?? 0
    const buyCost = unitPrice * mat.quantity
    const override = modeOverrides.get(mat.typeId)
    const canBuild = canBuildMaterial(subBp, mat.typeId, settings, depth, maxDepth)

    if (!canBuild) {
      const leaf = ensureNode(nodeMap, mat.typeId, typeMap, subBp)
      if (!leaf.isRoot) leaf.mode = 'buy'
      leaf.isLeaf = true
      if (unitPrice <= 0) leaf.missingPrice = true
      addDemand(leaf, blueprint.productTypeId, mat.quantity, depth + 1)
      parentNode.childProductTypeIds.add(mat.typeId)
      continue
    }

    const subRuns = runsForDemand(subBp!.productQuantity, mat.quantity)
    const subBuildCost = computePlanBuildCostForRuns(
      subBp!,
      subRuns,
      blueprints,
      typeMap,
      prices,
      settings,
      systemCostIndex,
      reactionCostIndex,
      modeOverrides,
      template.nodeOverrides,
      nodeMap,
      depth + 1,
      maxDepth,
      cache,
      input.systems,
    )
    const forceBuild = input.template.nodeOverrides[mat.typeId]?.forceInclude
    const { mode, missingPrice } = resolveBuildBuyMode({
      override,
      forceBuild,
      unitPrice,
      buyCost,
      buildCost: subBuildCost,
      canBuild: true,
    })

    const child = ensureNode(nodeMap, mat.typeId, typeMap, subBp)
    child.mode = mode
    if (missingPrice) child.missingPrice = true
    addDemand(child, blueprint.productTypeId, mat.quantity, depth + 1)
    parentNode.childProductTypeIds.add(mat.typeId)

    if (mode === 'build') {
      expandMaterials(subBp!, subRuns, blueprint.productTypeId, depth + 1, input, nodeMap, modeOverrides, maxDepth, cache)
    } else {
      child.isLeaf = true
    }
  }
}

function finalizeNodes(
  nodeMap: Map<number, NodeAccum>,
  template: ManufacturingPlanTemplate,
  settings: GlobalSettings,
  slots: number,
  input: ExpandPlanInput,
  modeOverrides: Map<number, PlanBuildMode>,
  cache: BuildCostCache,
): PlanNode[] {
  const { blueprints, typeMap, prices, systemCostIndex, reactionCostIndex } = input
  const nodes: PlanNode[] = []
  const rootRunsTotal = totalRootRuns(template.roots.map((r) => r.runs))
  const rootDuplicateCounts = new Map<number, number>()
  for (const root of template.roots) {
    rootDuplicateCounts.set(
      root.productTypeId,
      (rootDuplicateCounts.get(root.productTypeId) ?? 0) + 1,
    )
  }

  for (const accum of nodeMap.values()) {
    const totalDemandQty = accum.demandByParent.reduce((s, d) => s + d.qty, 0)
    const blueprint = accum.blueprint
    const override = template.nodeOverrides[accum.productTypeId]

    let runs = accum.isRoot && blueprint
      ? template.roots
          .filter((r) => r.productTypeId === accum.productTypeId)
          .reduce((s, r) => s + r.runs, 0) || MIN_BATCH_SIZE
      : blueprint
        ? runsForDemand(blueprint.productQuantity, totalDemandQty)
        : 0

    if (override?.runs != null) runs = override.runs

    const runsPerBpc = blueprint
      ? override?.runsPerBpc ?? defaultRunsPerBpc(blueprint, template.defaultRunsPerBpc)
      : template.defaultRunsPerBpc

    const bpcCount = blueprint && accum.mode === 'build' ? bpcCountForRuns(runs, runsPerBpc) : 0
    const concurrent =
      override?.copies ??
      (accum.mode === 'build'
        ? activeConcurrentCopies(
            accum.isRoot,
            bpcCount,
            slots,
            rootRunsTotal,
            rootDuplicateCounts.get(accum.productTypeId) ?? 1,
          )
        : 0)

    const meTe = blueprint
      ? resolveBlueprintMeTe(blueprint.tier, settings, override, blueprint)
      : { me: settings.meDefault, te: settings.teDefault, locked: false }
    const jobTimeSeconds =
      blueprint && accum.mode === 'build'
        ? jobTimeSecondsForRuns(
            blueprint,
            settings,
            runs,
            concurrent,
            override,
          )
        : 0

    const outputQty = blueprint ? runs * blueprint.productQuantity : totalDemandQty
    // Roots are always built; buy vs build is only for supply-chain intermediates.
    const canToggle = !!(blueprint && !accum.isRoot && !isRawMaterial(accum.productTypeId))

    const unitPrice = prices.get(accum.productTypeId) ?? 0

    let buyCost: number | undefined
    let buildCost: number | undefined
    let savings: number | undefined
    let recommendedMode: PlanBuildMode | undefined

    if (canToggle && blueprint && runs > 0) {
      const demandQty = accum.isRoot ? outputQty : totalDemandQty
      buyCost = unitPrice * demandQty
      buildCost = computePlanBuildCostForRuns(
        blueprint,
        runs,
        blueprints,
        typeMap,
        prices,
        settings,
        systemCostIndex,
        reactionCostIndex,
        modeOverrides,
        template.nodeOverrides,
        nodeMap,
        accum.depth,
        10,
        cache,
        input.systems,
      )
      savings = buyCost - buildCost
      recommendedMode =
        unitPrice <= 0 ? 'build' : buildCost <= buyCost ? 'build' : 'buy'
    } else if (accum.mode === 'buy' && unitPrice > 0) {
      buyCost = unitPrice * totalDemandQty
    }

    nodes.push({
      productTypeId: accum.productTypeId,
      name: accum.name,
      tier: accum.tier,
      recipeKind: blueprint?.kind ?? (blueprint ? 'manufacturing' : undefined),
      mode: accum.mode,
      totalDemandQty: accum.isRoot ? outputQty : totalDemandQty,
      demandByParent: [...accum.demandByParent],
      parentProductTypeIds: [...accum.parentProductTypeIds],
      childProductTypeIds: [...accum.childProductTypeIds],
      runs: accum.mode === 'buy' && accum.isRoot ? 0 : runs,
      bpcCount: accum.mode === 'buy' ? 0 : bpcCount,
      concurrentCopies: accum.mode === 'buy' ? 0 : concurrent,
      jobTimeSeconds: accum.mode === 'buy' ? 0 : jobTimeSeconds,
      outputQty: accum.isRoot && accum.mode === 'buy' ? outputQty : outputQty,
      isRoot: accum.isRoot,
      isLeaf: accum.isLeaf || accum.mode === 'buy',
      depth: accum.depth,
      canToggle,
      unitPrice: unitPrice > 0 ? unitPrice : undefined,
      buyCost,
      buildCost,
      savings,
      recommendedMode,
      packagedBuyQty: accum.selfBuyQty > 0 ? accum.selfBuyQty : undefined,
      me: blueprint && accum.mode === 'build' ? meTe.me : undefined,
      te: blueprint && accum.mode === 'build' ? meTe.te : undefined,
      meTeLocked: blueprint && accum.mode === 'build' ? meTe.locked : undefined,
    })
  }

  return nodes.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
}

/** Rolled-up build cost for a plan root using template build/buy overrides. */
export function computePlanRootBuildCost(
  blueprint: BlueprintInfo,
  runs: number,
  input: ExpandPlanInput,
  cache?: BuildCostCache,
): number {
  const modeOverrides = modeOverridesMap(input.template)
  const costCache = cache ?? createBuildCostCache()
  return computePlanBuildCostForRuns(
    blueprint,
    runs,
    input.blueprints,
    input.typeMap,
    input.prices,
    input.settings,
    input.systemCostIndex,
    input.reactionCostIndex,
    modeOverrides,
    input.template.nodeOverrides,
    new Map(),
    0,
    10,
    costCache,
    input.systems,
  )
}

export function expandManufacturingPlan(input: ExpandPlanInput): ExpandPlanResult {
  const template = templateWithActiveRoots(input.template)
  const { settings } = input
  const modeOverrides = modeOverridesMap(template)
  const nodeMap = new Map<number, NodeAccum>()
  const slots = manufacturingSlotsFromSkills(settings.skills)
  const scienceSlots = researchSlotsFromSkills(settings.skills)
  const buildCostCache = createBuildCostCache()

  for (const root of template.roots) {
    const blueprint = getBlueprintForProduct(input.blueprints, root.productTypeId)
    if (!blueprint) continue

    const node = ensureNode(nodeMap, root.productTypeId, input.typeMap, blueprint)
    node.isRoot = true
    node.depth = 0
    node.mode = 'build'
    node.isLeaf = false
    expandMaterials(blueprint, root.runs, root.productTypeId, 0, input, nodeMap, modeOverrides, 10, buildCostCache)
  }

  const windowFromRoots = template.roots.reduce((m, r) => {
    const blueprint = getBlueprintForProduct(input.blueprints, r.productTypeId)
    const hours = blueprint
      ? inGameDurationHoursFromRuns(
          blueprint,
          settings,
          r.runs,
          template.nodeOverrides[r.productTypeId],
        )
      : r.productionDurationHours
    return Math.max(m, hours)
  }, 0)
  const windowHours = Math.max(windowFromRoots, 1)

  const nodes = finalizeNodes(nodeMap, template, settings, slots, input, modeOverrides, buildCostCache)
  const missingPriceTypeIds: number[] = []
  const warnings: { productTypeId: number; message: string }[] = []
  for (const accum of nodeMap.values()) {
    if (!accum.missingPrice) continue
    missingPriceTypeIds.push(accum.productTypeId)
    warnings.push({
      productTypeId: accum.productTypeId,
      message: `${accum.name}: no hub sell price (cannot buy; ${accum.blueprint ? 'forced build or blocked' : 'must buy'})`,
    })
  }

  return {
    nodes,
    slots,
    scienceSlots,
    windowHours,
    missingPriceTypeIds,
    warnings,
  }
}
