import type { MissingBuildSkill } from '@/lib/buildRequirements'
import { formatSkillLevel } from '@/lib/skillFields'
import { EveImage } from '@/components/EveImage'

function buildSkillGapTooltip(missing: MissingBuildSkill[]): string {
  return missing
    .map(
      (m) =>
        `${m.skillName}: need ${formatSkillLevel(m.requiredLevel)}, have ${formatSkillLevel(m.currentLevel)}`,
    )
    .join(' · ')
}

interface BuildSkillGapFlagProps {
  missing: MissingBuildSkill[]
  className?: string
  size?: number
}

export function BuildSkillGapFlag({ missing, className = '', size = 14 }: BuildSkillGapFlagProps) {
  if (!missing.length) return null

  const primary = missing[0]!
  const tooltip = buildSkillGapTooltip(missing)

  return (
    <span
      className={`tooltip tooltip-right inline-flex shrink-0 items-center before:max-w-xs before:text-left before:whitespace-normal before:content-[attr(data-tip)] ${className}`}
      data-tip={tooltip}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span
        className="inline-flex rounded-full ring-1 ring-error bg-error/10 p-px"
        aria-label={tooltip}
        tabIndex={0}
      >
        <EveImage
          id={primary.skillId}
          size={size}
          alt={primary.skillName}
          className="rounded-full"
        />
      </span>
    </span>
  )
}
