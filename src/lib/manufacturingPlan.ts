import type {
  BlueprintInfo,
  GlobalSettings,
  ManufacturingPlanTemplate,
  PlanBuildMode,
  PlanNode,
  PlanNodeOverride,
} from '@/types'
import { MIN_BATCH_SIZE } from '@/types'
import {
  applyME,
  inventionBlueprintCostPerRun,
  materialCost,
  resolveBlueprintMeTe,
  resolveStructureModifiers,
  totalManufacturingCost,
} from '@/lib/cost'
import {
  bpcCountForRuns,
  defaultRunsPerBpc,
  inGameDurationHoursFromRuns,
  jobTimeSecondsForRuns,
  runsForDemand,
} from '@/lib/rootRunsDuration'
import { activeConcurrentCopies, duplicateRootCount, totalRootRuns } from '@/lib/supplyChainSlots'
import { manufacturingSlotsFromSkills } from '@/lib/manufacturingSlots'
import { getBlueprintForBpo, getBlueprintForProduct } from '@/services/data/sdeLoader'
import { isRawMaterial } from '@/lib/supplyChain'
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
}

export interface ExpandPlanInput {
  template: ManufacturingPlanTemplate
  blueprints: BlueprintInfo[]
  typeMap: Map<number, TypeInfo>
  prices: Map<number, number>
  settings: GlobalSettings
  systemCostIndex: number
}

export interface ExpandPlanResult {
  nodes: PlanNode[]
  slots: number
  windowHours: number
}

