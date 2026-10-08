import { formatDecimal } from '@/lib/profit'
import type {
  PlanNode,
  PlanStepProgress,
  PlanStepSource,
  PlanStepStatus,
  ScheduledPlanJob,
} from '@/types'

export interface PlanPhaseStep {
  job: ScheduledPlanJob
  waitsFor: string
  status: PlanStepStatus
  /** Who marked the status: ESI job match, stock on hand, or the user. */
  source?: PlanStepSource
}

export interface PlanPhase {
  id: string
  label: string
  startHour: number
  endHour: number
  steps: PlanPhaseStep[]
  doneCount: number
  overlaps: string[]
}

type ProgressMap = Record<string, PlanStepProgress | undefined>

function phaseOf(job: ScheduledPlanJob, depthByProduct: Map<number, number>): string {
  if (job.activity === 'copy' || job.activity === 'invention') return 'research'
  if (job.activity === 'reaction') return 'reactions'
  const depth = depthByProduct.get(job.productTypeId) ?? 0
  if (depth <= 0) return 'final'
  return `components-${depth}`
}

/**
 * Group scheduled jobs for reading. Phases overlap; they do not change start times.
 * Each step carries its progress status so the list doubles as a checklist.
 */
export function buildPlanPhases(
  jobs: ScheduledPlanJob[],
  nodes: PlanNode[],
  progress: ProgressMap = {},
): PlanPhase[] {
  /* ----- Bucket jobs by phase ----- */

  const depthByProduct = new Map(nodes.map((node) => [node.productTypeId, node.depth]))
  const buckets = new Map<string, ScheduledPlanJob[]>()
  for (const job of jobs) {
    const id = phaseOf(job, depthByProduct)
    const list = buckets.get(id) ?? []
    list.push(job)
    buckets.set(id, list)
  }

  // Deepest components come first because they have to finish before their parents
  const componentDepths = [...buckets.keys()]
    .filter((id) => id.startsWith('components-'))
    .map((id) => Number(id.slice('components-'.length)))
    .sort((a, b) => b - a)

  const order = [
    'research',
    'reactions',
    ...componentDepths.map((depth) => `components-${depth}`),
    'final',
  ]

  /* ----- Build phases with step status ----- */

  const phases: PlanPhase[] = []
  for (const id of order) {
    const list = buckets.get(id)
    if (!list?.length) continue
    const jobsInPhase = [...list].sort((a, b) => a.startHour - b.startHour || a.slot - b.slot)
    const steps = jobsInPhase.map((job) => {
      const held = job.stepKey ? progress[job.stepKey] : undefined
      return {
        job,
        waitsFor: job.waitsFor ?? 'a free slot',
        status: held?.status ?? 'todo',
        source: held?.source,
      } satisfies PlanPhaseStep
    })
    const label =
      id === 'research'
        ? 'Research'
        : id === 'reactions'
          ? 'Reactions'
          : id === 'final'
            ? 'Final products'
            : `Components · depth ${id.slice('components-'.length)}`
    phases.push({
      id,
      label,
      startHour: Math.min(...jobsInPhase.map((job) => job.startHour)),
      endHour: Math.max(...jobsInPhase.map((job) => job.endHour)),
      steps,
      doneCount: steps.filter((step) => step.status === 'done').length,
      overlaps: [],
    })
  }

  /* ----- Record which phases run at the same time ----- */

  for (const phase of phases) {
    phase.overlaps = phases
      .filter(
        (other) =>
          other.id !== phase.id &&
          other.startHour < phase.endHour &&
          other.endHour > phase.startHour,
      )
      .map((other) => other.label)
  }
  return phases
}

/** The next job the player still has to install: earliest start among steps not running or done. */
export function nextInstallJob(
  jobs: ScheduledPlanJob[],
  progress: ProgressMap = {},
): ScheduledPlanJob | undefined {
  return jobs
    .filter((job) => !job.stepKey || (progress[job.stepKey]?.status ?? 'todo') === 'todo')
    .sort((a, b) => a.startHour - b.startHour || a.slot - b.slot)[0]
}

/** One sentence for the Next install line, naming the item, BPO, runs, owner and start time. */
export function describeInstall(job: ScheduledPlanJob, ownerName?: string): string {
  const parts = [
    `Install ${job.name}`,
    job.bpoIndex ? `BPO #${job.bpoIndex}` : null,
    `${formatDecimal(job.runs, 0)} runs`,
    ownerName ? `as ${ownerName}` : null,
  ].filter(Boolean)
  return `Next install: ${parts.join(', ')} at ${formatDecimal(job.startHour, 1)}h.`
}
