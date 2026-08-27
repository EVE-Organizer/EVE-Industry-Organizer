import { useMemo, type MouseEvent } from 'react'
import { RefreshIcon } from '@/components/EveAuthIcons'
import {
  enforceSkillPrerequisites,
  skillLevel,
  type SkillFieldDef,
} from '@/lib/skillFields'
import type { SkillLevels } from '@/types'

interface CharacterSkillResetButtonProps {
  skills: SkillLevels
  trainedSkills?: SkillLevels | null
  keys: SkillFieldDef['key'][]
  onReset: (skills: SkillLevels) => void
  className?: string
}

export function CharacterSkillResetButton({
  skills,
  trainedSkills,
  keys,
  onReset,
  className = '',
}: CharacterSkillResetButtonProps) {
  const canReset = useMemo(() => {
    if (!trainedSkills || keys.length === 0) return false
    return keys.some((key) => skillLevel(skills, key) !== skillLevel(trainedSkills, key))
  }, [keys, skills, trainedSkills])

  if (!trainedSkills || keys.length === 0) return null

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!trainedSkills || !canReset) return

    const next = { ...skills }
    for (const key of keys) {
      next[key] = skillLevel(trainedSkills, key)
    }
    onReset(enforceSkillPrerequisites(next))
  }

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-xs btn-square shrink-0 min-h-0 h-5 w-5 opacity-60 hover:opacity-100 disabled:pointer-events-none disabled:opacity-25 ${className}`.trim()}
      disabled={!canReset}
      aria-label="Reset skills to character trained levels"
      title={
        canReset
          ? 'Reset to character trained levels'
          : 'Skills match character trained levels'
      }
      onClick={handleClick}
    >
      <RefreshIcon className="size-3" />
    </button>
  )
}
