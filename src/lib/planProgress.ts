import type { FixedPlanJob } from '@/pages/Plan/planScheduler'
import type {
  BlueprintInfo,
  PlanNode,
  LiveIndustryJob,
  PlanCharacterKey,
  PlanStepProgress,
  ScheduledPlanJob,
} from '@/types'

export interface ProgressStep {
  stepKey: string
  characterId?: number
  activityId: number
  productTypeId: number
  blueprintTypeId?: number
  runs: number
  durationHours: number
}

const ACTIVITY: Record<number, 'manufacture' | 'copy' | 'invention' | 'reaction'> = {
  1: 'manufacture',
  5: 'copy',
  8: 'invention',
  9: 'reaction',
}

function productOf(step: ProgressStep, job: LiveIndustryJob): boolean {
  if (job.activityId === 8) return step.blueprintTypeId === job.blueprintTypeId
  if (job.activityId === 5) return step.blueprintTypeId === job.blueprintTypeId
  return step.productTypeId === job.productTypeId
}

/** Match ESI jobs onto frozen steps. An existing esiJobId is kept. */
export function matchLiveJobsToSteps(
  steps: ProgressStep[],
  liveJobs: LiveIndustryJob[],
  startedAt: string,
  existing: Record<string, PlanStepProgress>,
): Record<string, PlanStepProgress> {
  const next = { ...existing }
  const used = new Set<number>()
  const startMs = Date.parse(startedAt)
  const ordered = [...steps].sort((a, b) => a.stepKey.localeCompare(b.stepKey))

  for (const step of ordered) {
    const held = existing[step.stepKey]
    if (held?.esiJobId != null && held.status === 'done') continue
    const candidates = liveJobs.filter((job) => {
      if (used.has(job.jobId)) return false
      if (step.characterId != null && job.characterId !== step.characterId) return false
      if (job.activityId !== step.activityId) return false
      if (!productOf(step, job)) return false
      if (Date.parse(job.startAt) < startMs) return false
      return true
    })
    candidates.sort((a, b) => Math.abs(a.runs - step.runs) - Math.abs(b.runs - step.runs))
    const match = candidates[0]
    if (!match) continue
    used.add(match.jobId)
    const status =
      match.status === 'ready' || match.status === 'delivered'
        ? 'done'
        : match.status === 'cancelled' || match.status === 'reverted'
          ? undefined
          : 'running'
    if (!status) {
      if (next[step.stepKey]?.esiJobId === match.jobId) delete next[step.stepKey]
      continue
    }
    next[step.stepKey] = {
      status,
      source: 'esi',
      esiJobId: match.jobId,
      startedAt: match.startAt,
      endedAt: match.endAt,
      successfulRuns: match.successfulRuns,
    }
  }
  return next
}

export function mergeProgress(
  esi: PlanStepProgress | undefined,
  stock: PlanStepProgress | undefined,
  manual: PlanStepProgress | undefined,
): PlanStepProgress | undefined {
  if (manual) return manual
  if (esi) return esi
  return stock
}

/** How far behind the linear schedule the plan is, and when the last job should finish. */
export function planBehindAndEta(input: {
  jobs: ScheduledPlanJob[]
  progress: Record<string, PlanStepProgress | undefined>
  nowHour: number
  startedAtMs: number
  windowHours: number
}): { behindHours: number; eta: Date } {
  const steps = input.jobs
    .filter((job) => job.stepKey)
    .map((job) => ({
      stepKey: job.stepKey!,
      durationHours: Math.max(0.01, job.endHour - job.startHour),
    }))
  const { percent } = rootProgress(steps, input.progress as Record<string, PlanStepProgress>)
  const expectedHour = (percent / 100) * input.windowHours
  const behindHours = Math.max(0, input.nowHour - expectedHour)
  const eta = new Date(input.startedAtMs + input.windowHours * 3_600_000)
  return { behindHours, eta }
}

export function rootProgress(
  steps: Array<{ stepKey: string; durationHours: number }>,
  progress: Record<string, PlanStepProgress>,
): { done: number; total: number; percent: number; runningPercent: number } {
  const total = steps.reduce((sum, step) => sum + step.durationHours, 0)
  const doneHours = steps.reduce((sum, step) => {
    return progress[step.stepKey]?.status === 'done' ? sum + step.durationHours : sum
  }, 0)
  const runningHours = steps.reduce((sum, step) => {
    const entry = progress[step.stepKey]
    if (entry?.status !== 'running') return sum
    return sum + step.durationHours * 0.4
  }, 0)
  const done = steps.filter((step) => progress[step.stepKey]?.status === 'done').length
  const percent = total > 0 ? (doneHours / total) * 100 : 0
  const runningPercent =
    total > 0 ? Math.min(100 - percent, (runningHours / total) * 100) : 0
  return { done, total: steps.length, percent, runningPercent }
}

