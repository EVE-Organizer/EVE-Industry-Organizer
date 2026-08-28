import type {
  BlueprintInfo,
  GlobalSettings,
  PlanNode,
  PlanNodeOverride,
  PlanRootEntry,
} from '@/types'
import { DEFAULT_BATCH_SIZE } from '@/types'
import {
  applyReactionTime,
  applyTE,
  manufacturingTimePerRun,
  reactionTimePerRun,
  resolveBlueprintMeTe,
  runsForJobTime,
} from '@/lib/cost'
import { resolveRecipeModifiers } from '@/lib/facilityModifiers'
import { isReactionRecipe } from '@/lib/recipes'
import { skillLevel } from '@/lib/skillFields'
import { activeConcurrentCopies } from '@/lib/supplyChainSlots'

/** One industry job = one in-game timer. Never multiply by Mass Production slots. */
export const IN_GAME_JOB_LINES = 1

function skillTimeLevels(settings: GlobalSettings): { industry: number; advancedIndustry: number } {
  return {
    industry: skillLevel(settings.skills, 'industry'),
    advancedIndustry: skillLevel(settings.skills, 'advancedIndustry'),
  }
}

function structureTeForBlueprint(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
): number {
  const structure = resolveRecipeModifiers(settings, blueprint)
  return structure.teBonusPercent
}

/** Manufacturing runs needed to satisfy material demand (matches in-game run count). */
export function runsForDemand(productQuantity: number, demandQty: number): number {
  if (productQuantity <= 0 || demandQty <= 0) return 1
  return Math.max(1, Math.ceil(demandQty / productQuantity))
}

/** In-game job timer for one manufacturing job at this node. */
export function jobTimeSecondsForRuns(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  runs: number,
  concurrentCopies: number,
  meTeOverride?: PlanNodeOverride,
): number {
  if (runs <= 0) return 0
  const structureTe = structureTeForBlueprint(blueprint, settings)
  const lines = Math.max(1, concurrentCopies)
  const runsPerJob = Math.max(1, Math.ceil(runs / Math.min(lines, runs)))

  if (isReactionRecipe(blueprint)) {
    const reactions = skillLevel(settings.skills, 'reactions')
    return applyReactionTime(
      blueprint.manufacturingTime,
      runsPerJob,
      reactions,
      structureTe,
    )
  }

  const { te } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride, blueprint)
  const { industry, advancedIndustry } = skillTimeLevels(settings)
  return applyTE(
    blueprint.manufacturingTime,
    te,
    runsPerJob,
    industry,
    advancedIndustry,
    structureTe,
    blueprint.requiredSkills,
    settings.skills,
  )
}

export function runsFromDurationHours(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  durationHours: number,
  parallelLines: number,
  meTeOverride?: PlanNodeOverride,
): number {
  const structureTe = structureTeForBlueprint(blueprint, settings)
  const availableSec = Math.max(0, durationHours) * 3600
  const lines = Math.max(1, parallelLines)
  if (availableSec <= 0) return 1

  if (isReactionRecipe(blueprint)) {
    const reactions = skillLevel(settings.skills, 'reactions')
    const perRun = reactionTimePerRun(
      blueprint.manufacturingTime,
      reactions,
      structureTe,
    )
    if (perRun <= 0) return 1
    const reactionRunsPerLine = Math.max(1, Math.floor(availableSec / perRun))
    return Math.max(1, reactionRunsPerLine * lines)
  }

  const { te } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride, blueprint)
  const { industry, advancedIndustry } = skillTimeLevels(settings)

  const runsPerLine = runsForJobTime(
    availableSec,
    blueprint.manufacturingTime,
    te,
    industry,
    advancedIndustry,
    structureTe,
    { step: 1, maxRuns: null },
  )
  return Math.max(1, runsPerLine * lines)
}

/** Runs that fit in one in-game manufacturing job (single timer, one slot). */
export function inGameRunsFromDurationHours(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  durationHours: number,
  meTeOverride?: PlanNodeOverride,
): number {
  return runsFromDurationHours(
    blueprint,
    settings,
    durationHours,
    IN_GAME_JOB_LINES,
    meTeOverride,
  )
}

/** Shrink runs so this product's ready-by time fits `deadlineHours`. Never grows. */
export function scaleRunsToSlotDeadline(
  currentRuns: number,
  currentReadyHours: number,
  deadlineHours: number,
): number {
  if (currentRuns <= 1 || deadlineHours <= 0) return Math.max(1, currentRuns)
  if (currentReadyHours <= deadlineHours + 1 / 3600) return currentRuns
  return Math.max(1, Math.floor(currentRuns * (deadlineHours / currentReadyHours)))
}

