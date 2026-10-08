import { useState } from 'react'
import { Tooltip } from '@/components/Tooltip'
import { PlanBlueprintItemName } from '@/components/plan/PlanBlueprintItemName'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import { PlanExpandableLeading, PlanTreeLines } from '@/components/plan/PlanTreeLines'
import { formatDecimal, formatDurationHms, formatVolumeM3, parseDurationHms } from '@/lib/profit'
import { assessReadyBy } from '@/pages/Plan/planDeadline'
import type { BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'
import {
  RUNS_FROM_READY_BY_TOOLTIP,
  runsFromDurationTooltip,
} from '@/pages/Plan/planJobsTableTypes'
import type { PlanDurationMode } from '@/types'

/** Product column icons — slightly below full row size for table density. */
export const PLAN_JOBS_TABLE_ICON_SIZE = 32

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block text-[10px] opacity-50 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      ▸
    </span>
  )
}

export function RemoveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  )
}

export function DuplicateIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
    >
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

export function GripIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
    >
      <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm8-12a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  )
}

export function VolumeCell({
  volumeM3: lineM3,
  unitVolumeM3,
}: {
  volumeM3: number
  unitVolumeM3?: number
}) {
  return (
    <span className="tabular-nums text-sm leading-snug">
      {formatVolumeM3(lineM3)}
      {unitVolumeM3 != null && unitVolumeM3 > 0 ? (
        <span className="block text-[10px] opacity-55 tabular-nums">
          {formatVolumeM3(unitVolumeM3)}/u
        </span>
      ) : null}
    </span>
  )
}

export const PLAN_JOBS_TIME_INPUT_CLASS =
  'input input-bordered input-xs w-full min-w-0 tabular-nums'

const footerDisabledInputClass =
  'cursor-default opacity-100 disabled:cursor-default disabled:opacity-100'

/** Read-only total in the jobs table footer — matches row inputs but not editable. */
export function FooterTotalsDurationInput({ hours }: { hours: number }) {
  return (
    <input
      type="text"
      disabled
      readOnly
      tabIndex={-1}
      className={`${PLAN_JOBS_TIME_INPUT_CLASS} text-info ${footerDisabledInputClass}`}
      value={formatDurationHms(Math.round(hours * 3600))}
      aria-label="Longest job timer"
    />
  )
}

/** Read-only runs (sub-build rows and shared view). */
export function PlanRunsCell({
  runs,
  fromReadyBy,
  align = 'right',
}: {
  runs: number
  fromReadyBy?: boolean
  align?: 'left' | 'right' | 'center'
}) {
  const numClass =
    align === 'right'
      ? 'tabular-nums text-sm whitespace-nowrap'
      : align === 'center'
        ? 'tabular-nums text-sm whitespace-nowrap text-center'
        : 'tabular-nums text-sm whitespace-nowrap'

  const formatted = formatDecimal(runs, 0)
  if (!fromReadyBy) return <span className={numClass}>{formatted}</span>

  return (
    <Tooltip text={RUNS_FROM_READY_BY_TOOLTIP} placement="top" className="inline-block max-w-full">
      <span className={`plan-runs-ready-by ${numClass}`}>{formatted}</span>
    </Tooltip>
  )
}