function modeOverridesMap(template: ManufacturingPlanTemplate): Map<number, PlanBuildMode> {
  return new Map(Object.entries(template.modeOverrides).map(([k, v]) => [Number(k), v]))
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
  modeOverrides: Map<number, PlanBuildMode>,
  nodeOverrides: Record<number, PlanNodeOverride>,
  nodeMap: Map<number, NodeAccum>,
  depth: number,
  maxDepth: number,
): number {
  const { me } = resolveBlueprintMeTe(
    blueprint.tier,
    settings,
    nodeOverrides[blueprint.productTypeId],
  )
  const structure = resolveStructureModifiers(settings)
  const mfgSettings = { ...settings, batchSize: runs }
  const mats = applyME(blueprint.materials, me, runs, structure.meBonusPercent)
  const buyTotal = materialCost(mats, prices)
  const { capital: buildTotal } = totalManufacturingCost(
    blueprint,
    prices,
    mfgSettings,
    me,
    systemCostIndex,
  )

  let childBuild = 0
  for (const mat of mats) {
    const unitPrice = prices.get(mat.typeId) ?? 0
    const buyCost = unitPrice * mat.quantity
    if (mat.typeId === blueprint.productTypeId) {
      childBuild += buyCost
      continue
    }
    const subBp = getBlueprintForProduct(blueprints, mat.typeId)
    const override = modeOverrides.get(mat.typeId)

    if (!subBp || isRawMaterial(mat.typeId) || depth >= maxDepth) {
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
      modeOverrides,
      nodeOverrides,
      nodeMap,
      depth + 1,
      maxDepth,
    )
    const mode: PlanBuildMode = override ?? (subBuildCost <= buyCost ? 'build' : 'buy')
    childBuild += mode === 'build' ? subBuildCost : buyCost
  }

  return childBuild + (buildTotal - buyTotal)
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
): void {
  const inv = blueprint.invention
  if (!inv || blueprint.tier !== 't2') return

  const { settings, blueprints, typeMap, prices, systemCostIndex } = input
  const invCost = inventionBlueprintCostPerRun({
    datacores: inv.datacores,
    prices,
    baseChance: inv.baseChance,
    runsPerBPC: inv.runsPerBPC,
    skillLevel: settings.inventionSkillLevel,
  })
  const attempts = Math.max(
    1,
    Math.ceil(runs / Math.max(1, invCost.expectedRunsPerAttempt)),
  )

  const parentNode = ensureNode(nodeMap, blueprint.productTypeId, typeMap, blueprint)
  for (const dc of inv.datacores) {
    const leaf = ensureNode(nodeMap, dc.typeId, typeMap)
    leaf.mode = 'buy'
    leaf.isLeaf = true
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
    modeOverrides,
    input.template.nodeOverrides,
    nodeMap,
    parentNode.depth + 1,
    maxDepth,
  )
  const unitPrice = prices.get(t1Bp.productTypeId) ?? 0
  const buyCost = unitPrice * t1Runs
  const override = modeOverrides.get(t1Bp.productTypeId)
  const mode: PlanBuildMode = override ?? (buildCost <= buyCost ? 'build' : 'buy')

  const child = ensureNode(nodeMap, t1Bp.productTypeId, typeMap, t1Bp)
  child.mode = mode
  addDemand(child, blueprint.productTypeId, t1Runs, parentNode.depth + 1)
  parentNode.childProductTypeIds.add(t1Bp.productTypeId)

  if (mode === 'build') {
    expandMaterials(t1Bp, t1Runs, blueprint.productTypeId, parentNode.depth + 1, input, nodeMap, modeOverrides, maxDepth)
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
): void {
  const { settings, blueprints, typeMap, prices, systemCostIndex, template } = input
  const { me } = resolveBlueprintMeTe(
    blueprint.tier,
    settings,
    template.nodeOverrides[blueprint.productTypeId],
  )
  const structure = resolveStructureModifiers(settings)
  const mats = applyME(blueprint.materials, me, runs, structure.meBonusPercent)
  const parentNode = ensureNode(nodeMap, blueprint.productTypeId, typeMap, blueprint)

  if (blueprint.tier === 't2' && blueprint.invention) {
    expandInventionPrereqs(blueprint, runs, input, nodeMap, modeOverrides, maxDepth)
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

    if (!subBp || isRawMaterial(mat.typeId) || depth >= maxDepth) {
      const leaf = ensureNode(nodeMap, mat.typeId, typeMap)
      if (!leaf.isRoot) leaf.mode = 'buy'
      leaf.isLeaf = true
      addDemand(leaf, blueprint.productTypeId, mat.quantity, depth + 1)
      parentNode.childProductTypeIds.add(mat.typeId)
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
      modeOverrides,
      template.nodeOverrides,
      nodeMap,
      depth + 1,
      maxDepth,
    )
    const forceBuild = input.template.nodeOverrides[mat.typeId]?.forceInclude
    const mode: PlanBuildMode =
      override ?? (forceBuild ? 'build' : subBuildCost <= buyCost ? 'build' : 'buy')

    const child = ensureNode(nodeMap, mat.typeId, typeMap, subBp)
    child.mode = mode
    addDemand(child, blueprint.productTypeId, mat.quantity, depth + 1)
    parentNode.childProductTypeIds.add(mat.typeId)

    if (mode === 'build') {
      expandMaterials(subBp, subRuns, blueprint.productTypeId, depth + 1, input, nodeMap, modeOverrides, maxDepth)
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
): PlanNode[] {
  const { blueprints, typeMap, prices, systemCostIndex } = input
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
      ? resolveBlueprintMeTe(blueprint.tier, settings, override)
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
    const canToggle = !!(blueprint && !isRawMaterial(accum.productTypeId) && !accum.isRoot)

    const unitPrice = prices.get(accum.productTypeId) ?? 0

    let buyCost: number | undefined
    let buildCost: number | undefined
    let savings: number | undefined
    let recommendedMode: PlanBuildMode | undefined

    if (canToggle && blueprint && runs > 0) {
      buyCost = unitPrice * totalDemandQty
      buildCost = computePlanBuildCostForRuns(
        blueprint,
        runs,
        blueprints,
        typeMap,
        prices,
        settings,
        systemCostIndex,
        modeOverrides,
        template.nodeOverrides,
        nodeMap,
        accum.depth,
        10,
      )
      savings = buyCost - buildCost
      recommendedMode = buildCost <= buyCost ? 'build' : 'buy'
    } else if (accum.mode === 'buy' && unitPrice > 0) {
      buyCost = unitPrice * totalDemandQty
    }

    nodes.push({
      productTypeId: accum.productTypeId,
      name: accum.name,
      tier: accum.tier,
      mode: accum.mode,
      totalDemandQty: accum.isRoot ? outputQty : totalDemandQty,
      demandByParent: [...accum.demandByParent],
      parentProductTypeIds: [...accum.parentProductTypeIds],
      childProductTypeIds: [...accum.childProductTypeIds],
      runs,
      bpcCount,
      concurrentCopies: concurrent,
      jobTimeSeconds,
      outputQty,
      isRoot: accum.isRoot,
      isLeaf: accum.isLeaf,
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
): number {
  const modeOverrides = modeOverridesMap(input.template)
  return computePlanBuildCostForRuns(
    blueprint,
    runs,
    input.blueprints,
    input.typeMap,
    input.prices,
    input.settings,
    input.systemCostIndex,
    modeOverrides,
    input.template.nodeOverrides,
    new Map(),
    0,
    10,
  )
}

export function expandManufacturingPlan(input: ExpandPlanInput): ExpandPlanResult {
  const { template, settings } = input
  const modeOverrides = modeOverridesMap(template)
  const nodeMap = new Map<number, NodeAccum>()
  const slots = manufacturingSlotsFromSkills(settings.skills)

  for (const root of template.roots) {
    const blueprint = getBlueprintForProduct(input.blueprints, root.productTypeId)
    if (!blueprint) continue

    const node = ensureNode(nodeMap, root.productTypeId, input.typeMap, blueprint)
    node.isRoot = true
    node.mode = 'build'
    node.isLeaf = false
    node.depth = 0

    expandMaterials(blueprint, root.runs, root.productTypeId, 0, input, nodeMap, modeOverrides, 10)
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

  return {
    nodes: finalizeNodes(nodeMap, template, settings, slots, input, modeOverrides),
    slots,
    windowHours,
  }
}
