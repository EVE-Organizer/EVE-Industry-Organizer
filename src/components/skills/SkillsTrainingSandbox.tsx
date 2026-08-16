import { useMemo } from 'react'
import { EveImage } from '@/components/EveImage'
import { ATTRIBUTE_ICON_TYPE_IDS, ATTRIBUTE_THEME } from '@/lib/attributeDisplay'
import { formatSkillLevel, skillIconUrl, trainingAttributesForSkill } from '@/lib/skillFields'
import { formatTrainingDuration, scaleSkillQueueTimes, suggestQueueAttributeFocus } from '@/lib/skillTraining'
import {
  ATTRIBUTE_MAX,
  EVE_ATTRIBUTES,
  remainingRemapPoints,
  type AttributeMap,
  type ImplantBonuses,
} from '@/lib/skillAttributes'
import { IMPLANT_BONUS_MAX } from '@/lib/skillImplants'
import {
  isActiveQueueEntry,
  queueProgress,
  type EsiSkillQueueEntry,
} from '@/services/character/characterSkillQueueService'
import type { EveAttributeId, SkillAttributePair, SkillInfo } from '@/types'

interface SkillsTrainingSandboxProps {
  queue: EsiSkillQueueEntry[] | undefined
  skillNameById: Map<number, SkillInfo>
  spPerMinute: number | null
  queueFinishSeconds: number | null
  seedEffective: AttributeMap
  effective: AttributeMap
  bases: AttributeMap
  implants: ImplantBonuses
  isAuthenticated: boolean
  onLogin: () => void
}

function SkillAttrChips({ pair }: { pair: SkillAttributePair | null }) {
  if (!pair) return null
  return (
    <span className="skills-page__queue-attrs">
      <AttrChip attr={pair.primaryAttribute} role="Primary" />
      <AttrChip attr={pair.secondaryAttribute} role="Secondary" />
    </span>
  )
}

function AttrChip({ attr, role }: { attr: EveAttributeId; role: string }) {
  const theme = ATTRIBUTE_THEME[attr]
  return (
    <span
      className="skills-page__queue-attr"
      style={{ ['--attr-color' as string]: theme.color }}
      title={`${role}: ${theme.label}`}
    >
      <EveImage
        id={ATTRIBUTE_ICON_TYPE_IDS[attr]}
        size={14}
        alt=""
        className="skills-page__queue-attr-icon"
      />
      <span>{theme.short}</span>
    </span>
  )
}

function entryTimeLabel(
  isActive: boolean,
  queueFinishSeconds: number | null,
  scaledRemaining: number | null | undefined,
): string | null {
  if (isActive && queueFinishSeconds != null) return formatTrainingDuration(queueFinishSeconds)
  if (scaledRemaining != null) return formatTrainingDuration(scaledRemaining)
  return null
}

