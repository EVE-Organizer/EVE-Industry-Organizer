import type { ReactNode } from 'react'
import type { BlueprintTier, TimeRange } from '@/types'
import {
  BATCH_SIZE_STEP,
  BLUEPRINT_TIERS,
  MAX_BATCH_SIZE,
  MIN_BATCH_SIZE,
} from '@/types'
import type { SdeData, ProductGroupCategoryNode } from '@/services/data/sdeLoader'
import { defaultQuery, type BlueprintQuery } from '@/lib/blueprintQuery'
import { useAppStore } from '@/stores/appStore'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'
import { ProductGroupPicker } from '@/components/ProductGroupPicker'
import { RangeSlider } from '@/components/RangeSlider'
import { SetupBudgetRange } from '@/components/SetupBudgetRange'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { EveImage } from '@/components/EveImage'
import { Panel } from '@/components/Panel'
import { TIER_FILTER_LABELS, TIER_IMAGE_VARIANTS, TIER_TYPE_IDS } from '@/lib/eveImages'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import { useEffect, useState } from 'react'

const TIME_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']

interface BlueprintFilterBarProps {
  query: BlueprintQuery
  onChange: (patch: Partial<BlueprintQuery>) => void
  sde: SdeData | undefined
  productGroupTree: ProductGroupCategoryNode[]
  resultCount: number
  resultPending?: boolean
}

