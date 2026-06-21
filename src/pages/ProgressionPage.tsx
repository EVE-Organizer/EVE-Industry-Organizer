import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import {
  SKILL_PATHS,
  buildSkillQueue,
  nextRecommendedSkill,
  pathCompletion,
  stageCompletion,
  totalQueueDays,
} from '@/lib/progression'
import { Panel } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { PageHeader } from '@/components/Layout'
import { EveImage } from '@/components/EveImage'
import { SkillLevelSlider } from '@/components/SkillLevelSlider'
import { formatNumber, formatDecimal } from '@/lib/profit'
import { PATH_TYPE_IDS } from '@/lib/eveImages'
import { ONBOARDING_SKILL_FIELDS, skillIdForKey, formatSkillLevel } from '@/lib/skillFields'

function skillLabel(key: string): string {
  const field = ONBOARDING_SKILL_FIELDS.find((f) => f.key === key)
  if (field) return field.label
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

export function ProgressionPage() {
  const userData = useAppStore((s) => s.userData)
  const setSkillProgress = useAppStore((s) => s.setSkillProgress)
  const updateAccount = useAppStore((s) => s.updateAccount)
  const [pathId, setPathId] = useState('t1-ammo')
  const account = userData.accounts[0]
  const path = SKILL_PATHS.find((p) => p.id === pathId)!

  if (!account) {
    return <PageHeader title="Progression" subtitle="Add a character in Accounts first." />
  }

  const ranks = new Map(SKILL_PATHS.flatMap((p) => p.stages).flatMap((s) => s.skills).map((s) => [s.skillKey, 2]))
  const queue = buildSkillQueue(account, path, ranks)
  const next = nextRecommendedSkill(account, path)
  const completion = pathCompletion(account, path)
  const nextSkillId = next ? skillIdForKey(next.skillKey) : undefined

  return (
    <div>
      <PageHeader
        title="Skill Progression"
        subtitle={`${account.name} · ${formatNumber(completion, 0)}% complete on ${path.name}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {SKILL_PATHS.map((p) => {
          const pct = pathCompletion(account, p)
          const typeId = PATH_TYPE_IDS[p.id] ?? 3380
          const active = pathId === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={`infographic-nav-tile text-left items-start !p-4 ${active ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => setPathId(p.id)}
            >
              <div className="flex items-center gap-2 w-full">
                <EveImage id={typeId} size={32} framed alt={p.name} />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-sm block truncate">{p.name}</span>
                  <span className="text-xs opacity-60">{formatNumber(pct, 0)}% done</span>
                </div>
              </div>
              <progress className="progress progress-primary w-full h-1.5 mt-2" value={pct} max={100} />
            </button>
          )
        })}
      </div>

      {next && nextSkillId && (
        <div className="alert alert-info mb-4 text-sm flex items-center gap-3">
          <EveImage id={nextSkillId} size={32} framed alt={skillLabel(next.skillKey)} />
          <span>
            Next recommended: <strong>{skillLabel(next.skillKey)}</strong> to level{' '}
            {formatSkillLevel(next.targetLevel)} ({next.stageName})
          </span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Queue duration (est.)"
          value={`${formatDecimal(totalQueueDays(queue), 1)} days`}
          valueClassName="text-secondary text-2xl"
          accent="secondary"
          icon={<EveImage id={24625} size={32} framed alt="" />}
        />
        <div className="card bg-base-200 border border-eve-border">
          <div className="card-body py-4">
            <h3 className="text-xs uppercase tracking-wide opacity-60 mb-3">Attributes</h3>
            <div className="flex flex-wrap gap-4">
              <label className="form-control">
                <span className="label-text text-xs flex items-center gap-1">
                  <EveImage id={3380} size={18} alt="" />
                  Intelligence
                </span>
                <input
                  type="number"
                  className="input input-bordered input-sm w-20"
                  value={account.intelligence}
                  onChange={(e) => updateAccount(account.id, { intelligence: +e.target.value })}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs flex items-center gap-1">
                  <EveImage id={3403} size={18} alt="" />
                  Memory
                </span>
                <input
                  type="number"
                  className="input input-bordered input-sm w-20"
                  value={account.memory}
                  onChange={(e) => updateAccount(account.id, { memory: +e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        {path.stages.map((stage, stageIndex) => {
          const sc = stageCompletion(account, stage)
          const complete = sc.percent >= 100
          return (
            <div key={stage.id} className="stage-timeline mb-6 last:mb-0">
              <span
                className={`stage-timeline-marker ${complete ? 'bg-success' : stageIndex === 0 || sc.percent > 0 ? 'bg-primary' : 'bg-base-300'}`}
              />
              <Panel title={stage.name} className="mb-0">
                <p className="text-xs opacity-70">{stage.rationale}</p>
                <p className="text-xs text-secondary mb-2 flex items-center gap-1">
                  <EveImage id={PATH_TYPE_IDS[path.id] ?? 3841} size={32} alt="" />
                  Unlocks: {stage.unlocks}
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <progress className="progress progress-primary flex-1 h-2" value={sc.percent} max={100} />
                  <span className="text-xs tabular-nums shrink-0 w-12 text-right">{formatNumber(sc.percent, 0)}%</span>
                </div>
                <div className="rounded-lg border border-eve-border/50 bg-base-300/20 px-2">
                  {stage.skills.map((skill) => {
                    const skillId = skillIdForKey(skill.skillKey)
                    const current = account.skills[skill.skillKey] ?? 0
                    if (!skillId) return null
                    return (
                      <SkillLevelSlider
                        key={skill.skillKey}
                        skillId={skillId}
                        label={skillLabel(skill.skillKey)}
                        value={current}
                        max={5}
                        onChange={(level) => setSkillProgress(account.id, skill.skillKey, level)}
                      />
                    )
                  })}
                </div>
              </Panel>
            </div>
          )
        })}
      </div>
    </div>
  )
}
