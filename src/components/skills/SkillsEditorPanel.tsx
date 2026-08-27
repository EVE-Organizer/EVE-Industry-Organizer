import { useMemo, useState } from 'react'
import type { GlobalSettings, SkillLevels } from '@/types'
import { SkillLevelSlider } from '@/components/SkillLevelSlider'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { RangeSlider } from '@/components/RangeSlider'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import {
  SKILL_FIELDS,
  enforceSkillPrerequisites,
  formatSkillLevel,
  maxTrainableSkillLevel,
  skillLevel,
  skillPrerequisiteLabel,
  type SkillFieldDef,
} from '@/lib/skillFields'

const INDUSTRY_KEYS: SkillFieldDef['key'][] = [
  'industry',
  'advancedIndustry',
  'massProduction',
  'advancedMassProduction',
  'reactions',
]
const SCIENCE_KEYS: SkillFieldDef['key'][] = [
  'science',
  'laboratoryOperation',
  'advancedLaboratoryOperation',
]
const MARKET_KEYS: SkillFieldDef['key'][] = [
  'accounting',
  'brokerRelations',
  'advancedBrokerRelations',
]
const MINING_KEYS: SkillFieldDef['key'][] = [
  'mining',
  'astrogeology',
  'iceHarvesting',
  'gasCloudHarvesting',
  'miningBarge',
  'exhumers',
  'miningFrigate',
  'expeditionFrigates',
  'miningDirector',
  'industrialCommandShips',
  'capitalIndustrialShips',
]

const REPROCESSING_KEYS: SkillFieldDef['key'][] = [
  'reprocessing',
  'reprocessingEfficiency',
  'simpleOreProcessing',
  'coherentOreProcessing',
  'variegatedOreProcessing',
  'complexOreProcessing',
  'mercoxitOreProcessing',
  'abyssalOreProcessing',
  'erraticOreProcessing',
  'iceProcessing',
  'ubiquitousMoonOreProcessing',
  'commonMoonOreProcessing',
  'uncommonMoonOreProcessing',
  'rareMoonOreProcessing',
  'exceptionalMoonOreProcessing',
]

const GROUPS: { title: string; keys: SkillFieldDef['key'][] }[] = [
  { title: 'Industry', keys: INDUSTRY_KEYS },
  { title: 'Science', keys: SCIENCE_KEYS },
  { title: 'Trade', keys: MARKET_KEYS },
  { title: 'Mining', keys: MINING_KEYS },
  { title: 'Reprocessing', keys: REPROCESSING_KEYS },
]

interface SkillsEditorPanelProps {
  settings: GlobalSettings
  trainedSkills?: SkillLevels | null
  diffCount: number
  canResetToTrained: boolean
  onChange: (patch: Partial<GlobalSettings>) => void
  onResetToTrained: () => void
}

function fieldMatchesQuery(field: SkillFieldDef, query: string): boolean {
  if (!query) return true
  return field.label.toLowerCase().includes(query)
}

export function SkillsEditorPanel({
  settings,
  trainedSkills,
  diffCount,
  canResetToTrained,
  onChange,
  onResetToTrained,
}: SkillsEditorPanelProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const visibleGroups = useMemo(() => {
    return GROUPS.map((group) => ({
      ...group,
      fields: SKILL_FIELDS.filter(
        (f) => group.keys.includes(f.key) && fieldMatchesQuery(f, normalizedQuery),
      ),
    })).filter((g) => g.fields.length > 0)
  }, [normalizedQuery])

  const showInvention =
    !normalizedQuery ||
    'invention'.includes(normalizedQuery) ||
    normalizedQuery.includes('invent')

  return (
    <section className="skills-page__card flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h2 className="skills-page__section-title">Skills</h2>
        {diffCount > 0 ? (
          <p className="text-[10px] text-primary/80">
            {diffCount} skill{diffCount === 1 ? '' : 's'} differ from in-game
          </p>
        ) : null}
      </div>

      <div className="plan-search-wrap skills-page__search mb-4">
        <svg className="plan-search-wrap__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="search"
          className="plan-search-wrap__input input-sm"
          placeholder="Search skills…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4">
        {visibleGroups.length === 0 && !showInvention ? (
          <p className="text-xs opacity-50 text-center py-4">No skills match your search.</p>
        ) : null}

        {visibleGroups.map(({ title, fields }) => (
          <div key={title} className="skills-page__inner-section">
            <p className="skills-page__inner-title">{title}</p>
            {fields.map(({ key, skillId, label, tooltip }) => {
              const maxLevel = maxTrainableSkillLevel(settings.skills, key)
              const locked = maxLevel === 0
              const current = locked ? 0 : skillLevel(settings.skills, key)
              const trained = trainedSkills ? skillLevel(trainedSkills, key) : undefined
              return (
                <SkillLevelSlider
                  key={key}
                  skillId={skillId}
                  label={label}
                  tooltip={tooltip}
                  value={current}
                  max={maxLevel}
                  disabled={locked}
                  disabledReason={locked ? skillPrerequisiteLabel(key) : undefined}
                  trainedLevel={trained}
                  onChange={(level) => {
                    const nextSkills = enforceSkillPrerequisites({
                      ...settings.skills,
                      [key]: Math.min(level, maxLevel),
                    })
                    onChange({ skills: nextSkills })
                  }}
                />
              )
            })}
          </div>
        ))}

        {showInvention ? (
          <div className="skills-page__inner-section">
            <p className="skills-page__inner-title">Invention (assumed)</p>
            <p className="text-[10px] opacity-60 mb-2">
              Encryption and datacore levels for T2 plan cost.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <FormFieldLabel
                  label="Invention skill level"
                  tooltip={GLOBAL_SETTING_TOOLTIPS.inventionSkillLevel}
                  size="sm"
                />
                <RangeSlider
                  min={0}
                  max={5}
                  step={1}
                  value={settings.inventionSkillLevel}
                  onChange={(inventionSkillLevel) => onChange({ inventionSkillLevel })}
                  label="Invention skill level"
                />
              </div>
              <span className="text-xs tabular-nums text-primary shrink-0 pt-5">
                {formatSkillLevel(settings.inventionSkillLevel)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {canResetToTrained ? (
        <button
          type="button"
          className="btn btn-outline btn-sm mt-4 shrink-0"
          onClick={onResetToTrained}
        >
          Reset to trained
        </button>
      ) : null}
    </section>
  )
}
