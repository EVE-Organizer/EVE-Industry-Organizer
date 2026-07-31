import type { ReactNode } from 'react'
import type { GlobalSettings, TimeRange } from '@/types'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'

const TIME_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']

export function FilterSection({
  title,
  hint,
  children,
  className = '',
}: {
  title: string
  hint: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`filter-section rounded-lg border border-eve-border p-4 flex flex-col gap-3 min-w-0 ${className}`}
    >
      <header className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <p className="text-xs opacity-50 mt-0.5">{hint}</p>
      </header>
      {children}
    </section>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`category-chip ${active ? 'btn-primary' : 'btn-ghost border border-eve-border'} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export interface EconomicsFilterValues {
  priceMethod: GlobalSettings['priceMethod']
  priceWindow: TimeRange
  includeHaulCost: boolean
}

interface EconomicsFilterSectionProps {
  values: EconomicsFilterValues
  onChange: (patch: Partial<EconomicsFilterValues>) => void
  /** Extra controls (e.g. mfg system on Blueprints). */
  children?: ReactNode
  title?: string
  hint?: string
  className?: string
  /** `stack` = card layout; `bar` = compact horizontal strip. */
  layout?: 'stack' | 'bar'
  /** Plan bar: window first, buy/sell select grouped left of Include hauling. */
  barVariant?: 'default' | 'plan'
}

function PriceMethodChips({
  value,
  onChange,
}: {
  value: GlobalSettings['priceMethod']
  onChange: (priceMethod: GlobalSettings['priceMethod']) => void
}) {
  return (
    <div role="group" aria-label="Price method" className="economics-filter-bar__chips">
      <button
        type="button"
        aria-pressed={value === 'sell_orders'}
        className={`economics-filter-bar__chip${
          value === 'sell_orders' ? ' economics-filter-bar__chip--active' : ''
        }`}
        onClick={() => onChange('sell_orders')}
      >
        Sell
      </button>
      <button
        type="button"
        aria-pressed={value === 'buy_orders'}
        className={`economics-filter-bar__chip${
          value === 'buy_orders' ? ' economics-filter-bar__chip--active' : ''
        }`}
        onClick={() => onChange('buy_orders')}
      >
        Buy
      </button>
    </div>
  )
}

function PriceWindowChips({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (priceWindow: TimeRange) => void
}) {
  return (
    <div role="group" aria-label="Price window" className="economics-filter-bar__chips">
      {TIME_WINDOWS.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          className={`economics-filter-bar__chip${
            value === r ? ' economics-filter-bar__chip--active' : ''
          }`}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function IncludeHaulToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (includeHaulCost: boolean) => void
}) {
  return (
    <label className="economics-filter-bar__haul">
      <input
        type="checkbox"
        className="toggle toggle-sm toggle-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="economics-filter-bar__haul-text">
        Include hauling
        <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.includeHaulCost} />
      </span>
    </label>
  )
}

/** Shared price method / window / haul controls for Blueprints and Plan. */
export function EconomicsFilterSection({
  values,
  onChange,
  children,
  title = 'Where & prices',
  hint = 'Buy and sell hubs are in the navbar. Market data and haul below.',
  className,
  layout = 'stack',
  barVariant = 'default',
}: EconomicsFilterSectionProps) {
  if (layout === 'bar') {
    if (barVariant === 'plan') {
      return (
        <div className={`economics-filter-bar economics-filter-bar--plan ${className ?? ''}`.trim()}>
          {children}
          <div className="economics-filter-bar__window">
            <span className="economics-filter-bar__label">
              Price window
              <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.priceWindow} />
            </span>
            <PriceWindowChips
              value={values.priceWindow}
              onChange={(priceWindow) => onChange({ priceWindow })}
            />
          </div>

          <div className="economics-filter-bar__trail">
            <label className="economics-filter-bar__method-select">
              <span className="economics-filter-bar__label">
                Price method
                <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.priceMethod} />
              </span>
              <select
                className="select select-bordered select-xs economics-filter-bar__select"
                value={values.priceMethod}
                aria-label="Price method"
                onChange={(e) =>
                  onChange({
                    priceMethod: e.target.value as GlobalSettings['priceMethod'],
                  })
                }
              >
                <option value="sell_orders">Sell</option>
                <option value="buy_orders">Buy</option>
              </select>
            </label>
            <IncludeHaulToggle
              checked={values.includeHaulCost}
              onChange={(includeHaulCost) => onChange({ includeHaulCost })}
            />
          </div>
        </div>
      )
    }

    return (
      <div className={`economics-filter-bar ${className ?? ''}`.trim()}>
        {children}
        <label className="economics-filter-bar__method">
          <span className="economics-filter-bar__label">
            Price method
            <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.priceMethod} />
          </span>
          <PriceMethodChips
            value={values.priceMethod}
            onChange={(priceMethod) => onChange({ priceMethod })}
          />
        </label>

        <div className="economics-filter-bar__window">
          <span className="economics-filter-bar__label">
            Price window
            <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.priceWindow} />
          </span>
          <PriceWindowChips
            value={values.priceWindow}
            onChange={(priceWindow) => onChange({ priceWindow })}
          />
        </div>

        <IncludeHaulToggle
          checked={values.includeHaulCost}
          onChange={(includeHaulCost) => onChange({ includeHaulCost })}
        />
      </div>
    )
  }

  return (
    <FilterSection title={title} hint={hint} className={className}>
      {children}

      <label className="form-control w-full min-w-0">
        <FormFieldLabel
          label="Price method"
          tooltip={GLOBAL_SETTING_TOOLTIPS.priceMethod}
          size="sm"
        />
        <select
          className="select select-bordered select-sm w-full"
          value={values.priceMethod}
          onChange={(e) =>
            onChange({
              priceMethod: e.target.value as GlobalSettings['priceMethod'],
            })
          }
        >
          <option value="sell_orders">Sell orders (list and average)</option>
          <option value="buy_orders">Buy orders (instant sell)</option>
        </select>
      </label>

      <div className="form-control w-full min-w-0">
        <FormFieldLabel
          label="Price window"
          tooltip={GLOBAL_SETTING_TOOLTIPS.priceWindow}
          size="sm"
        />
        <div
          role="group"
          aria-label="Price window"
          className="grid grid-cols-5 gap-1.5 w-full min-w-0"
        >
          {TIME_WINDOWS.map((r) => (
            <FilterChip
              key={r}
              active={values.priceWindow === r}
              onClick={() => onChange({ priceWindow: r })}
              className="min-w-0 px-0"
            >
              {r}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="form-control w-full min-w-0">
        <FormFieldLabel label="Availability" size="sm" />
        <div className="rounded-md border border-eve-border bg-base-300/10 px-3 py-2.5 flex flex-col gap-2">
          <label className="label cursor-pointer gap-2 justify-start py-0 min-h-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={values.includeHaulCost}
              onChange={(e) => onChange({ includeHaulCost: e.target.checked })}
            />
            <span className="label-text text-sm inline-flex items-center gap-1.5">
              Include hauling
              <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.includeHaulCost} />
            </span>
          </label>
        </div>
      </div>
    </FilterSection>
  )
}
