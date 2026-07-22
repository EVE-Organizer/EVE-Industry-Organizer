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
      className={`rounded-lg border border-eve-border bg-base-300/15 p-4 flex flex-col gap-3 min-w-0 ${className}`}
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
}

/** Shared price method / window / haul controls for Blueprints and Plan. */
export function EconomicsFilterSection({
  values,
  onChange,
  children,
  title = 'Where & prices',
  hint = 'Hub is in the navbar. Market data and haul below.',
  className,
  layout = 'stack',
}: EconomicsFilterSectionProps) {
  if (layout === 'bar') {
    return (
      <div className={`economics-filter-bar ${className ?? ''}`.trim()}>
        {children}
        <label className="economics-filter-bar__method">
          <span className="economics-filter-bar__label">
            Price method
            <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.priceMethod} />
          </span>
          <select
            className="select select-bordered select-sm w-full min-w-0 sm:min-w-[12rem]"
            value={values.priceMethod}
            onChange={(e) =>
              onChange({
                priceMethod: e.target.value as GlobalSettings['priceMethod'],
              })
            }
          >
            <option value="sell_orders">Sell orders</option>
            <option value="buy_orders">Buy orders</option>
          </select>
        </label>

        <div className="economics-filter-bar__window">
          <span className="economics-filter-bar__label">
            Price window
            <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.priceWindow} />
          </span>
          <div role="group" aria-label="Price window" className="economics-filter-bar__chips">
            {TIME_WINDOWS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={values.priceWindow === r}
                className={`economics-filter-bar__chip${
                  values.priceWindow === r ? ' economics-filter-bar__chip--active' : ''
                }`}
                onClick={() => onChange({ priceWindow: r })}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <label className="economics-filter-bar__haul">
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={values.includeHaulCost}
            onChange={(e) => onChange({ includeHaulCost: e.target.checked })}
          />
          <span className="economics-filter-bar__haul-text">
            Include hauling
            <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.includeHaulCost} />
          </span>
        </label>
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