export function SkillsTrainingSandbox({
  queue,
  skillNameById,
  spPerMinute,
  queueFinishSeconds,
  seedEffective,
  effective,
  bases,
  implants,
  isAuthenticated,
  onLogin,
}: SkillsTrainingSandboxProps) {
  const sorted = useMemo(
    () => [...(queue ?? [])].sort((a, b) => a.queue_position - b.queue_position),
    [queue],
  )
  const scaled = useMemo(
    () =>
      scaleSkillQueueTimes(
        sorted,
        (skillId) => trainingAttributesForSkill(skillId, skillNameById),
        seedEffective,
        effective,
      ),
    [sorted, skillNameById, seedEffective, effective],
  )
  const remainingRemap = remainingRemapPoints(bases)
  const focus = useMemo(() => {
    const pointsByAttr = Object.fromEntries(
      EVE_ATTRIBUTES.map((attr) => {
        if (remainingRemap > 0) {
          return [attr, Math.min(remainingRemap, Math.max(0, ATTRIBUTE_MAX - bases[attr]))]
        }
        return [attr, implants[attr] >= IMPLANT_BONUS_MAX ? 0 : 1]
      }),
    ) as Record<EveAttributeId, number>
    return suggestQueueAttributeFocus(
      sorted,
      (skillId) => trainingAttributesForSkill(skillId, skillNameById),
      seedEffective,
      effective,
      pointsByAttr,
    )
  }, [sorted, skillNameById, seedEffective, effective, bases, implants, remainingRemap])
  const active = sorted.find(isActiveQueueEntry)
  const activeSkill = active ? skillNameById.get(active.skill_id) : undefined
  const progress = active ? queueProgress(active) : 0
  const totalSeconds = scaled.totalSeconds ?? queueFinishSeconds

  if (!isAuthenticated) {
    return (
      <section className="skills-page__card h-full min-h-0 overflow-hidden">
        <h2 className="skills-page__section-title">Training Queue</h2>
        <p className="text-xs opacity-70 mt-2">
          Sign in with EVE to load your skill queue and live training progress.
        </p>
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={onLogin}>
          Sign in with EVE
        </button>
      </section>
    )
  }

  return (
    <section className="skills-page__card h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="skills-page__section-title">Training Queue</h2>
          {focus.length > 0 ? (
            <ul className="skills-page__focus-list">
              {focus.map((item) => (
                <li key={item.attr} className="skills-page__focus-hint">
                  <AttrChip attr={item.attr} role="Focus" />
                  <span>
                    +{item.points} {remainingRemap > 0 ? 'remap' : 'implant'} saves{' '}
                    {formatTrainingDuration(item.savedSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="text-[11px] tabular-nums opacity-60 shrink-0">
          Total {formatTrainingDuration(totalSeconds)}
        </p>
      </div>

      {active && activeSkill ? (
        <div className="skills-page__inner-section mt-3 shrink-0">
          <p className="skills-page__inner-title">Training now</p>
          <div className="flex items-center gap-3">
            <img
              src={skillIconUrl(active.skill_id, 32)}
              alt=""
              width={32}
              height={32}
              className="rounded shrink-0 bg-base-300"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium truncate min-w-0 flex-1">
                  {activeSkill.name} {formatSkillLevel(active.finished_level)}
                </p>
                <SkillAttrChips pair={trainingAttributesForSkill(active.skill_id, skillNameById)} />
              </div>
              <div className="skills-page__queue-bar mt-2">
                <div
                  className="skills-page__queue-bar-fill"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-[10px] opacity-60 mt-1 tabular-nums">
                {Math.round(progress * 100)}% · {formatTrainingDuration(queueFinishSeconds)} left
                {spPerMinute != null ? ` · ${spPerMinute.toFixed(1)} SP/min` : ''}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs opacity-60 mt-3 shrink-0">No skill training right now.</p>
      )}

      <div className="skills-page__inner-section mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="skills-page__inner-title shrink-0">Queue</p>
        {sorted.length === 0 ? (
          <p className="text-xs opacity-60">Skill queue is empty or paused.</p>
        ) : (
          <ol className="skills-page__queue-list">
            {sorted.map((entry, index) => {
              const info = skillNameById.get(entry.skill_id)
              const isActive = active?.queue_position === entry.queue_position
              const timeLabel = entryTimeLabel(
                isActive,
                queueFinishSeconds,
                scaled.remainingByPosition.get(entry.queue_position),
              )

              return (
                <li key={`${entry.skill_id}-${entry.queue_position}`} className="skills-page__queue-item">
                  <span className="text-[10px] opacity-40 tabular-nums w-4 shrink-0">
                    {index + 1}.
                  </span>
                  {info ? (
                    <img
                      src={skillIconUrl(entry.skill_id, 24)}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded shrink-0 bg-base-300"
                    />
                  ) : null}
                  <span className="text-xs truncate min-w-0 flex-1">
                    {info?.name ?? `Skill ${entry.skill_id}`}{' '}
                    {formatSkillLevel(entry.finished_level)}
                  </span>
                  <SkillAttrChips pair={trainingAttributesForSkill(entry.skill_id, skillNameById)} />
                  {timeLabel ? (
                    <span className="skills-page__queue-time">{timeLabel}</span>
                  ) : (
                    <span className="skills-page__queue-time opacity-40">Paused</span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
