import { CharacterAvatar } from '@/components/EveImage'
import type { PlanOwnerOption } from '@/components/plan/PlanOwnerPicker'
import { buildPlanPhases, type PlanPhaseStep } from '@/lib/planPhases'
import { formatDecimal } from '@/lib/profit'
import type {
  PlanCharacterKey,
  PlanNode,
  PlanStepProgress,
  PlanStepStatus,
  ScheduledPlanJob,
} from '@/types'

const STATUS_LABEL: Record<PlanStepStatus, string> = {
  todo: 'To do',
  running: 'Running',
  done: 'Done',
}

const STATUS_CLASS: Record<PlanStepStatus, string> = {
  todo: 'badge-ghost',
  running: 'badge-info',
  done: 'badge-success',
}

const SOURCE_LABEL = { esi: 'from ESI', stock: 'from stock', manual: 'set by you' } as const

function StatusMenu({
  step,
  onSetStatus,
}: {
  step: PlanPhaseStep
  onSetStatus?: (stepKey: string, status: PlanStepStatus | undefined) => void
}) {
  const stepKey = step.job.stepKey
  const badge = (
    <span className={`badge badge-sm ${STATUS_CLASS[step.status]}`}>
      {STATUS_LABEL[step.status]}
      {step.source ? ` · ${SOURCE_LABEL[step.source]}` : ''}
    </span>
  )
  if (!onSetStatus || !stepKey) return badge

  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        tabIndex={0}
        className="cursor-pointer"
        aria-label={`Set status for ${step.job.name}`}
      >
        {badge}
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-20 bg-base-200 border border-eve-border rounded-lg w-44 p-1 shadow-lg"
      >
        {(['todo', 'running', 'done'] as const).map((status) => (
          <li key={status}>
            <button type="button" onClick={() => onSetStatus(stepKey, status)}>
              Mark {STATUS_LABEL[status].toLowerCase()}
            </button>
          </li>
        ))}
        {step.source === 'manual' ? (
          <li>
            <button type="button" onClick={() => onSetStatus(stepKey, undefined)}>
              Use automatic status
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function StepMenu({
  stepKey,
  onSetStatus,
}: {
  stepKey: string
  onSetStatus: (stepKey: string, status: PlanStepStatus | undefined) => void
}) {
  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        tabIndex={0}
        className="btn btn-ghost btn-xs btn-square"
        aria-label="Step actions"
      >
        ⋮
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-20 bg-base-200 border border-eve-border rounded-lg w-44 p-1 shadow-lg"
      >
        <li>
          <button type="button" onClick={() => onSetStatus(stepKey, 'running')}>
            Mark running now
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onSetStatus(stepKey, 'done')}>
            Mark done
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onSetStatus(stepKey, undefined)}>
            Clear manual status
          </button>
        </li>
      </ul>
    </div>
  )
}

