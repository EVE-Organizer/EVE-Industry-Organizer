import { useState } from 'react'
import { SkillLevelSlider } from '@/components/SkillLevelSlider'
import {
  SKILL_FIELDS,
  enforceSkillPrerequisites,
  maxTrainableSkillLevel,
  skillLevel,
  type SkillFieldDef,
} from '@/lib/skillFields'
import { useAppStore } from '@/stores/appStore'
import type { ManualCharacter } from '@/types'

/** Skills that change slots, job speed, or what a character can build in a plan. */
const PLAN_SKILL_KEYS: SkillFieldDef['key'][] = [
  'industry',
  'advancedIndustry',
  'massProduction',
  'advancedMassProduction',
  'reactions',
  'massReactions',
  'advancedMassReactions',
  'science',
  'laboratoryOperation',
  'advancedLaboratoryOperation',
  'accounting',
  'brokerRelations',
  'advancedBrokerRelations',
]

const PLAN_SKILL_FIELDS = SKILL_FIELDS.filter((f) => PLAN_SKILL_KEYS.includes(f.key))

/** Stable fallback so Zustand's snapshot compare does not see a new array each render. */
const EMPTY_MANUAL_CHARACTERS: ManualCharacter[] = []

function ManualCharacterCard({ character }: { character: ManualCharacter }) {
  const updateManualCharacter = useAppStore((s) => s.updateManualCharacter)
  const removeManualCharacter = useAppStore((s) => s.removeManualCharacter)
  const settingsSkills = useAppStore((s) => s.userData.settings.skills)

  return (
    <li className="rounded-lg border border-eve-border bg-base-200/40 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="input input-bordered input-sm flex-1 min-w-0"
          value={character.name}
          aria-label="Character name"
          onChange={(e) => updateManualCharacter(character.id, { name: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => updateManualCharacter(character.id, { skills: settingsSkills })}
        >
          Copy skills from Settings
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm btn-error"
          onClick={() => removeManualCharacter(character.id)}
        >
          Remove
        </button>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs opacity-70">Plan skills</summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {PLAN_SKILL_FIELDS.map(({ key, skillId, label, tooltip }) => {
            const max = maxTrainableSkillLevel(character.skills, key)
            return (
              <SkillLevelSlider
                key={key}
                skillId={skillId}
                label={label}
                tooltip={tooltip}
                value={max === 0 ? 0 : skillLevel(character.skills, key)}
                max={max}
                disabled={max === 0}
                onChange={(level) =>
                  updateManualCharacter(character.id, {
                    skills: enforceSkillPrerequisites({
                      ...character.skills,
                      [key]: Math.min(level, max),
                    }),
                  })
                }
              />
            )
          })}
        </div>
      </details>
    </li>
  )
}

/** Characters you type in by hand. They can join plans next to signed-in characters. */
export function ManualCharactersPanel() {
  const manualCharacters =
    useAppStore((s) => s.userData.manualCharacters) ?? EMPTY_MANUAL_CHARACTERS
  const addManualCharacter = useAppStore((s) => s.addManualCharacter)
  const settingsSkills = useAppStore((s) => s.userData.settings.skills)
  const [name, setName] = useState('')

  function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    // Start from the Settings skills so the new character is usable right away
    addManualCharacter(trimmed, settingsSkills)
    setName('')
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex items-center gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          type="text"
          className="input input-bordered input-sm flex-1 min-w-0"
          placeholder="Character name"
          value={name}
          aria-label="New character name"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
          Add character
        </button>
      </form>
      {manualCharacters.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {manualCharacters.map((character) => (
            <ManualCharacterCard key={character.id} character={character} />
          ))}
        </ul>
      ) : (
        <p className="text-xs opacity-60">No manual characters yet.</p>
      )}
    </div>
  )
}