export function descendantProductIds(
  rootProductTypeId: number,
  nodes: Array<Pick<PlanNode, 'productTypeId' | 'childProductTypeIds'>>,
): Set<number> {
  const byId = new Map(nodes.map((n) => [n.productTypeId, n] as const))
  const out = new Set<number>()
  const stack = [...(byId.get(rootProductTypeId)?.childProductTypeIds ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    for (const child of byId.get(id)?.childProductTypeIds ?? []) stack.push(child)
  }
  return out
}

/** Fit each targeted root so that product is ready by its own deadline. Runs never grow. */
export function fitPlanToRootReadyDeadlines(input: {
  roots: PlanRootEntry[]
  targets: Array<{ rootId: string; deadlineHours: number }>
  readyHoursByProductId: Map<number, number>
  nodes: Array<Pick<PlanNode, 'productTypeId' | 'childProductTypeIds' | 'isRoot' | 'mode'>>
  nodeOverrides: Record<number, PlanNodeOverride>
  settings: GlobalSettings
  getBlueprint: (productTypeId: number) => BlueprintInfo | undefined
}): { roots: PlanRootEntry[]; nodeOverrides: Record<number, PlanNodeOverride> } {
  const { roots, targets, readyHoursByProductId, nodes, settings, getBlueprint } = input
  if (targets.length === 0) return { roots, nodeOverrides: input.nodeOverrides }

  const deadlineByRootId = new Map(targets.map((t) => [t.rootId, t.deadlineHours]))
  const ratioByRootId = new Map<string, number>()
  const descendantsByRootId = new Map<string, Set<number>>()

  const nextRoots = roots.map((root) => {
    const deadlineHours = deadlineByRootId.get(root.id)
    if (deadlineHours == null || deadlineHours <= 0) return root
    descendantsByRootId.set(root.id, descendantProductIds(root.productTypeId, nodes))
    const readyHours = readyHoursByProductId.get(root.productTypeId) ?? 0
    const runs = scaleRunsToSlotDeadline(root.runs, readyHours, deadlineHours)
    ratioByRootId.set(root.id, runs / Math.max(1, root.runs))
    if (runs === root.runs) return root
    return applyRootEntryPatch(
      root,
      { runs },
      getBlueprint(root.productTypeId),
      settings,
      input.nodeOverrides[root.productTypeId],
    )
  })

  const nodeOverrides = { ...input.nodeOverrides }
  for (const [id, override] of Object.entries(nodeOverrides)) {
    if (override.runs == null) continue
    const productTypeId = Number(id)
    const node = nodes.find((n) => n.productTypeId === productTypeId)
    if (!node || node.isRoot || node.mode !== 'build') continue

    let seen = false
    let maxRatio = 0
    for (const [rootId, descendants] of descendantsByRootId) {
      if (!descendants.has(productTypeId)) continue
      seen = true
      maxRatio = Math.max(maxRatio, ratioByRootId.get(rootId) ?? 1)
    }
    if (!seen) continue
    // ponytail: shared pins keep the least-shrink ratio so another root is not starved
    const runs = Math.max(1, Math.floor(override.runs * maxRatio))
    if (runs === override.runs) continue
    nodeOverrides[productTypeId] = { ...override, runs }
  }

  return { roots: nextRoots, nodeOverrides }
}

/** Wall-clock hours to finish `runs` manufacturing runs (matches in-game job timer × waves). */
export function durationHoursFromRuns(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  runs: number,
  parallelLines: number,
  meTeOverride?: PlanNodeOverride,
): number {
  const structureTe = structureTeForBlueprint(blueprint, settings)
  const effectiveLines = Math.max(1, parallelLines)
  const runsPerJob = Math.max(1, Math.ceil(runs / Math.min(effectiveLines, runs)))

  if (isReactionRecipe(blueprint)) {
    const reactions = skillLevel(settings.skills, 'reactions')
    const jobTime = applyReactionTime(
      blueprint.manufacturingTime,
      runsPerJob,
      reactions,
      structureTe,
    )
    if (jobTime <= 0 || runs <= 0) return 0
    const waves = Math.ceil(runs / (runsPerJob * effectiveLines))
    return (jobTime * waves) / 3600
  }

  const { te } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride, blueprint)
  const { industry, advancedIndustry } = skillTimeLevels(settings)
  const perRun = manufacturingTimePerRun(
    blueprint.manufacturingTime,
    te,
    industry,
    advancedIndustry,
    structureTe,
    blueprint.requiredSkills,
    settings.skills,
  )
  if (perRun <= 0 || runs <= 0) return 0

  const jobTime = applyTE(
    blueprint.manufacturingTime,
    te,
    runsPerJob,
    industry,
    advancedIndustry,
    structureTe,
    blueprint.requiredSkills,
    settings.skills,
  )
  const waves = Math.ceil(runs / (runsPerJob * effectiveLines))
  return (jobTime * waves) / 3600
}

