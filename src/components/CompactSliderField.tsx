import { InfoTooltip } from '@/components/InfoTooltip'
import { RangeSlider } from '@/components/RangeSlider'
import { useNumericSliderInput, type NumericFieldState } from '@/hooks/useNumericSliderInput'

interface CompactSliderFieldProps {
  label: string
  tooltip?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  formatSummary: (value: number) => string
  formatDisplay: (value: number) => string
  parseInput: (raw: string) => number | null
  clampValue: (value: number) => number
  formatAxis?: (value: number) => string
  ariaLabel: string
  inputPlaceholder?: string
  variant?: 'inline' | 'panel'
  className?: string
}

function NumericUnitField({
  field,
  unit,
  ariaLabel,
  placeholder,
}: {
  field: NumericFieldState
  unit?: string
  ariaLabel: string
  placeholder?: string
}) {
  return (
    <div
      className={`setup-budget__field ${field.editing ? 'setup-budget__field--active' : ''}`}
    >
      <input
        type="text"
        inputMode="decimal"
        className="setup-budget__field-input"
        value={field.text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onChange={(e) => field.setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      {unit ? <span className="setup-budget__field-unit">{unit}</span> : null}
    </div>
  )
}

export function CompactSliderField({
  label,
  tooltip,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  formatSummary,
  formatDisplay,
  parseInput,
  clampValue,
  formatAxis = String,
  ariaLabel,
  inputPlaceholder,
  variant = 'inline',
  className,
}: CompactSliderFieldProps) {
  const field = useNumericSliderInput({
    value,
    formatDisplay,
    parseInput,
    clampValue,
    onCommit: onChange,
  })

  const sliderValue = Math.min(max, Math.max(min, value))
  const isPanel = variant === 'panel'

  const input = (
    <NumericUnitField
      field={field}
      unit={unit}
      ariaLabel={ariaLabel}
      placeholder={inputPlaceholder}
    />
  )

  const track = (
    <div className="compact-slider__track-col">
      <RangeSlider
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={onChange}
        label={ariaLabel}
        className="w-full"
      />
      <div className="setup-budget__axis">
        <span>{formatAxis(min)}</span>
        <span>{formatAxis(max)}</span>
      </div>
    </div>
  )

  return (
    <div
      className={`compact-slider ${isPanel ? 'compact-slider--panel' : ''} ${className ?? ''}`}
    >
      <div className="compact-slider__header">
        <span className="compact-slider__title">
          {label}
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
        </span>
        <span className="compact-slider__summary">{formatSummary(value)}</span>
      </div>

      {isPanel ? (
        <>
          <div className="compact-slider__input-row">{input}</div>
          {track}
        </>
      ) : (
        <div className="compact-slider__controls">
          {input}
          {track}
        </div>
      )}
    </div>
  )
}
