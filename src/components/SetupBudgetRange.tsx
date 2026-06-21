import { useState } from 'react'
import { InfoTooltip } from '@/components/InfoTooltip'
import type { IskFieldState } from '@/hooks/useIskRangeInputs'
import { useIskRangeInputs } from '@/hooks/useIskRangeInputs'
import { formatIsk } from '@/lib/profit'
import {
  SETUP_BUDGET_MAX,
  SETUP_BUDGET_MIN,
  SETUP_BUDGET_SLIDER_STEPS,
  setupBudgetFromSlider,
  setupBudgetToSlider,
} from '@/lib/ranking'

interface SetupBudgetRangeProps {
  minSlider: number
  maxSlider: number
  onChange: (minSlider: number, maxSlider: number) => void
  className?: string
}

function IskUnitField({
  field,
  ariaLabel,
}: {
  field: IskFieldState
  ariaLabel: string
}) {
  return (
    <div
      className={`setup-budget__field ${field.editing ? 'setup-budget__field--active' : ''}`}
    >
      <input
        type="text"
        inputMode="decimal"
        className="setup-budget__field-input"
        value={field.amount}
        aria-label={ariaLabel}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onChange={(e) => field.setAmount(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <span className="setup-budget__field-unit">{field.unit}</span>
    </div>
  )
}

function BudgetDualRange({
  minSlider,
  maxSlider,
  onChange,
  label,
}: {
  minSlider: number
  maxSlider: number
  onChange: (min: number, max: number) => void
  label: string
}) {
  const [activeThumb, setActiveThumb] = useState<'min' | 'max'>('max')

  const span = SETUP_BUDGET_SLIDER_STEPS || 1
  const minPercent = (minSlider / span) * 100
  const maxPercent = (maxSlider / span) * 100

  function handleMinChange(nextMin: number) {
    if (nextMin > maxSlider) onChange(nextMin, nextMin)
    else onChange(nextMin, maxSlider)
  }

  function handleMaxChange(nextMax: number) {
    if (nextMax < minSlider) onChange(nextMax, nextMax)
    else onChange(minSlider, nextMax)
  }

  return (
    <div className="dual-range setup-budget__slider">
      <div className="dual-range__track" aria-hidden />
      <div
        className="dual-range__fill"
        style={{ left: `${minPercent}%`, width: `${Math.max(0, maxPercent - minPercent)}%` }}
        aria-hidden
      />
      <input
        type="range"
        min={0}
        max={SETUP_BUDGET_SLIDER_STEPS}
        step={1}
        value={minSlider}
        onChange={(e) => handleMinChange(Number(e.target.value))}
        onPointerDown={() => setActiveThumb('min')}
        className="dual-range__input dual-range__input--min"
        style={{ zIndex: activeThumb === 'min' ? 2 : 1 }}
        aria-label={`${label} minimum`}
      />
      <input
        type="range"
        min={0}
        max={SETUP_BUDGET_SLIDER_STEPS}
        step={1}
        value={maxSlider}
        onChange={(e) => handleMaxChange(Number(e.target.value))}
        onPointerDown={() => setActiveThumb('max')}
        className="dual-range__input dual-range__input--max"
        style={{ zIndex: activeThumb === 'max' ? 2 : 1 }}
        aria-label={`${label} maximum`}
      />
    </div>
  )
}

export function SetupBudgetRange({
  minSlider,
  maxSlider,
  onChange,
  className,
}: SetupBudgetRangeProps) {
  const minIsk = setupBudgetFromSlider(minSlider)
  const maxIsk = setupBudgetFromSlider(maxSlider)
  const rangeLabel = `${formatIsk(minIsk)} - ${formatIsk(maxIsk)}`

  const { minField, maxField } = useIskRangeInputs({
    minIsk,
    maxIsk,
    iskMin: SETUP_BUDGET_MIN,
    iskMax: SETUP_BUDGET_MAX,
    onCommit: (nextMin, nextMax) => {
      onChange(setupBudgetToSlider(nextMin), setupBudgetToSlider(nextMax))
    },
  })

  return (
    <div className={`setup-budget ${className ?? ''}`}>
      <div className="setup-budget__header">
        <span className="setup-budget__title">
          Upfront budget
          <InfoTooltip text="Only rank blueprints whose upfront capital (full blueprint purchase or invention cost + materials + job + haul in for one batch) falls in this range." />
        </span>
        <span className="setup-budget__summary">{rangeLabel}</span>
      </div>

      <div className="setup-budget__controls">
        <IskUnitField field={minField} ariaLabel="Upfront budget minimum (millions ISK)" />

        <div className="setup-budget__track-col">
          <BudgetDualRange
            minSlider={minSlider}
            maxSlider={maxSlider}
            onChange={onChange}
            label="Upfront budget"
          />
          <div className="setup-budget__axis">
            <span>{formatIsk(SETUP_BUDGET_MIN)}</span>
            <span>{formatIsk(SETUP_BUDGET_MAX)}</span>
          </div>
        </div>

        <IskUnitField field={maxField} ariaLabel="Upfront budget maximum (millions ISK)" />
      </div>
    </div>
  )
}