const ACTIVITY_ID: Record<NonNullable<ScheduledPlanJob['activity']>, number> = {
  manufacture: 1,
  copy: 5,
  invention: 8,
  reaction: 9,
}

function characterIdOf(key: PlanCharacterKey | undefined): number | undefined {
  return key?.startsWith('sso:') ? Number(key.slice(4)) : undefined
}

/** Scheduled jobs as steps the ESI matcher understands. Copy and invention run on the T1 blueprint. */
export function progressStepsFromJobs(
  jobs: ScheduledPlanJob[],
  blueprintByProduct: Map<number, BlueprintInfo>,
): ProgressStep[] {
  const steps: ProgressStep[] = []
  for (const job of jobs) {
    if (!job.stepKey) continue
    const activity = job.activity ?? 'manufacture'
    const blueprint = blueprintByProduct.get(job.productTypeId)
    const science = activity === 'copy' || activity === 'invention'
    steps.push({
      stepKey: job.stepKey,
      characterId: characterIdOf(job.characterKey),
      activityId: ACTIVITY_ID[activity],
      productTypeId: job.productTypeId,
      blueprintTypeId: science
        ? blueprint?.invention?.t1BlueprintTypeId
        : blueprint?.blueprintTypeId,
      runs: job.runs,
      durationHours: job.endHour - job.startHour,
    })
  }
  return steps
}

/** Freeze the schedule at Start plan: runs and owner per step. */
export function snapshotFromJobs(
  jobs: ScheduledPlanJob[],
): Record<string, { runs: number; characterKey?: PlanCharacterKey }> {
  const snapshot: Record<string, { runs: number; characterKey?: PlanCharacterKey }> = {}
  for (const job of jobs) {
    if (job.stepKey) snapshot[job.stepKey] = { runs: job.runs, characterKey: job.characterKey }
  }
  return snapshot
}

/**
 * Running and done steps become locked jobs with their real times, in hours since plan start.
 * Steps without times (stock or manual) lock at hour 0.
 */
export function fixedJobsFromProgress(
  progress: Record<string, PlanStepProgress>,
  startedAt: string,
): FixedPlanJob[] {
  const startMs = Date.parse(startedAt)
  const toHour = (iso: string | undefined) =>
    iso ? Math.max(0, (Date.parse(iso) - startMs) / 3_600_000) : 0
  return Object.entries(progress)
    .filter(([, step]) => step.status !== 'todo')
    .map(([stepKey, step]) => {
      const startHour = toHour(step.startedAt)
      return {
        stepKey,
        startHour,
        endHour: Math.max(startHour, step.endedAt ? toHour(step.endedAt) : startHour),
        characterKey: step.characterKey,
      }
    })
}

/**
 * One pass that rebuilds step progress from ESI jobs, stock and manual marks.
 * Manual marks win, then ESI, then stock. Saved ESI matches survive a job vanishing from ESI.
 */
export function syncPlanProgress(input: {
  steps: ProgressStep[]
  liveJobs: LiveIndustryJob[]
  startedAt: string
  persisted: Record<string, PlanStepProgress>
  stockFor: (known: Record<string, PlanStepProgress>) => Record<string, PlanStepProgress>
}): Record<string, PlanStepProgress> {
  const pick = (source: PlanStepProgress['source']) =>
    Object.fromEntries(Object.entries(input.persisted).filter(([, step]) => step.source === source))
  const manual = pick('manual')
  const esi = matchLiveJobsToSteps(input.steps, input.liveJobs, input.startedAt, pick('esi'))
  const stock = input.stockFor({ ...esi, ...manual })

  const merged: Record<string, PlanStepProgress> = {}
  const keys = new Set([...Object.keys(esi), ...Object.keys(stock), ...Object.keys(manual)])
  for (const key of keys) {
    const step = mergeProgress(esi[key], stock[key], manual[key])
    if (step) merged[key] = step
  }
  return merged
}

/** A product plus everything it needs below it. Cycle-safe. */
export function chainProductIds(
  nodes: Array<Pick<PlanNode, 'productTypeId' | 'childProductTypeIds'>>,
  productTypeId: number,
): Set<number> {
  const childrenOf = new Map(nodes.map((n) => [n.productTypeId, n.childProductTypeIds ?? []]))
  const seen = new Set<number>()
  const stack = [productTypeId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(childrenOf.get(id) ?? []))
  }
  return seen
}

/** Progress over the scheduled steps of the given products, weighted by step duration. */
export function progressForProducts(
  jobs: ScheduledPlanJob[],
  progress: Record<string, PlanStepProgress>,
  productIds: Set<number>,
): { done: number; total: number; percent: number } {
  const steps = jobs
    .filter((job) => job.stepKey && productIds.has(job.productTypeId))
    .map((job) => ({
      stepKey: job.stepKey!,
      // A zero-length step still counts, so give it a sliver of weight
      durationHours: Math.max(job.endHour - job.startHour, 0.01),
    }))
  return rootProgress(steps, progress)
}

export { ACTIVITY }
