interface RangeSliderProps {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  label: string
  step?: number
  className?: string
}

/** Single-thumb range using the same track/thumb styling as setup budget dual-range. */
export function RangeSlider({
  min,
  max,
  value,
  onChange,
  label,
  step = 1,
  className,
}: RangeSliderProps) {
  const span = max - min || 1
  const percent = ((value - min) / span) * 100

  return (
    <div className={`dual-range ${className ?? ''}`}>
      <div className="dual-range__track" aria-hidden />
      <div
        className="dual-range__fill"
        style={{ left: '0%', width: `${percent}%` }}
        aria-hidden
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dual-range__input"
        style={{ zIndex: 1 }}
        aria-label={label}
      />
    </div>
  )
}
