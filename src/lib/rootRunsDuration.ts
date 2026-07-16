import type { BlueprintInfo, GlobalSettings, PlanRootEntry } from '@/types'
import { BATCH_SIZE_STEP, MIN_BATCH_SIZE } from '@/types'
import {
  applyTE,
  blueprintMeTe,
  manufacturingTimePerRun,
  resolveStructureModifiers,
  runsForJobTime,
} from '@/lib/cost'

export function runsForDemand(productQuantity: number, demandQty: number): number {
  if (productQuantity <= 0) return MIN_BATCH_SIZE
  const exact = Math.ceil(demandQty / productQuantity)
  const stepped = Math.max(MIN_BATCH_SIZE, Math.round(exact / BATCH_SIZE_STEP) * BATCH_SIZE_STEP)
  return stepped
}

export function runsFromDurationHours(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  durationHours: number,
  slots: number,
): number {
  const { te } = blueprintMeTe(blueprint.tier, settings)
  const structure = resolveStructureModifiers(settings)
  const advanced = settings.skills.advancedIndustry ?? 0
  const availableSec = Math.max(0, durationHours) * 3600
  if (slots <= 0 || availableSec <= 0) return MIN_BATCH_SIZE

  const perSlotSec = availableSec / slots
  const runsPerSlot = runsForJobTime(
    perSlotSec,
    blueprint.manufacturingTime,
    te,
    advanced,
    structure.teBonusPercent,
    { step: BATCH_SIZE_STEP, maxRuns: null },
  )
  return Math.max(MIN_BATCH_SIZE, runsPerSlot * slots)
}

export function durationHoursFromRuns(
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  runs: number,
  slots: number,
): number {
  const { te } = blueprintMeTe(blueprint.tier, settings)
  const structure = resolveStructureModifiers(settings)
  const advanced = settings.skills.advancedIndustry ?? 0
  const perRun = manufacturingTimePerRun(
    blueprint.manufacturingTime,
    te,
    advanced,
    structure.teBonusPercent,
  )
  if (perRun <= 0 || runs <= 0) return 0

  const effectiveSlots = Math.max(1, slots)
  const jobs = Math.ceil(runs / Math.max(1, Math.floor(runs / effectiveSlots)))
  const runsPerJob = Math.ceil(runs / Math.min(effectiveSlots, runs))
  const jobTime = applyTE(blueprint.manufacturingTime, te, runsPerJob, advanced, structure.teBonusPercent)
  const waves = Math.ceil(runs / (runsPerJob * effectiveSlots))
  return (jobTime * waves) / 3600
}

export function defaultRunsPerBpc(blueprint: BlueprintInfo, templateDefault: number): number {
  if (blueprint.tier === 't2' && blueprint.invention?.runsPerBPC) {
    return blueprint.invention.runsPerBPC
  }
  return templateDefault
}

/** Apply a runs or job-time edit and keep the other field in sync. */
export function applyRootEntryPatch(
  root: PlanRootEntry,
  patch: Partial<PlanRootEntry>,
  blueprint: BlueprintInfo | undefined,
  settings: GlobalSettings,
  slots: number,
): PlanRootEntry {
  const next = { ...root, ...patch }
  if (!blueprint) return next

  if (patch.productionDurationHours != null && patch.runs == null) {
    next.runs = runsFromDurationHours(
      blueprint,
      settings,
      patch.productionDurationHours,
      slots,
    )
    next.productionDurationHours = durationHoursFromRuns(
      blueprint,
      settings,
      next.runs,
      slots,
    )
  } else if (patch.runs != null && patch.productionDurationHours == null) {
    next.productionDurationHours = durationHoursFromRuns(
      blueprint,
      settings,
      patch.runs,
      slots,
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
): number {
  if (patch.runs != null) return patch.runs
  if (patch.productionDurationHours != null && blueprint) {
    return runsFromDurationHours(
      blueprint,
      settings,
      patch.productionDurationHours,
      Math.max(1, concurrentCopies),
    )
  }
  return currentRuns
}