function formatStepClock(
  startedAt: string | undefined,
  startHour: number,
  endHour: number,
): string {
  if (!startedAt) {
    return `${formatDecimal(startHour, 1)}h – ${formatDecimal(endHour, 1)}h`
  }
  const base = Date.parse(startedAt)
  const fmt = (hour: number) =>
    new Date(base + hour * 3_600_000).toLocaleString([], {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  return `${fmt(startHour)} → ${fmt(endHour)}`
}

function StepRow({
  step,
  owner,
  onSetStatus,
  readiness,
  startedAt,
}: {
  step: PlanPhaseStep
  readiness?: string
  owner?: PlanOwnerOption
  onSetStatus?: (stepKey: string, status: PlanStepStatus | undefined) => void
  startedAt?: string
}) {
  const { job } = step
  const installLine = [
    step.status === 'done' ? 'done' : step.status === 'running' ? 'run' : 'todo',
    `Install ${job.name}`,
    job.bpoIndex ? `BPO #${job.bpoIndex}` : null,
    `${formatDecimal(job.runs, 0)} runs`,
    owner ? owner.name : null,
    `slot ${job.slot + 1}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className={`grid grid-cols-[auto_auto_1fr_auto_auto] items-start gap-x-2 gap-y-1 px-4 py-3 text-sm border-b border-base-content/5 last:border-0${step.status === 'done' ? ' opacity-60' : ''}`}
    >
      <StatusMenu step={step} onSetStatus={onSetStatus} />
      {owner ? (
        <span title={owner.name} className="inline-flex pt-0.5">
          <CharacterAvatar characterId={owner.characterId} name={owner.name} size={22} />
        </span>
      ) : (
        <span />
      )}
      <div className="min-w-0">
        <p className="font-medium capitalize">{installLine}</p>
        <p className="text-xs tabular-nums opacity-70 mt-0.5">
          {formatStepClock(startedAt, job.startHour, job.endHour)}
          {step.status === 'running' && step.source === 'esi' ? ' · Running (ESI)' : ''}
        </p>
        <p className="text-xs opacity-60 mt-0.5">Waits for {step.waitsFor}</p>
        {readiness ? <p className="text-xs text-info mt-0.5">{readiness}</p> : null}
      </div>
      {onSetStatus && job.stepKey ? (
        <StepMenu stepKey={job.stepKey} onSetStatus={onSetStatus} />
      ) : (
        <span />
      )}
    </li>
  )
}

/**
 * Phase-grouped steps with a status per job. Phases overlap; start times come from the scheduler.
 * Status comes from ESI jobs and stock; the menu lets the player override it by hand.
 */
export function PlanPhaseSteps({
  jobs,
  nodes,
  progress,
  ownerOptions = [],
  nextInstall,
  onSetStatus,
  readinessFor,
  startedAt,
}: {
  jobs: ScheduledPlanJob[]
  nodes: PlanNode[]
  progress?: Record<string, PlanStepProgress>
  ownerOptions?: PlanOwnerOption[]
  nextInstall?: string
  onSetStatus?: (stepKey: string, status: PlanStepStatus | undefined) => void
  /** Stock hint for a step that has not started, such as "Ready to install". */
  readinessFor?: (job: ScheduledPlanJob) => string | undefined
  startedAt?: string
}) {
  const phases = buildPlanPhases(jobs, nodes, progress)
  if (phases.length === 0) {
    return <p className="text-sm opacity-60">No jobs scheduled.</p>
  }
  const ownerByKey = new Map<PlanCharacterKey, PlanOwnerOption>(ownerOptions.map((o) => [o.key, o]))

  return (
    <div className="flex flex-col gap-3">
      {nextInstall ? (
        <p className="text-sm font-medium text-primary border-l-2 border-primary pl-2 mb-1">
          {nextInstall}
        </p>
      ) : null}
      {phases.map((phase) => (
        <section key={phase.id} className="plan-build-card">
          <header className="plan-build-card__header">
            <h3 className="plan-build-card__title">{phase.label}</h3>
            <p className="text-xs opacity-60">
              {formatDecimal(phase.startHour, 1)}h – {formatDecimal(phase.endHour, 1)}h · done{' '}
              {phase.doneCount}/{phase.steps.length}
              {phase.overlaps.length
                ? ` · starts while ${phase.overlaps.join(', ')} still run`
                : ''}
            </p>
            {progress ? (
              <progress
                className="progress progress-primary w-24"
                value={phase.doneCount}
                max={phase.steps.length}
                aria-label={`${phase.doneCount} of ${phase.steps.length} steps done`}
              />
            ) : null}
          </header>
          <ul className="flex flex-col divide-y divide-base-content/5">
            {phase.steps.map((step) => (
              <StepRow
                key={
                  step.job.stepKey ??
                  `${step.job.productTypeId}-${step.job.slot}-${step.job.startHour}`
                }
                step={step}
                owner={step.job.characterKey ? ownerByKey.get(step.job.characterKey) : undefined}
                onSetStatus={onSetStatus}
                readiness={step.status === 'todo' ? readinessFor?.(step.job) : undefined}
                startedAt={startedAt}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
