import type { ReactNode } from 'react'
import { MAX_BATCH_SIZE, MIN_BATCH_SIZE } from '@/types'
import type { SdeData, ProductGroupCategoryNode } from '@/services/data/sdeLoader'
import {
  clampBatchSize,
  clampMinVolume,
  defaultQuery,
  MAX_MIN_VOLUME_SLIDER,
  type BlueprintQuery,
} from '@/lib/blueprintQuery'
import { useAppStore } from '@/stores/appStore'
import { CompactSliderField } from '@/components/CompactSliderField'
import { SetupBudgetRange } from '@/components/SetupBudgetRange'
import { PlanFacilityControls } from '@/components/plan/PlanFacilityControls'
import {
  EconomicsFilterSection,
  FilterSection,
} from '@/components/EconomicsFilterSection'
import { BlueprintPickerFilterSection } from '@/components/BlueprintPickerFilterSection'
import { InfoTooltip } from '@/components/InfoTooltip'
import { formatAvgVolume, formatInputDecimal, formatNumber } from '@/lib/profit'
import type { GlobalSettings } from '@/types'

interface BlueprintFilterBarProps {
  query: BlueprintQuery
  onChange: (patch: Partial<BlueprintQuery>) => void
  sde: SdeData | undefined
  productGroupTree: ProductGroupCategoryNode[]
  resultCount: number
  resultPending?: boolean
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
      className={`rounded-md border border-eve-border/70 bg-base-300/10 p-3 flex flex-col gap-2 min-w-0 ${className}`}
    >
      {children}
    </div>
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
  const updateSettings = useAppStore((s) => s.updateSettings)

  function handleReset() {
    onChange(defaultQuery(settings))
  }

  function onEconomicsChange(patch: {
    priceMethod?: BlueprintQuery['priceMethod']
    priceWindow?: BlueprintQuery['window']
    includeHaulCost?: boolean
  }) {
    const queryPatch: Partial<BlueprintQuery> = {}
    const settingsPatch: Partial<GlobalSettings> = {}
    if (patch.priceMethod != null) {
      queryPatch.priceMethod = patch.priceMethod
      settingsPatch.priceMethod = patch.priceMethod
    }
    if (patch.priceWindow != null) {
      queryPatch.window = patch.priceWindow
      settingsPatch.priceWindow = patch.priceWindow
    }
    if (patch.includeHaulCost != null) {
      queryPatch.includeHaul = patch.includeHaulCost
      settingsPatch.includeHaulCost = patch.includeHaulCost
    }
    if (Object.keys(queryPatch).length) onChange(queryPatch)
    if (Object.keys(settingsPatch).length) updateSettings(settingsPatch)
  }

  function onFacilityChange(patch: Partial<GlobalSettings>) {
    updateSettings(patch)
    if (patch.manufacturingSystemId != null) {
      onChange({ mfgSystem: patch.manufacturingSystemId })
    }
  }

