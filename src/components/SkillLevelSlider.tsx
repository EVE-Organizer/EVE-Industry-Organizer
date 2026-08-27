import { formatSkillLevel, skillIconUrl } from '@/lib/skillFields'
import { InfoTooltip } from '@/components/InfoTooltip'

interface SkillLevelSliderProps {
  skillId: number
  label: string
  tooltip?: string
  value: number
  onChange: (level: number) => void
  min?: number
  max?: number
  disabled?: boolean
  disabledReason?: string
  trainedLevel?: number
  /** Tighter layout for inline mining fit rows. */
  compact?: boolean
}

export function SkillLevelSlider({
  skillId,
  label,
  tooltip,
  value,
  onChange,
  min = 0,
  max = 5,
  disabled = false,
  disabledReason,
  trainedLevel,
  compact = false,
}: SkillLevelSliderProps) {
  const hint = disabled ? disabledReason : undefined
  const trainedHint =
    trainedLevel != null && trainedLevel !== value
      ? `trained ${formatSkillLevel(trainedLevel)} · assumed ${formatSkillLevel(value)}`
      : undefined
  const iconSize = compact ? 20 : 32

  return (
    <div
      className={`flex items-center border-b border-eve-border/50 last:border-0${compact ? ' gap-1.5 py-0.5' : ' gap-3 py-2'}${disabled ? ' opacity-50' : ''}`}
    >
      <img
        src={skillIconUrl(skillId, iconSize)}
        alt=""
        width={iconSize}
        height={iconSize}
        className="rounded shrink-0 bg-base-300"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className={`flex justify-between items-center gap-1${compact ? '' : ' mb-1'}`}>
          <span
            className={`truncate inline-flex items-center gap-0.5 min-w-0${compact ? ' text-[11px] font-medium' : ' text-sm font-medium'}`}
          >
            <span className="truncate">{label}</span>
            {tooltip ? <InfoTooltip text={tooltip} placement="top" /> : null}
          </span>
          <span
            className={`tabular-nums text-primary shrink-0${compact ? ' text-[10px]' : ' text-xs'}`}
            title={`Level ${value}`}
          >
            {formatSkillLevel(value)}
            {compact ? null : <span className="opacity-50 ml-1">({value})</span>}
          </span>
        </div>
        {hint ? (
          <p className={`opacity-60${compact ? ' text-[9px] leading-tight' : ' text-[10px] mb-1'}`}>
            {hint}
          </p>
        ) : null}
        {!hint && trainedHint ? (
          <p className={`text-primary/70${compact ? ' text-[9px] leading-tight' : ' text-[10px] mb-1'}`}>
            {trainedHint}
          </p>
        ) : null}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={`range range-primary range-xs w-full${compact ? ' mining-filters__skill-range' : ''}`}
          aria-label={`${label} level`}
        />
        {compact ? null : (
          <div className="flex justify-between text-[10px] opacity-40 px-0.5 mt-0.5">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    </div>
  )
}