/** Root job time matching the in-game industry window (one job, one timer). */
export function rootJobTimeHours(
  root: PlanRootEntry,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  meTeOverride?: PlanNodeOverride,
): number {
  if (!blueprint || root.runs <= 0) return root.productionDurationHours
  return durationHoursFromRuns(
    blueprint,
    settings,
    root.runs,
    IN_GAME_JOB_LINES,
    meTeOverride,
  )
}

export function inGameDurationHoursFromRuns(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  runs: number,
  meTeOverride?: PlanNodeOverride,
): number {
  return durationHoursFromRuns(blueprint, settings, runs, IN_GAME_JOB_LINES, meTeOverride)
}

export function defaultRunsPerBpc(blueprint: BlueprintInfo, templateDefault: number): number {
  if (blueprint.tier === 't2' && blueprint.invention?.runsPerBPC) {
    return blueprint.invention.runsPerBPC
  }
  return templateDefault
}

/** Parallel industry lines for a root entry (always 1 unless copies override). */
export function parallelLinesForRoot(
  blueprint: BlueprintInfo,
  root: PlanRootEntry,
  skillSlots: number,
  rootRunsTotal: number,
  defaultRunsPerBpcTemplate: number,
  nodeOverride?: PlanNodeOverride,
): number {
  if (nodeOverride?.copies != null) return nodeOverride.copies
  const runsPerBpc = nodeOverride?.runsPerBpc ?? defaultRunsPerBpc(blueprint, defaultRunsPerBpcTemplate)
  const bpcCount = bpcCountForRuns(root.runs, runsPerBpc)
  return activeConcurrentCopies(true, bpcCount, skillSlots, rootRunsTotal)
}

/** Seed duration from runs when the user has not set one yet. Never overwrites a stored target. */
export function syncRootEntry(
  root: PlanRootEntry,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  meTeOverride?: PlanNodeOverride,
): PlanRootEntry {
  if (!blueprint || root.productionDurationHours > 0) return root
  const productionDurationHours = inGameDurationHoursFromRuns(
    blueprint,
    settings,
    root.runs,
    meTeOverride,
  )
  if (Math.abs(productionDurationHours) < 0.005) return root
  return { ...root, productionDurationHours }
}

export function createSyncedPlanRootEntry(
  productTypeId: number,
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  runs: number = DEFAULT_BATCH_SIZE,
): Omit<PlanRootEntry, 'id'> {
  const { id: _id, ...synced } = syncRootEntry(
    { id: '', productTypeId, runs, productionDurationHours: 0 },
    blueprint,
    settings,
  )
  return synced
}

/** Apply a runs or duration edit. User-entered duration is kept; only an explicit duration patch replaces it. */
export function applyRootEntryPatch(
  root: PlanRootEntry,
  patch: Partial<PlanRootEntry>,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  meTeOverride?: PlanNodeOverride,
): PlanRootEntry {
  const next = { ...root, ...patch }
  if (!blueprint) return next

  if (patch.productionDurationHours != null && patch.runs == null) {
    next.runs = inGameRunsFromDurationHours(
      blueprint,
      settings,
      patch.productionDurationHours,
      meTeOverride,
    )
    next.productionDurationHours = patch.productionDurationHours
  }

  return next
}

export function bpcCountForRuns(runs: number, runsPerBpc: number): number {
  const per = Math.max(1, runsPerBpc)
  return Math.max(1, Math.ceil(runs / per))
}

/** Resolve runs after a runs or job-time edit. */
export function resolveRunsFromPatch(
  currentRuns: number,
  patch: { runs?: number; productionDurationHours?: number },
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  meTeOverride?: PlanNodeOverride,
): number {
  if (patch.runs != null) return patch.runs
  if (patch.productionDurationHours != null && blueprint) {
    return inGameRunsFromDurationHours(
      blueprint,
      settings,
      patch.productionDurationHours,
      meTeOverride,
    )
  }
  return currentRuns
}
