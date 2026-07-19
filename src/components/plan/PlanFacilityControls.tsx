import type { GlobalSettings, RegionsData, SystemInfo } from '@/types'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { StructureTypePicker } from '@/components/StructureTypePicker'
import { RefineryTypePicker } from '@/components/RefineryTypePicker'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import { patchStructureType } from '@/lib/structureSettings'
import { patchRefineryType } from '@/lib/refinerySettings'

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

  return (
    <div className="plan-facility-controls">
      <div className="plan-facility-controls__grid">
        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Manufacturing location"
            tooltip={GLOBAL_SETTING_TOOLTIPS.structureType}
            size="sm"
          />
          <StructureTypePicker
            size="sm"
            value={settings.structureType}
            onChange={(structureType) => onChange(patchStructureType(structureType))}
          />
        </div>

        <div className="plan-facility-controls__field">
          <FormFieldLabel label="Build system" size="sm" />
          <ManufacturingSystemPicker
            size="sm"
            value={settings.manufacturingSystemId}
            onChange={(manufacturingSystemId) => onChange({ manufacturingSystemId })}
            systems={systems}
            regions={regions}
            costIndexKind="manufacturing"
          />
        </div>

        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Reaction refinery"
            tooltip={GLOBAL_SETTING_TOOLTIPS.refineryType}
            size="sm"
          />
          <RefineryTypePicker
            size="sm"
            value={facility.refineryType}
            onChange={(refineryType) => onChange(patchRefineryType(refineryType, facility))}
          />
        </div>

        <div className="plan-facility-controls__field">
          <FormFieldLabel
            label="Reaction system"
            tooltip={GLOBAL_SETTING_TOOLTIPS.reactionSystemId}
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
