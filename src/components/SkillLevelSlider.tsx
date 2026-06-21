import { formatSkillLevel, skillIconUrl } from '@/lib/skillFields'

interface SkillLevelSliderProps {
  skillId: number
  label: string
  value: number
  onChange: (level: number) => void
  min?: number
  max?: number
}

export function SkillLevelSlider({
  skillId,
  label,
  value,
  onChange,
  min = 0,
  max = 5,
}: SkillLevelSliderProps) {
  return (
    <div className="flex gap-3 items-center py-2 border-b border-eve-border/50 last:border-0">
      <img
        src={skillIconUrl(skillId, 32)}
        alt=""
        width={32}
        height={32}
        className="rounded shrink-0 bg-base-300"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-xs tabular-nums text-primary shrink-0" title={`Level ${value}`}>
            {formatSkillLevel(value)}
            <span className="opacity-50 ml-1">({value})</span>
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range range-primary range-xs w-full"
          aria-label={`${label} level`}
        />
        <div className="flex justify-between text-[10px] opacity-40 px-0.5 mt-0.5">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
