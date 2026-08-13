import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FitLoadStats } from '@/components/fitSkills/FitLoadStats'
import { LoadingState, PageHeader } from '@/components/Layout'
import { Panel } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { useFittingData } from '@/hooks/useFittingData'
import { useSdeData } from '@/hooks/useSdeData'
import { skillAttrs } from '@/lib/characterPlan/attributes'
import {
  applyQueueToTrained,
  buildQueue,
  remapLabel,
  type BuiltQueue,
} from '@/lib/characterPlan/buildPlan'
import { CHARACTER_PATHS, PLAN_ASSUMPTIONS, type CharacterPath, type PlanFit, type PlanStep } from '@/lib/characterPlan/paths'
import { formatDuration, spPerHour, type TrainRate } from '@/lib/characterPlan/sp'
import { analyzeFit } from '@/lib/fitting/analyzeFit'
import { buildFittingIndex } from '@/lib/fitting/fitSkills'
import { romanLevel } from '@/lib/fitting/skillDisplay'
import type { SkillInfo } from '@/types'

function rateForStep(step: PlanStep, implant: number): TrainRate {
  return { implant, remap: step.remap }
}

function buildPathQueues(path: CharacterPath, skills: SkillInfo[], implant: number) {
  let trained = new Map<number, number>()
  return path.steps.map((step) => {
    const queue = buildQueue(step.targets, skills, rateForStep(step, implant), trained)
    trained = applyQueueToTrained(trained, queue)
    return { step, queue }
  })
}