  return (
    <section className="blueprint-filters">
      <header className="blueprint-filters__header">
        <div className="min-w-0">
          <h2 className="blueprint-filters__title">Filters</h2>
          <p className="blueprint-filters__subtitle">
            Station, market window, and what to rank
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" className="btn btn-ghost btn-xs" onClick={handleReset}>
            Reset
          </button>
          <span className="badge badge-primary badge-sm badge-outline border-primary/30 tabular-nums font-normal">
            {resultPending ? 'Updating…' : `${resultCount} shown`}
          </span>
        </div>
      </header>

      <div className="blueprint-filters__body">
        {sde ? (
          <PlanFacilityControls
            settings={{
              ...settings,
              manufacturingSystemId: query.mfgSystem,
            }}
            onChange={onFacilityChange}
            systems={sde.systems}
            regions={sde.regions}
            hint="Rig bonuses and owner tax are in Settings. Station and system changes apply to ranking cost estimates."
          />
        ) : null}

        <div className="blueprint-filters__market">
          <div className="blueprint-filters__market-head">
            <h3 className="text-sm font-semibold leading-tight">Market pricing</h3>
            <p className="text-xs opacity-50 hidden sm:block">Hub is in the navbar</p>
          </div>
          <EconomicsFilterSection
            layout="bar"
            values={{
              priceMethod: query.priceMethod,
              priceWindow: query.window,
              includeHaulCost: query.includeHaul,
            }}
            onChange={onEconomicsChange}
          />
        </div>

        <div className="blueprint-filters__grid">
          <BlueprintPickerFilterSection
            values={{
              tiers: query.tiers,
              groups: query.groups,
              buildableOnly: query.buildableOnly,
            }}
            onChange={(patch) => onChange(patch)}
            productGroupTree={productGroupTree}
            title="Catalog"
            hint="Tier, product group, and buildable-only."
            className="blueprint-filters__card"
            extraAvailability={
              <label className="label cursor-pointer gap-2 justify-start py-0 min-h-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={query.requireBlueprintPrice}
                  onChange={(e) => onChange({ requireBlueprintPrice: e.target.checked })}
                />
                <span className="label-text text-sm inline-flex items-center gap-1.5">
                  Require BPO/BPC price
                  <InfoTooltip text="Hide T1 blueprints with no market BPO and no public BPC contract at your hub or Jita. Also hides charges like Condenser Packs that skip blueprint cost but still have no listing." />
                </span>
              </label>
            }
          />

          <FilterSection
            title="Ranking limits"
            hint="Budget, batch size, and volume cutoffs"
            className="blueprint-filters__card"
          >
            <div className="blueprint-filters__limits-body">
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

              <div className="grid grid-cols-1 gap-3 min-w-0 items-stretch">
                <CompactSliderField
                  variant="panel"
                  label="Batch size"
                  tooltip="Number of manufacturing runs per job. Setup cost and profit scale with this value. ISK/hr also caps sell rate to hub volume."
                  value={query.batchSize}
                  onChange={(batchSize) => onChange({ batchSize })}
                  min={MIN_BATCH_SIZE}
                  max={MAX_BATCH_SIZE}
                  step={1}
                  unit="runs"
                  formatSummary={(v) => `${formatNumber(v, 0)} runs`}
                  formatDisplay={(v) => formatInputDecimal(v, 0)}
                  parseInput={(raw) => {
                    const parsed = parseFloat(raw.trim())
                    return Number.isFinite(parsed) ? parsed : null
                  }}
                  clampValue={clampBatchSize}
                  formatAxis={(v) => formatNumber(v, 0)}
                  ariaLabel="Batch size (runs)"
                />

                <CompactSliderField
                  variant="panel"
                  label="Min vol/day"
                  tooltip="Hide blueprints whose average daily traded volume is below this threshold. Uses the same Vol/day column as the table (1m volume when the price window is 1y)."
                  value={query.minVolume}
                  onChange={(minVolume) => onChange({ minVolume })}
                  min={0}
                  max={MAX_MIN_VOLUME_SLIDER}
                  step={0.1}
                  unit="/d"
                  formatSummary={(v) => (v > 0 ? `${formatAvgVolume(v)}/d` : 'Any')}
                  formatDisplay={(v) => (v > 0 ? formatInputDecimal(v, 1) : '')}
                  parseInput={(raw) => {
                    const trimmed = raw.trim()
                    if (!trimmed) return 0
                    const parsed = parseFloat(trimmed)
                    return Number.isFinite(parsed) ? parsed : null
                  }}
                  clampValue={clampMinVolume}
                  formatAxis={(v) => (v === 0 ? 'Any' : formatAvgVolume(v))}
                  inputPlaceholder="Any"
                  ariaLabel="Minimum average daily volume"
                />
              </div>
            </div>
          </FilterSection>
        </div>
      </div>
    </section>
  )
}
