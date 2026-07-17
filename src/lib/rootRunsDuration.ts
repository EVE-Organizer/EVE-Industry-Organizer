import type { BlueprintInfo, GlobalSettings, PlanNodeOverride, PlanRootEntry } from '@/types'
import { DEFAULT_BATCH_SIZE } from '@/types'
import {
  applyTE,
  manufacturingTimePerRun,
  resolveBlueprintMeTe,
  resolveStructureModifiers,
  runsForJobTime,
} from '@/lib/cost'
import { activeConcurrentCopies } from '@/lib/supplyChainSlots'

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
  const { te } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride)
  const structure = resolveStructureModifiers(settings)
  const advanced = settings.skills.advancedIndustry ?? 0
  const lines = Math.max(1, concurrentCopies)
  const runsPerJob = Math.max(1, Math.ceil(runs / Math.min(lines, runs)))
  return applyTE(
    blueprint.manufacturingTime,
    te,
    runsPerJob,
    advanced,
    structure.teBonusPercent,
  )
}

export function runsFromDurationHours(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  durationHours: number,
  parallelLines: number,
  meTeOverride?: PlanNodeOverride,
): number {
  const { te } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride)
  const structure = resolveStructureModifiers(settings)
  const advanced = settings.skills.advancedIndustry ?? 0
  const availableSec = Math.max(0, durationHours) * 3600
  const lines = Math.max(1, parallelLines)
  if (availableSec <= 0) return 1

  const runsPerLine = runsForJobTime(
    availableSec,
    blueprint.manufacturingTime,
    te,
    advanced,
    structure.teBonusPercent,
    { step: 1, maxRuns: null },
  )
  return Math.max(1, runsPerLine * lines)
}

export function durationHoursFromRuns(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  runs: number,
  parallelLines: number,
  meTeOverride?: PlanNodeOverride,
): number {
  const { te } = resolveBlueprintMeTe(blueprint.tier, settings, meTeOverride)
  const structure = resolveStructureModifiers(settings)
  const advanced = settings.skills.advancedIndustry ?? 0
  const perRun = manufacturingTimePerRun(
    blueprint.manufacturingTime,
    te,
    advanced,
    structure.teBonusPercent,
  )
  if (perRun <= 0 || runs <= 0) return 0

  const effectiveLines = Math.max(1, parallelLines)
  const runsPerJob = Math.ceil(runs / Math.min(effectiveLines, runs))
  const jobTime = applyTE(blueprint.manufacturingTime, te, runsPerJob, advanced, structure.teBonusPercent)
  const waves = Math.ceil(runs / (runsPerJob * effectiveLines))
  return (jobTime * waves) / 3600
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

/** Recompute job time from runs using current skills and parallel lines. */
export function syncRootEntry(
  root: PlanRootEntry,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  parallelLines: number,
  meTeOverride?: PlanNodeOverride,
): PlanRootEntry {
  if (!blueprint) return root
  const productionDurationHours = durationHoursFromRuns(
    blueprint,
    settings,
    root.runs,
    parallelLines,
    meTeOverride,
  )
  if (root.productionDurationHours === productionDurationHours) return root
  if (Math.abs(root.productionDurationHours - productionDurationHours) < 0.005) return root
  return { ...root, productionDurationHours }
}

export function createSyncedPlanRootEntry(
  productTypeId: number,
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  parallelLines: number,
  runs: number = DEFAULT_BATCH_SIZE,
): Omit<PlanRootEntry, 'id'> {
  const { id: _id, ...synced } = syncRootEntry(
    { id: '', productTypeId, runs, productionDurationHours: 0 },
    blueprint,
    settings,
    parallelLines,
  )
  return synced
}

/** Apply a runs or job-time edit and keep the other field in sync. */
export function applyRootEntryPatch(
  root: PlanRootEntry,
  patch: Partial<PlanRootEntry>,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  parallelLines: number,
  meTeOverride?: PlanNodeOverride,
): PlanRootEntry {
  const next = { ...root, ...patch }
  if (!blueprint) return next

  if (patch.productionDurationHours != null && patch.runs == null) {
    next.runs = runsFromDurationHours(
      blueprint,
      settings,
      patch.productionDurationHours,
      parallelLines,
      meTeOverride,
    )
    next.productionDurationHours = durationHoursFromRuns(
      blueprint,
      settings,
      next.runs,
      parallelLines,
      meTeOverride,
    )
  } else if (patch.runs != null && patch.productionDurationHours == null) {
    next.productionDurationHours = durationHoursFromRuns(
      blueprint,
      settings,
      patch.runs,
      parallelLines,
      meTeOverride,
    )
  }

  return next
}

export function bpcCountForRuns(runs: number, runsPerBpc: number): number {
  const per = Math.max(1, runsPerBpc)
  return Math.max(1, Math.ceil(runs / per))
}

/** Resolve runs after a runs or job-time edit (uses concurrentCopies, not full skill slots). */
export function resolveRunsFromPatch(
  currentRuns: number,
  patch: { runs?: number; productionDurationHours?: number },
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  concurrentCopies: number,
  meTeOverride?: PlanNodeOverride,
): number {
  if (patch.runs != null) return patch.runs
  if (patch.productionDurationHours != null && blueprint) {
    return runsFromDurationHours(
      blueprint,
      settings,
      patch.productionDurationHours,
      Math.max(1, concurrentCopies),
      meTeOverride,
    )
  }
  return currentRuns
}