export function CharacterPlanPage() {
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const { data: fitting, isLoading: fittingLoading } = useFittingData()
  const [pathId, setPathId] = useState(CHARACTER_PATHS[0].id)
  const [implant, setImplant] = useState(0)

  const path = CHARACTER_PATHS.find((p) => p.id === pathId) ?? CHARACTER_PATHS[0]
  const skills = sde?.skills
  const index = useMemo(() => (fitting ? buildFittingIndex(fitting) : null), [fitting])

  const built = useMemo(
    () => (skills?.length ? buildPathQueues(path, skills, implant) : []),
    [path, skills, implant],
  )

  if (sdeLoading || fittingLoading) return <LoadingState />

  return (
    <div className="flex flex-col min-h-0 gap-6">
      <PageHeader
        title="Character plan"
        subtitle="Three Omega alts: hauler/Bustard, miner/Hulk+Porpoise, Jita seller. Skills are cut to what those hulls and jobs actually use."
      />

      <Panel title="Assumptions">
        <ul className="text-sm flex flex-col gap-1 opacity-90">
          <li>{PLAN_ASSUMPTIONS.clone}</li>
          <li>{PLAN_ASSUMPTIONS.remap}</li>
          <li>{PLAN_ASSUMPTIONS.implants}</li>
          <li>{PLAN_ASSUMPTIONS.start}</li>
        </ul>
        <label className="form-control w-full max-w-xs mt-4">
          <span className="label-text text-xs">Attribute implants</span>
          <select
            className="select select-bordered select-sm"
            value={implant}
            onChange={(event) => setImplant(Number(event.target.value))}
          >
            <option value={0}>None (remap only)</option>
            <option value={3}>+3 implants</option>
          </select>
        </label>
      </Panel>

      <div className="tabs tabs-boxed w-fit flex-wrap">
        {CHARACTER_PATHS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab ${item.id === path.id ? 'tab-active' : ''}`}
            onClick={() => setPathId(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <p className="text-sm opacity-80 max-w-3xl">{path.summary}</p>
      <p className="text-xs opacity-60">{path.role}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {built.map(({ step, queue }) => (
          <StatCard
            key={step.id}
            label={step.title}
            value={queue.duration}
            description={`${queue.totalSp.toLocaleString()} SP · ${remapLabel(step.remap)}`}
            valueClassName="text-xl"
          />
        ))}
      </div>
      <p className="text-xs opacity-60">
        This character&apos;s total queue is{' '}
        {formatDuration(built.reduce((sum, row) => sum + row.queue.totalHours, 0))}. Three accounts
        train at the same time, so a calendar month is as long as the slowest of the three queues
        that month.
      </p>

      {built.map(({ step, queue }) => (
        <StepPanel
          key={step.id}
          step={step}
          queue={queue}
          implant={implant}
          skills={skills ?? []}
          index={index}
        />
      ))}
    </div>
  )
}

function StepPanel({
  step,
  queue,
  implant,
  skills,
  index,
}: {
  step: PlanStep
  queue: BuiltQueue
  implant: number
  skills: SkillInfo[]
  index: ReturnType<typeof buildFittingIndex> | null
}) {
  const rate = rateForStep(step, implant)
  const sample = queue.rows[0]
  const sampleSph = sample
    ? spPerHour(skillAttrs(sample.skillId).primary, skillAttrs(sample.skillId).secondary, rate)
    : spPerHour('perception', 'willpower', rate)

  return (
    <Panel title={step.title} actions={<span className="badge badge-ghost">{queue.duration}</span>}>
      <p className="text-sm mb-3">{step.goal}</p>
      <p className="text-xs opacity-70 mb-4">
        Remap {remapLabel(step.remap)}. Skills that match this remap train at {Math.round(sampleSph)} SP/h
        {implant ? ` with +${implant} implants` : ''}. Off-attribute skills in the same queue are slower; that is
        included in the times below.
      </p>

      {step.fits.length ? (
        <div className="flex flex-col gap-4 mb-4">
          {step.fits.map((fit) => (
            <FitBlock key={fit.id} fit={fit} skills={skills} index={index} />
          ))}
        </div>
      ) : (
        <p className="text-sm opacity-70 mb-4">No ship. This character stays docked in Jita 4-4.</p>
      )}

      <div className="overflow-x-auto mb-4">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Skill</th>
              <th>To</th>
              <th>SP</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {queue.rows.map((row, i) => (
              <tr key={`${row.skillId}-${row.toLevel}-${i}`}>
                <td>{row.name}</td>
                <td>{romanLevel(row.toLevel)}</td>
                <td className="tabular-nums">{row.sp.toLocaleString()}</td>
                <td className="tabular-nums">{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {step.skip.length ? (
        <div>
          <h3 className="text-sm font-medium mb-1">Skip</h3>
          <ul className="text-sm opacity-80 list-disc pl-5 flex flex-col gap-1">
            {step.skip.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  )
}

function FitBlock({
  fit,
  skills,
  index,
}: {
  fit: PlanFit
  skills: SkillInfo[]
  index: ReturnType<typeof buildFittingIndex> | null
}) {
  const analysis = useMemo(() => {
    if (!index) return null
    try {
      return analyzeFit(fit.eft, index, skills)
    } catch {
      return null
    }
  }, [fit.eft, index, skills])

  return (
    <div className="rounded-lg border border-eve-border p-3 flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-sm">{fit.label}</h3>
        {analysis ? (
          <span className={`badge badge-sm ${analysis.possible ? 'badge-success' : 'badge-error'}`}>
            {analysis.possible ? 'Fits at skills V' : 'Check CPU/PG'}
          </span>
        ) : null}
        <Link className="btn btn-ghost btn-xs" to="/tools/fit-skills">
          Open in Fit skills
        </Link>
        <CopyEft eft={fit.eft} />
      </div>
      <p className="text-sm opacity-80">{fit.note}</p>
      {analysis?.unknown.length ? (
        <p className="text-xs text-warning">Unknown items: {analysis.unknown.join(', ')}</p>
      ) : null}
      {analysis ? <FitLoadStats load={analysis.maxLoad} /> : null}
      <pre className="text-xs bg-base-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{fit.eft.trim()}</pre>
    </div>
  )
}

function CopyEft({ eft }: { eft: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      onClick={() => {
        void navigator.clipboard.writeText(eft.trim())
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy EFT'}
    </button>
  )
}
