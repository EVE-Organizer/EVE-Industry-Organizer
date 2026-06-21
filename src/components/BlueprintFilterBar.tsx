import type { BlueprintTier, TimeRange } from '@/types'
import { BLUEPRINT_TIERS } from '@/types'
import { HUBS } from '@/types'
import type { SdeData, ProductGroupCategoryNode } from '@/services/data/sdeLoader'
import { defaultQuery, type BlueprintQuery } from '@/lib/blueprintQuery'
import { useAppStore } from '@/stores/appStore'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'
import { ProductGroupPicker } from '@/components/ProductGroupPicker'
import { SetupBudgetRange } from '@/components/SetupBudgetRange'
import { InfoTooltip } from '@/components/InfoTooltip'
import { EveImage } from '@/components/EveImage'
import { TIER_FILTER_LABELS, TIER_TYPE_IDS } from '@/lib/eveImages'
import { useEffect, useState } from 'react'

const TIME_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']

interface BlueprintFilterBarProps {
  query: BlueprintQuery
  onChange: (patch: Partial<BlueprintQuery>) => void
  sde: SdeData | undefined
  productGroupTree: ProductGroupCategoryNode[]
  resultCount: number
}

export function BlueprintFilterBar({
  query,
  onChange,
  sde,
  productGroupTree,
  resultCount,
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
    onChange({ tiers, group: 'all' })
  }

  return (
    <section className="card bg-base-200 border border-eve-border w-full min-w-0 mb-4 shrink-0">
      <div className="card-body gap-0 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-eve-border">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold shrink-0">Filters</h2>
            <button type="button" className="btn btn-ghost btn-xs" onClick={handleReset}>
              Reset
            </button>
          </div>
          <span className="badge badge-ghost badge-sm self-start sm:self-auto tabular-nums">
            {resultCount} shown
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 min-w-0">
          <div className="flex flex-col min-w-0 divide-y divide-eve-border">
            <div className="flex flex-col gap-3 py-3 min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="form-control w-full min-w-0 sm:flex-1 sm:min-w-[10rem]">
                  <span className="label-text text-sm pb-1">Hub</span>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={query.hub}
                    onChange={(e) => onChange({ hub: e.target.value as typeof query.hub })}
                  >
                    {HUBS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>

                {sde && (
                  <label className="form-control w-full min-w-0 sm:flex-1 sm:min-w-[10rem]">
                    <span className="label-text text-sm pb-1">Mfg system</span>
                    <ManufacturingSystemPicker
                      value={query.mfgSystem}
                      onChange={(systemId) => onChange({ mfgSystem: systemId })}
                      systems={sde.systems}
                      regions={sde.regions}
                      className="w-full max-w-none"
                    />
                  </label>
                )}
              </div>

              <label className="form-control w-full min-w-0">
                <span className="label-text text-sm pb-1">Window</span>
                <div
                  role="group"
                  aria-label="Time window"
                  className="grid grid-cols-5 w-full min-w-0 rounded-lg border border-eve-border overflow-hidden divide-x divide-eve-border"
                >
                  {TIME_WINDOWS.map((r) => {
                    const active = query.window === r
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={active}
                        className={`btn btn-sm rounded-none min-h-9 min-w-0 border-0 px-0 font-medium ${
                          active
                            ? 'btn-primary hover:btn-primary'
                            : 'bg-base-200/50 hover:bg-base-300/70'
                        }`}
                        onClick={() => onChange({ window: r })}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-3 py-3 min-w-0">
              <div className="flex flex-wrap gap-2">
                {BLUEPRINT_TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={query.tiers.includes(t)}
                    className={`category-chip ${query.tiers.includes(t) ? 'btn-primary' : 'btn-ghost border border-eve-border'}`}
                    onClick={() => toggleTier(t)}
                  >
                    <EveImage id={TIER_TYPE_IDS[t]} size={20} framed alt="" />
                    {TIER_FILTER_LABELS[t]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <ProductGroupPicker
                  value={query.group}
                  onChange={(group) => onChange({ group })}
                  tree={productGroupTree}
                  className="w-full max-w-none min-w-0"
                />
                <InfoTooltip text="Search by group, category, or item name. Rankings reset to All groups when you change tiers." />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 py-3 min-w-0 border-t border-eve-border lg:border-t-0 lg:border-l lg:pl-8">
            <SetupBudgetRange
              minSlider={query.budgetMinSlider}
              maxSlider={query.budgetMaxSlider}
              onChange={(minSlider, maxSlider) =>
                onChange({ budgetMinSlider: minSlider, budgetMaxSlider: maxSlider })
              }
              className="w-full"
            />

            <label className="form-control w-full min-w-0 sm:max-w-[12rem]">
              <span className="label-text text-sm pb-1 inline-flex items-center gap-1">
                Min vol/day
                <InfoTooltip text="Hide blueprints whose average daily traded volume in the selected window is below this threshold. Uses the same Vol/day column as the table." />
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                className="input input-bordered input-sm w-full tabular-nums"
                placeholder="Any"
                value={minVolumeDraft}
                aria-label="Minimum average daily volume"
                onChange={(e) => setMinVolumeDraft(e.target.value)}
                onBlur={commitMinVolume}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="label cursor-pointer gap-2 justify-start py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={query.buildableOnly}
                  onChange={(e) => onChange({ buildableOnly: e.target.checked })}
                />
                <span className="label-text text-sm">Only buildable</span>
                <InfoTooltip text="Checks Industry and other skills you entered on your account." />
              </label>

              <label className="label cursor-pointer gap-2 justify-start py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={query.includeHaul}
                  onChange={(e) => onChange({ includeHaul: e.target.checked })}
                />
                <span className="label-text text-sm">Include hauling</span>
                <InfoTooltip text="Haul in (materials to build system) is added to setup cost; haul out (products to hub) is subtracted from profit. Turn off if you build and sell locally or haul on your own." />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
