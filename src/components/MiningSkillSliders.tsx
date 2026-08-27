import type { SkillLevels } from '@/types'
import { CharacterSkillResetButton } from '@/components/CharacterSkillResetButton'
import { InfoTooltip } from '@/components/InfoTooltip'
import { SkillLevelSlider } from '@/components/SkillLevelSlider'
import {
  SKILL_FIELDS,
  enforceSkillPrerequisites,
  maxTrainableSkillLevel,
  skillLevel,
  skillPrerequisiteLabel,
  type SkillFieldDef,
} from '@/lib/skillFields'

export type MiningSkillLayout = 'single' | 'grid-4'

interface MiningSkillSlidersProps {
  skills: SkillLevels
  trainedSkills?: SkillLevels | null
  keys: SkillFieldDef['key'][]
  onSkillsChange: (skills: SkillLevels) => void
  layout?: MiningSkillLayout
}

export interface MiningSkillGroup {
  label: string
  keys: SkillFieldDef['key'][]
}

interface CollapsibleMiningSkillsProps {
  skills: SkillLevels
  trainedSkills?: SkillLevels | null
  onSkillsChange: (skills: SkillLevels) => void
  summaryLabel?: string
  summaryTooltip?: string
  summaryStatus?: string | null
  className?: string
  layout?: MiningSkillLayout
  groups?: MiningSkillGroup[]
  keys?: SkillFieldDef['key'][]
}

export function CollapsibleMiningSkills({
  groups,
  keys,
  skills,
  trainedSkills,
  onSkillsChange,
  summaryLabel = 'Skills',
  summaryTooltip,
  summaryStatus,
  className,
  layout = 'single',
}: CollapsibleMiningSkillsProps) {
  const visibleGroups = groups?.filter((group) => group.keys.length > 0) ?? []
  const flatKeys = keys ?? []
  const resetKeys = flatKeys.length > 0 ? flatKeys : visibleGroups.flatMap((group) => group.keys)
  if (resetKeys.length === 0) return null

  return (
    <details
      className={`mining-filters__skill-fit-details${className ? ` ${className}` : ''}`}
    >
      <summary className="mining-filters__skill-fit-summary">
        <span className="mining-filters__skill-fit-heading">
          <span>{summaryLabel}</span>
          {summaryTooltip ? <InfoTooltip text={summaryTooltip} placement="top" /> : null}
        </span>
        {summaryStatus ? (
          <span className="mining-filters__skill-fit-status">{summaryStatus}</span>
        ) : null}
        <CharacterSkillResetButton
          className="mining-filters__skill-fit-reset"
          skills={skills}
          trainedSkills={trainedSkills}
          keys={resetKeys}
          onReset={onSkillsChange}
        />
      </summary>
      <div className="mining-filters__skill-groups">
        {flatKeys.length > 0 ? (
          <MiningSkillSliders
            skills={skills}
            trainedSkills={trainedSkills}
            keys={flatKeys}
            layout={layout}
            onSkillsChange={onSkillsChange}
          />
        ) : (
          visibleGroups.map((group) => (
            <div key={group.label} className="mining-filters__skill-group">
              <span className="mining-filters__skill-group-title">{group.label}</span>
              <MiningSkillSliders
                skills={skills}
                trainedSkills={trainedSkills}
                keys={group.keys}
                layout={layout}
                onSkillsChange={onSkillsChange}
              />
            </div>
          ))
        )}
      </div>
    </details>
  )
}

export function MiningSkillSliders({
  skills,
  trainedSkills,
  keys,
  onSkillsChange,
  layout = 'single',
}: MiningSkillSlidersProps) {
  if (keys.length === 0) return null

  function setSkill(key: SkillFieldDef['key'], level: number) {
    const maxLevel = maxTrainableSkillLevel(skills, key)
    onSkillsChange(
      enforceSkillPrerequisites({
        ...skills,
        [key]: Math.max(0, Math.min(maxLevel, level)),
      }),
    )
  }

  const layoutClass =
    layout === 'grid-4'
      ? 'mining-filters__skill-stack--grid-4'
      : 'mining-filters__skill-stack--single'

  return (
    <div className={`mining-filters__skill-stack ${layoutClass} w-full min-w-0`}>
      {keys.map((key) => {
        const field = SKILL_FIELDS.find((f) => f.key === key)
        if (!field) return null
        const maxLevel = maxTrainableSkillLevel(skills, key)
        const locked = maxLevel === 0
        const value = locked ? 0 : skillLevel(skills, key)
        return (
          <SkillLevelSlider
            key={key}
            skillId={field.skillId}
            label={field.label}
            tooltip={field.tooltip}
            value={value}
            max={maxLevel}
            compact
            disabled={locked}
            disabledReason={locked ? skillPrerequisiteLabel(key) : undefined}
            trainedLevel={trainedSkills ? skillLevel(trainedSkills, key) : undefined}
            onChange={(level) => setSkill(key, level)}
          />
        )
      })}
    </div>
  )
}
