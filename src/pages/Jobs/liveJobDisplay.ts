import type { BlueprintInfo, IndustryActivityId, LiveIndustryJob } from '@/types'
import type { BlueprintItemState } from '@/services/character/characterBlueprintsService'

export type ResearchKind = 'me' | 'te' | 'copy'

export const RESEARCH_KIND_LABELS: Record<ResearchKind, string> = {
  me: 'ME',
  te: 'TE',
  copy: 'Copy',
}

export const RESEARCH_KIND_TITLES: Record<ResearchKind, string> = {
  me: 'Material Efficiency research',
  te: 'Time Efficiency research',
  copy: 'Blueprint copying',
}

/** Max ME on a BPO (10 steps, 1% material reduction each). */
export const BPO_ME_MAX = 10
/** Max TE on a BPO (10 steps, 2% time reduction each). */
export const BPO_TE_MAX = 20
export const TE_RESEARCH_STEP = 2

export interface DisplayLiveJob extends LiveIndustryJob {
  researchKind: ResearchKind | null
  /** e.g. "ME 0% → 1% (1 run)", "TE 4% → 6% (1 run)", "Copy ×5". */
  researchProgress: string | null
  itemName: string
  displayLabel: string
  iconProductTypeId: number
  iconBlueprintTypeId?: number
}

export function researchKindFromActivity(activityId: IndustryActivityId): ResearchKind | null {
  switch (activityId) {
    case 3:
      return 'te'
    case 4:
      return 'me'
    case 5:
      return 'copy'
    default:
      return null
  }
}

function resolveItemName(
  productTypeId: number,
  blueprintTypeId: number,
  typeMap?: Map<number, string>,
): string {
  const productName = typeMap?.get(productTypeId)
  if (productName) return productName

  const blueprintName = typeMap?.get(blueprintTypeId)
  if (blueprintName) return blueprintName.replace(/ Blueprint$/, '')

  return `Type ${productTypeId}`
}

export function resolveLiveJobIconIds(
  job: LiveIndustryJob,
  blueprintByBpo?: Map<number, Pick<BlueprintInfo, 'productTypeId'>>,
): { productTypeId: number; blueprintTypeId?: number } {
  let productTypeId = job.productTypeId
  if (productTypeId === job.blueprintTypeId) {
    const blueprint = blueprintByBpo?.get(job.blueprintTypeId)
    if (blueprint) productTypeId = blueprint.productTypeId
  }

  const blueprintTypeId = productTypeId !== job.blueprintTypeId ? job.blueprintTypeId : undefined
  return { productTypeId, blueprintTypeId }
}

function formatRunCount(runs: number): string {
  const count = Math.max(1, runs)
  return `${count} run${count === 1 ? '' : 's'}`
}

export function computeResearchProgress(
  job: LiveIndustryJob,
  blueprint?: BlueprintItemState,
): string | null {
  const kind = researchKindFromActivity(job.activityId)
  if (!kind) return null

  if (kind === 'copy') {
    const copies = Math.max(1, job.runs)
    if (job.licensedRuns != null && job.licensedRuns > 0) {
      return `Copy ×${copies} (${job.licensedRuns} runs/BPC)`
    }
    return `Copy ×${copies}`
  }

  if (!blueprint) return null

  const runs = Math.max(1, job.runs)
  const runsLabel = formatRunCount(runs)

  if (kind === 'me') {
    const start = blueprint.materialEfficiency
    const end = Math.min(start + runs, BPO_ME_MAX)
    return `ME ${start}% → ${end}% (${runsLabel})`
  }

  const start = blueprint.timeEfficiency
  const end = Math.min(start + runs * TE_RESEARCH_STEP, BPO_TE_MAX)
  return `TE ${start}% → ${end}% (${runsLabel})`
}

export function enrichLiveJob(
  job: LiveIndustryJob,
  typeMap?: Map<number, string>,
  blueprintByBpo?: Map<number, Pick<BlueprintInfo, 'productTypeId'>>,
  blueprintByItemId?: Map<number, BlueprintItemState>,
): DisplayLiveJob {
  const researchKind = researchKindFromActivity(job.activityId)
  const blueprintItem = blueprintByItemId?.get(job.blueprintId)
  const researchProgress = computeResearchProgress(job, blueprintItem)
  const { productTypeId: iconProductTypeId, blueprintTypeId: iconBlueprintTypeId } = resolveLiveJobIconIds(
    job,
    blueprintByBpo,
  )
  const itemName = resolveItemName(iconProductTypeId, job.blueprintTypeId, typeMap)
  const kindLabel = researchKind ? RESEARCH_KIND_LABELS[researchKind] : null
  const displayLabel = researchProgress
    ? `${researchProgress} · ${itemName}`
    : kindLabel
      ? `${kindLabel} · ${itemName}`
      : itemName

  return {
    ...job,
    productName: itemName,
    productTypeId: iconProductTypeId,
    researchKind,
    researchProgress,
    itemName,
    displayLabel,
    iconProductTypeId,
    iconBlueprintTypeId,
  }
}

export function enrichLiveJobs(
  jobs: LiveIndustryJob[],
  typeMap?: Map<number, string>,
  blueprintByBpo?: Map<number, Pick<BlueprintInfo, 'productTypeId'>>,
  blueprintByItemId?: Map<number, BlueprintItemState>,
): DisplayLiveJob[] {
  return jobs.map((job) => enrichLiveJob(job, typeMap, blueprintByBpo, blueprintByItemId))
}

export function iconTypeIdMapFromJobs(jobs: DisplayLiveJob[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const job of jobs) {
    if (job.iconBlueprintTypeId != null) {
      map.set(job.iconProductTypeId, job.iconBlueprintTypeId)
    }
  }
  return map
}

export function timelineJobsFromDisplay(jobs: DisplayLiveJob[]): LiveIndustryJob[] {
  return jobs.map((job) => ({
    ...job,
    productName: job.displayLabel,
    productTypeId: job.iconProductTypeId,
  }))
}
