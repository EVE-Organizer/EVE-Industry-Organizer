import { applyCopyTime, applyInventionTime, inventionBlueprintCostForSettings } from '@/lib/cost'
import { resolveScienceModifiers } from '@/lib/facilityModifiers'
import { durationHoursFromRuns } from '@/lib/rootRunsDuration'
import { defaultScienceFacility } from '@/types'
import type {
  BlueprintInfo,
  GlobalSettings,
  PlanNode,
  PlanNodeOverride,
  PlanRootEntry,
} from '@/types'
import { getBlueprintForProduct } from '@/services/data/sdeLoader'

export interface PlanSlotCounts {
  manufacturing: number
  reactions: number
  research: number
}

export interface BlueprintLineSuggestion {
  /** Parallel BPO lines for manufacture / reaction. */
  copies?: number
  /** T1 BPO lines for copy jobs before T2 manufacture. */
  copyBpos?: number
  /** Invention wall time exceeds target; more BPOs will not help. */
  inventionBottleneck?: boolean
}

function poolSlotsForNode(node: PlanNode, slots: PlanSlotCounts): number {
  if (node.recipeKind === 'reaction') return slots.reactions
  return slots.manufacturing
}

/** Shortest root job wall time (hours) among enabled roots that need this product in the chain. */
export function targetHoursForComponent(input: {
  productTypeId: number
  roots: PlanRootEntry[]
  nodes: PlanNode[]
  blueprints: BlueprintInfo[]
  settings: GlobalSettings
  nodeOverrides: Record<number, PlanNodeOverride>
}): number | null {
  const { productTypeId, roots, nodes, blueprints, settings, nodeOverrides } = input
  const nodeById = new Map(nodes.map((n) => [n.productTypeId, n]))

  function chainNeedsProduct(rootProductId: number): boolean {
    if (rootProductId === productTypeId) return true
    const visited = new Set<number>()
    const stack = [rootProductId]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (id === productTypeId) return true
      if (visited.has(id)) continue
      visited.add(id)
      const node = nodeById.get(id)
      if (!node) continue
      for (const childId of node.childProductTypeIds) stack.push(childId)
    }
    return false
  }

  let best: number | null = null
  for (const root of roots) {
    if (root.enabled === false) continue
    if (!chainNeedsProduct(root.productTypeId)) continue
    const bp = getBlueprintForProduct(blueprints, root.productTypeId)
    if (!bp) continue
    const override = nodeOverrides[root.productTypeId]
    const hours = durationHoursFromRuns(bp, settings, root.runs, 1, override)
    if (hours <= 0) continue
    if (best == null || hours < best) best = hours
  }
  return best
}

export function suggestLinesForStageHours(
  hoursAtOneLine: number,
  targetHours: number,
  poolSlots: number,
): number {
  if (hoursAtOneLine <= 0 || targetHours <= 0) return 1
  if (hoursAtOneLine <= targetHours + 1 / 3600) return 1
  const raw = Math.ceil(hoursAtOneLine / targetHours)
  return Math.min(Math.max(1, poolSlots), raw)
}

function copyStageHours(
  blueprint: BlueprintInfo,
  manufactureRuns: number,
  settings: GlobalSettings,
  prices: Map<number, number>,
): number {
  const inv = blueprint.invention
  if (!inv) return 0
  const invCost = inventionBlueprintCostForSettings({ blueprint, settings, prices })
  if (!invCost) return 0
  const attempts = Math.max(
    1,
    Math.ceil(manufactureRuns / Math.max(1, invCost.expectedRunsPerAttempt)),
  )
  const copySeconds = inv.copyTime ?? 0
  if (copySeconds <= 0 || attempts <= 0) return 0
  const copyMods = resolveScienceModifiers(
    settings.copyFacility ?? defaultScienceFacility(settings.manufacturingSystemId),
  )
  const science = settings.skills.science ?? 0
  const advancedIndustry = settings.skills.advancedIndustry ?? 0
  const perCopyHours =
    applyCopyTime(copySeconds, 1, science, advancedIndustry, copyMods.teBonusPercent) / 3600
  return perCopyHours * attempts
}

function inventionStageHours(
  blueprint: BlueprintInfo,
  manufactureRuns: number,
  settings: GlobalSettings,
  prices: Map<number, number>,
  scienceSlots: number,
): number {
  const inv = blueprint.invention
  if (!inv) return 0
  const invCost = inventionBlueprintCostForSettings({ blueprint, settings, prices })
  if (!invCost) return 0
  const attempts = Math.max(
    1,
    Math.ceil(manufactureRuns / Math.max(1, invCost.expectedRunsPerAttempt)),
  )
  const inventSeconds = inv.inventionTime ?? 0
  if (inventSeconds <= 0 || attempts <= 0) return 0
  const inventMods = resolveScienceModifiers(
    settings.inventionFacility ?? defaultScienceFacility(settings.manufacturingSystemId),
  )
  const advancedIndustry = settings.skills.advancedIndustry ?? 0
  const perAttemptHours =
    applyInventionTime(inventSeconds, 1, advancedIndustry, inventMods.teBonusPercent) / 3600
  const slots = Math.max(1, scienceSlots)
  return (perAttemptHours * attempts) / slots
}

/** Suggested BPO counts for one build-mode chain node (does not overwrite user overrides). */
export function suggestBlueprintLines(input: {
  node: PlanNode
  blueprint: BlueprintInfo
  settings: GlobalSettings
  roots: PlanRootEntry[]
  nodes: PlanNode[]
  blueprints: BlueprintInfo[]
  nodeOverrides: Record<number, PlanNodeOverride>
  slots: PlanSlotCounts
  prices?: Map<number, number>
}): BlueprintLineSuggestion | null {
  const {
    node,
    blueprint,
    settings,
    roots,
    nodes,
    blueprints,
    nodeOverrides,
    slots,
    prices = new Map(),
  } = input
  if (node.mode !== 'build' || node.isRoot || node.runs <= 0) return null

  const target = targetHoursForComponent({
    productTypeId: node.productTypeId,
    roots,
    nodes,
    blueprints,
    settings,
    nodeOverrides,
  })
  if (target == null) return null

  const override = nodeOverrides[node.productTypeId]
  const hoursAtOne = durationHoursFromRuns(blueprint, settings, node.runs, 1, override)
  const pool = poolSlotsForNode(node, slots)
  const copies = suggestLinesForStageHours(hoursAtOne, target, pool)

  const out: BlueprintLineSuggestion = { copies }

  const isT2 = blueprint.tier === 't2' && blueprint.invention
  if (isT2 && !override?.haveBpcs) {
    const copyHours = copyStageHours(blueprint, node.runs, settings, prices)
    if (copyHours > 0) {
      out.copyBpos = suggestLinesForStageHours(copyHours, target, slots.research)
    }
    const inventHours = inventionStageHours(blueprint, node.runs, settings, prices, slots.research)
    if (inventHours > target + 1 / 3600) out.inventionBottleneck = true
  }

  return out
}
