import type { GlobalSettings, RegionsData, SystemInfo } from '@/types'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { ManufacturingLocationPicker } from '@/components/ManufacturingLocationPicker'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'
import { RefineryLocationPicker } from '@/components/RefineryLocationPicker'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
interface PlanFacilityControlsProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  systems: SystemInfo[]
  regions: RegionsData
}

export function PlanFacilityControls({
  settings,
  onChange,
  systems,
  regions,
}: PlanFacilityControlsProps) {
  const facility = settings.reactionFacility
  const buildSystemLocked = settings.productionLocationId != null
  const reactionSystemLocked = settings.reactionLocationId != null

  return (
    <div className="plan-facility-controls">
      <div className="plan-facility-controls__grid">
        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Manufacturing location"
            tooltip={GLOBAL_SETTING_TOOLTIPS.structureType}
            size="sm"
          />
          <ManufacturingLocationPicker
            settings={settings}
            onChange={onChange}
            size="sm"
            showInventoryHint
          />
        </div>

        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Build system"
            tooltip={
              buildSystemLocked
                ? 'Set automatically from the selected manufacturing location.'
                : undefined
            }
            size="sm"
          />
          <ManufacturingSystemPicker
            size="sm"
            value={settings.manufacturingSystemId}
            onChange={(manufacturingSystemId) => onChange({ manufacturingSystemId })}
            systems={systems}
            regions={regions}
            costIndexKind="manufacturing"
            disabled={buildSystemLocked}
          />
        </div>

        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Reaction refinery"
            tooltip={GLOBAL_SETTING_TOOLTIPS.refineryType}
            size="sm"
          />
          <RefineryLocationPicker settings={settings} onChange={onChange} size="sm" />
        </div>

        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Reaction system"
            tooltip={
              reactionSystemLocked
                ? 'Set automatically from the selected refinery location.'
                : GLOBAL_SETTING_TOOLTIPS.reactionSystemId
            }
            size="sm"
          />
          <ManufacturingSystemPicker
            size="sm"
            value={facility.reactionSystemId}
            onChange={(reactionSystemId) =>
              onChange({
                reactionFacility: { ...facility, reactionSystemId },
              })
            }
            systems={systems}
            regions={regions}
            costIndexKind="reaction"
            disabled={reactionSystemLocked}
          />
        </div>
      </div>

      <p className="plan-facility-controls__hint">
        Rig bonuses and owner tax are in Settings. Changes here apply to this plan&apos;s cost
        estimates.
      </p>
    </div>
  )
}