/** Editable manufacturing runs on a root product row. */
export function RootRunsInput({
  runs,
  fromReadyBy,
  ariaLabel,
  onCommit,
}: {
  runs: number
  fromReadyBy?: boolean
  ariaLabel: string
  onCommit: (runs: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const parsed = parseInt(draft ?? String(runs), 10)
    setDraft(null)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed !== runs) onCommit(parsed)
  }

  const input = (
    <input
      type="number"
      className={`input input-bordered input-xs plan-jobs-table__runs-input tabular-nums mx-auto ${
        fromReadyBy ? 'plan-runs-ready-by-input' : ''
      }`}
      min={1}
      step={1}
      aria-label={ariaLabel}
      value={draft ?? String(runs)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )

  if (!fromReadyBy) return input

  return (
    <Tooltip text={RUNS_FROM_READY_BY_TOOLTIP} placement="top" className="inline-block w-full">
      {input}
    </Tooltip>
  )
}

export function FooterTotalsReadyByInput({ hours }: { hours: number }) {
  return (
    <input
      type="text"
      disabled
      readOnly
      tabIndex={-1}
      className={`${PLAN_JOBS_TIME_INPUT_CLASS} ${footerDisabledInputClass}`}
      value={formatDurationHms(Math.round(hours * 3600))}
      aria-label="Total ready by"
    />
  )
}

/** Non-root rows: scheduled finish on the plan clock (read-only). */
export function ReadOnlyJobsTimeInput({ hours, ariaLabel }: { hours?: number; ariaLabel: string }) {
  const value = hours != null && hours > 0 ? formatDurationHms(Math.round(hours * 3600)) : '—'
  return (
    <input
      type="text"
      disabled
      readOnly
      tabIndex={-1}
      className={`${PLAN_JOBS_TIME_INPUT_CLASS} ${footerDisabledInputClass}`}
      value={value}
      aria-label={ariaLabel}
    />
  )
}

const READONLY_BPOS_INPUT_CLASS = `input input-bordered input-xs w-full max-w-[3.25rem] tabular-nums mx-auto ${footerDisabledInputClass}`

/** Root rows always represent one BPO; duplicate the job for another parallel line. */
export function ReadOnlyRootBposInput() {
  return (
    <input
      type="text"
      disabled
      readOnly
      tabIndex={-1}
      className={READONLY_BPOS_INPUT_CLASS}
      value="1"
      aria-label="One BPO per root job. Duplicate this row to run another in parallel."
    />
  )
}

export function ReadOnlyJobsBposInput({ bpos, ariaLabel }: { bpos: number; ariaLabel: string }) {
  return (
    <input
      type="text"
      disabled
      readOnly
      tabIndex={-1}
      className={READONLY_BPOS_INPUT_CLASS}
      value={formatDecimal(bpos, 0)}
      aria-label={ariaLabel}
    />
  )
}

const READONLY_RUNS_INPUT_CLASS = `input input-bordered input-xs plan-jobs-table__runs-input tabular-nums mx-auto ${footerDisabledInputClass}`

/** Sub-build runs follow chain demand; shown as a disabled field in Duration mode. */
export function ReadOnlyJobsRunsInput({
  runs,
  ariaLabel,
  fromDuration,
  durationMode = 'production',
}: {
  runs: number
  ariaLabel: string
  fromDuration?: boolean
  durationMode?: PlanDurationMode
}) {
  const input = (
    <input
      type="text"
      disabled
      readOnly
      tabIndex={-1}
      className={`${READONLY_RUNS_INPUT_CLASS}${fromDuration ? ' plan-runs-from-duration-input' : ''}`}
      value={formatDecimal(runs, 0)}
      aria-label={ariaLabel}
    />
  )

  if (!fromDuration) return input

  return (
    <Tooltip
      text={runsFromDurationTooltip(durationMode)}
      placement="top"
      className="inline-block w-full cursor-help"
    >
      {input}
    </Tooltip>
  )
}

export function DurationInput({
  hours,
  onCommit,
}: {
  hours: number
  onCommit: (hours: number) => void
}) {
  const seconds = Math.max(0, Math.round(hours * 3600))
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? formatDurationHms(seconds)

  function commit() {
    const parsedSeconds = parseDurationHms(draft ?? formatDurationHms(seconds))
    setDraft(null)
    if (parsedSeconds == null) return
    const nextHours = parsedSeconds / 3600
    if (!Number.isFinite(nextHours) || nextHours <= 0) return
    if (Math.abs(nextHours - hours) > 1 / 3600) onCommit(nextHours)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`${PLAN_JOBS_TIME_INPUT_CLASS} text-info`}
      placeholder="hours"
      aria-label="Duration"
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setDraft(formatDurationHms(seconds))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

export function ReadyByInput({
  hours,
  suggestedFinishHours,
  onCommit,
}: {
  hours?: number
  /** Scheduled finish on the plan clock — used as placeholder and first-edit default. */
  suggestedFinishHours?: number
  onCommit: (hours: number | undefined) => void
}) {
  const shown = hours != null ? formatDurationHms(Math.round(hours * 3600)) : ''
  const [draft, setDraft] = useState<string | null>(null)
  const finishHint =
    suggestedFinishHours != null && suggestedFinishHours > 0
      ? formatDurationHms(Math.round(suggestedFinishHours * 3600))
      : undefined

  function commit() {
    const text = (draft ?? shown).trim()
    setDraft(null)
    if (!text) {
      if (hours != null) onCommit(undefined)
      return
    }
    const seconds = parseDurationHms(text)
    if (seconds == null || seconds <= 0) return
    const next = seconds / 3600
    if (hours == null || Math.abs(next - hours) > 1 / 3600) onCommit(next)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={PLAN_JOBS_TIME_INPUT_CLASS}
      placeholder={finishHint ? `≥ ${finishHint}` : '—'}
      aria-label="Ready by deadline on plan timeline"
      title={
        finishHint
          ? `Plan finish time is ${finishHint}. Enter a deadline at or after that to be on time.`
          : undefined
      }
      value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        if (hours != null) setDraft(shown)
        else if (finishHint) setDraft(finishHint)
        else setDraft('')
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Deadline field + finish / late status for plan job rows. */
export function PlanReadyByCell({
  readyByHours,
  finishesAtHours,
  jobTimerHours,
  componentBuildCount = 0,
  readOnly,
  onCommit,
  onApplyDeadline,
}: {
  readyByHours?: number
  finishesAtHours?: number
  jobTimerHours?: number
  componentBuildCount?: number
  readOnly: boolean
  onCommit?: (hours: number | undefined) => void
  onApplyDeadline?: () => void
}) {
  const assessment = assessReadyBy({
    readyByHours,
    finishesAtHours,
    rootJobHours: jobTimerHours,
    componentBuildCount,
  })
  const isLate = assessment.status === 'late'
  const lateHours = isLate ? assessment.lateHours : null
  const fixable = assessment.status === 'late' && assessment.fixable
  const deadlineText =
    readyByHours != null ? formatDurationHms(Math.round(readyByHours * 3600)) : ''
  const finishText =
    finishesAtHours != null && finishesAtHours > 0
      ? formatDurationHms(Math.round(finishesAtHours * 3600))
      : null
  const jobLongerThanDeadline =
    isLate &&
    jobTimerHours != null &&
    readyByHours != null &&
    jobTimerHours > readyByHours + 1 / 3600

  const earlyHours =
    assessment.status === 'onTime' && finishesAtHours != null && readyByHours != null
      ? readyByHours - finishesAtHours
      : 0
  // A week-long deadline with a one-day finish is not "on time" — runs can still grow.
  const isEarly = earlyHours > 1

  let status: string | null = null
  if (finishText && isLate && lateHours != null) {
    status = `Late ${formatDurationHms(Math.round(lateHours * 3600))}`
  } else if (finishText && isEarly) {
    status = `Early ${formatDurationHms(Math.round(earlyHours * 3600))}`
  } else if (finishText && readyByHours != null) {
    status = 'On time'
  }

  const showAdjust = (fixable || isEarly) && !readOnly && onApplyDeadline
  let adjustHint = 'Adds component BPOs, then changes runs so the chain finishes by this time.'
  if (isEarly) adjustHint = 'Raises runs so the chain finishes near this Ready by time.'
  else if (jobLongerThanDeadline) {
    adjustHint =
      'The job itself is longer than this deadline. Fix lowers runs, then adds component BPOs if the chain is still late.'
  }
  let metaTone = ''
  if (isLate) metaTone = 'plan-ready-by__late'
  else if (isEarly) metaTone = 'plan-ready-by__early'

  return (
    <div className="plan-ready-by w-full min-w-0">
      <div className="plan-ready-by__row">
        {readOnly || !onCommit ? (
          <input
            type="text"
            disabled
            readOnly
            tabIndex={-1}
            className={`${PLAN_JOBS_TIME_INPUT_CLASS} ${footerDisabledInputClass}`}
            value={deadlineText}
            placeholder="—"
            aria-label="Ready by"
          />
        ) : (
          <ReadyByInput
            hours={readyByHours}
            suggestedFinishHours={finishesAtHours}
            onCommit={onCommit}
          />
        )}
        {showAdjust ? (
          <Tooltip text={adjustHint} placement="top">
            <button
              type="button"
              className={`btn btn-ghost btn-xs h-7 min-h-7 shrink-0 px-1.5 hover:bg-warning/10 ${
                isEarly ? 'text-info' : 'text-warning'
              }`}
              aria-label={
                isEarly
                  ? 'Raise runs to use the Ready by window'
                  : 'Adjust runs and component BPOs to meet Ready by'
              }
              onClick={(e) => {
                e.stopPropagation()
                onApplyDeadline()
              }}
            >
              {isEarly ? 'Fill' : 'Fix'}
            </button>
          </Tooltip>
        ) : null}
      </div>
      {finishText ? (
        <p className={`plan-ready-by__meta ${metaTone}`}>
          {status ? (
            <>
              <span className={isLate || isEarly ? undefined : 'plan-ready-by__ok'}>{status}</span>
              <span className="opacity-50"> · </span>
            </>
          ) : null}
          finishes {finishText}
        </p>
      ) : null}
    </div>
  )
}

export function BposInput({
  bpos,
  onCommit,
}: {
  bpos: number
  onCommit: (copies: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const parsed = parseInt(draft ?? String(bpos), 10)
    setDraft(null)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed !== bpos) onCommit(parsed)
  }

  return (
    <input
      type="number"
      className="input input-bordered input-xs w-full max-w-[3.25rem] tabular-nums mx-auto"
      min={1}
      step={1}
      aria-label="Parallel BPOs"
      value={draft ?? String(bpos)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

export function SetAllDurationInput({
  onCommit,
  placeholder = 'hours',
  ariaLabel = 'Set duration for all jobs',
}: {
  onCommit: (hours: number) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    const parsedSeconds = parseDurationHms(draft)
    setDraft('')
    if (parsedSeconds == null || parsedSeconds <= 0) return
    onCommit(parsedSeconds / 3600)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className="input input-bordered input-xs w-[6.25rem] tabular-nums"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') {
          setDraft('')
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function ProductRootMeta({ row }: { row: BuildBlueprintRow }) {
  if (!row.isRoot) return null
  return (
    <div className="plan-jobs-product__meta">
      <span className="plan-jobs-product__chip plan-jobs-product__chip--root">Root job</span>
      {row.node.tier === 't2' ? (
        <span className="plan-jobs-product__chip plan-jobs-product__chip--t2">T2</span>
      ) : null}
      {row.rootInstance != null && row.rootInstanceTotal != null && row.rootInstanceTotal > 1 ? (
        <span className="plan-jobs-product__chip tabular-nums">
          {row.rootInstance} of {row.rootInstanceTotal}
        </span>
      ) : null}
      {row.haveBpcs ? (
        <Tooltip text="Blueprint copies owned — skips invention" placement="top">
          <span className="plan-jobs-product__chip plan-jobs-product__chip--muted">BPCs owned</span>
        </Tooltip>
      ) : null}
    </div>
  )
}

export function ProductCell({
  row,
  expanded,
  onOpenGraph,
  onOpenMeTe,
}: {
  row: BuildBlueprintRow
  expanded: boolean
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
}) {
  const icon = (
    <span className="plan-jobs-product__icon-slot shrink-0">
      <PlanProductIcon
        productTypeId={row.productTypeId}
        blueprintTypeId={row.blueprintTypeId}
        size={PLAN_JOBS_TABLE_ICON_SIZE}
        alt={row.name}
      />
    </span>
  )

  const nameBlock = (
    <div className="plan-jobs-product__body min-w-0 flex-1">
      <PlanBlueprintItemName
        node={row.node}
        onOpenGraph={onOpenGraph}
        onOpenMeTe={onOpenMeTe}
        showMeTeSettings
      />
      <ProductRootMeta row={row} />
    </div>
  )

  if (row.kind === 'parent') {
    return (
      <div className="plan-jobs-product plan-jobs-product--parent flex min-w-0 items-center gap-1">
        <PlanExpandableLeading
          treeDepth={row.depth}
          isLast={row.isLast}
          continues={row.continues}
          chevron={<ChevronIcon open={expanded} />}
        />
        {icon}
        <div className="min-w-0 flex-1">
          {nameBlock}
          <span className="plan-jobs-product__sub tabular-nums">{row.childCount} sub-builds</span>
        </div>
      </div>
    )
  }

  return (
    <div className="plan-jobs-product flex min-w-0 items-center gap-1">
      <PlanTreeLines depth={row.depth} isLast={row.isLast} continues={row.continues} />
      {icon}
      {nameBlock}
    </div>
  )
}