function FilterSection({
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

function LimitsTile({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-md border border-eve-border bg-base-300/10 p-3 flex flex-col gap-2 min-w-0 ${className}`}
    >
      {children}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  className = '',
  tall = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  tall?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`category-chip ${active ? 'btn-primary' : 'btn-ghost border border-eve-border'} ${
        tall ? 'flex-col gap-1.5 min-h-[4.5rem] py-2' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function BlueprintFilterBar({
  query,
  onChange,
  sde,
  productGroupTree,
  resultCount,
  resultPending = false,
}: BlueprintFilterBarProps) {
  const settings = useAppStore((s) => s.userData.settings)
  const [minVolumeDraft, setMinVolumeDraft] = useState(
    query.minVolume > 0 ? String(query.minVolume) : '',
  )

  useEffect(() => {
    setMinVolumeDraft(query.minVolume > 0 ? String(query.minVolume) : '')
  }, [query.minVolume])

  function commitMinVolume() {
    const parsed = parseFloat(minVolumeDraft)
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    if (next !== query.minVolume) onChange({ minVolume: next })
    setMinVolumeDraft(next > 0 ? String(next) : '')
  }

  function handleReset() {
    onChange(defaultQuery(settings))
  }

  function toggleTier(tier: BlueprintTier) {
    const active = query.tiers.includes(tier)
    const tiers = active
      ? query.tiers.filter((t) => t !== tier)
      : [...query.tiers, tier]
    onChange({ tiers, groups: [] })
  }

  return (
    <Panel
      title="Filters"
      titleClassName="text-sm"
      compact
      className="w-full min-w-0 mb-4 shrink-0"
      bodyClassName="gap-4"
      actions={
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" className="btn btn-ghost btn-xs" onClick={handleReset}>
            Reset
          </button>
          <span className="badge badge-ghost badge-sm tabular-nums">
            {resultPending ? 'Updating…' : `${resultCount} shown`}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0 items-stretch">
          <FilterSection
            title="Where & prices"
            hint="Hub is in the navbar. Build system, market data, and availability below."
          >
            {sde ? (
              <label className="form-control w-full min-w-0">
                <FormFieldLabel label="Mfg system" size="sm" />
                <ManufacturingSystemPicker
                  value={query.mfgSystem}
                  onChange={(systemId) => onChange({ mfgSystem: systemId })}
                  systems={sde.systems}
                  regions={sde.regions}
                  className="w-full max-w-none"
                />
              </label>
            ) : null}

            <label className="form-control w-full min-w-0">
              <FormFieldLabel
                label="Price method"
                tooltip={GLOBAL_SETTING_TOOLTIPS.priceMethod}
                size="sm"
              />
              <select
                className="select select-bordered select-sm w-full"
                value={query.priceMethod}
                onChange={(e) =>
                  onChange({
                    priceMethod: e.target.value as typeof query.priceMethod,
                  })
                }
              >
                <option value="sell_orders">Sell orders (list and average)</option>
                <option value="buy_orders">Buy orders (instant sell)</option>
              </select>
            </label>

            <div className="form-control w-full min-w-0">
              <FormFieldLabel label="Price window" size="sm" />
              <div
                role="group"
                aria-label="Price window"
                className="grid grid-cols-5 gap-1.5 w-full min-w-0"
              >
                {TIME_WINDOWS.map((r) => (
                  <FilterChip
                    key={r}
                    active={query.window === r}
                    onClick={() => onChange({ window: r })}
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
                    checked={query.buildableOnly}
                    onChange={(e) => onChange({ buildableOnly: e.target.checked })}
                  />
                  <span className="label-text text-sm inline-flex items-center gap-1.5">
                    Only buildable
                    <InfoTooltip text="Checks Industry and other skills you entered during setup or in Settings." />
                  </span>
                </label>

                <label className="label cursor-pointer gap-2 justify-start py-0 min-h-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={query.includeHaul}
                    onChange={(e) => onChange({ includeHaul: e.target.checked })}
                  />
                  <span className="label-text text-sm inline-flex items-center gap-1.5">
                    Include hauling
                    <InfoTooltip text="Haul in (materials to build system) is added to setup cost; haul out (products to hub) is subtracted from profit. Turn off if you build and sell locally or haul on your own." />
                  </span>
                </label>
              </div>
            </div>
          </FilterSection>

          <FilterSection
            title="What to build"
            hint="Blueprint tier and product group"
            className="h-full"
          >
            <div className="shrink-0">
              <FormFieldLabel label="Tier" size="sm" />
              <div
                role="group"
                aria-label="Blueprint tier"
                className="grid grid-cols-3 gap-2 w-full min-w-0 mt-1"
              >
                {BLUEPRINT_TIERS.map((t) => (
                  <FilterChip
                    key={t}
                    active={query.tiers.includes(t)}
                    onClick={() => toggleTier(t)}
                    tall
                    className="min-w-0 justify-center"
                  >
                    <span className="rounded-md bg-base-100/90 p-1 shadow-sm">
                      <EveImage
                        id={TIER_TYPE_IDS[t]}
                        variant={TIER_IMAGE_VARIANTS[t]}
                        size={40}
                        framed
                        alt=""
                        lazy={false}
                      />
                    </span>
                    <span className="text-xs font-medium">{TIER_FILTER_LABELS[t]}</span>
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <FormFieldLabel
                label="Product group"
                tooltip="Check groups to limit rankings. Leave none selected for all groups. Rankings reset when you change tiers."
                size="sm"
              />
              <ProductGroupPicker
                variant="panel"
                value={query.groups}
                onChange={(groups) => onChange({ groups })}
                tree={productGroupTree}
                className="w-full"
              />
            </div>
          </FilterSection>
        </div>

        <FilterSection
          title="Your limits"
          hint="Budget, batch size, and volume"
        >
          <LimitsTile>
            <SetupBudgetRange
              minSlider={query.budgetMinSlider}
              maxSlider={query.budgetMaxSlider}
              onChange={(minSlider, maxSlider) =>
                onChange({ budgetMinSlider: minSlider, budgetMaxSlider: maxSlider })
              }
              className="w-full !border-0 !bg-transparent !p-0"
            />
          </LimitsTile>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LimitsTile>
              <FormFieldLabel
                label="Batch size (runs)"
                tooltip="Number of manufacturing runs per job. Profit, setup cost, and ISK/hr use this value, capped by hub volume when listed."
                valueLabel={query.batchSize}
                size="sm"
              />
              <div className="flex flex-col justify-end min-h-[2.75rem]">
                <RangeSlider
                  min={MIN_BATCH_SIZE}
                  max={MAX_BATCH_SIZE}
                  step={BATCH_SIZE_STEP}
                  value={query.batchSize}
                  onChange={(batchSize) => onChange({ batchSize })}
                  label="Batch size"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-base-content/50 tabular-nums px-0.5 mt-1">
                  <span>{MIN_BATCH_SIZE}</span>
                  <span>{MAX_BATCH_SIZE}</span>
                </div>
              </div>
            </LimitsTile>

            <LimitsTile>
              <FormFieldLabel
                label="Min vol/day"
                tooltip="Hide blueprints whose average daily traded volume is below this threshold. Uses the same Vol/day column as the table (1m volume when the price window is 1y)."
                size="sm"
              />
              <div className="flex items-end min-h-[2.75rem]">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="input input-bordered input-sm w-full tabular-nums h-8"
                  placeholder="Any"
                  value={minVolumeDraft}
                  aria-label="Minimum average daily volume"
                  onChange={(e) => setMinVolumeDraft(e.target.value)}
                  onBlur={commitMinVolume}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
              </div>
            </LimitsTile>
          </div>
        </FilterSection>
      </div>
    </Panel>
  )
}
