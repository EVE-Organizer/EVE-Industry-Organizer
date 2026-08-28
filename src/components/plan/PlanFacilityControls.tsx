import { defaultScienceFacility } from '@/types'
import type { GlobalSettings, RegionsData, SystemInfo } from '@/types'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { ManufacturingLocationPicker } from '@/components/ManufacturingLocationPicker'
import { ManufacturingRigFields } from '@/components/ManufacturingRigFields'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'
import {
  ReactionFacilityBonusFields,
  ScienceFacilityBonusFields,
} from '@/components/GlobalSettingsForm'
import { RefineryLocationPicker } from '@/components/RefineryLocationPicker'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import { isActiveRefinery } from '@/lib/refinerySettings'
import {
  isPlayerStructure,
  patchManufacturingSystemFromList,
  scienceFacilityForSystem,
  securityForSystem,
} from '@/lib/structureSettings'

interface PlanFacilityControlsProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  systems: SystemInfo[]
  regions: RegionsData
  hint?: string
  className?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function PlanFacilityControls({
  settings,
  onChange,
  systems,
  regions,
  hint,
  className = '',
  onRefresh,
  isRefreshing = false,
}: PlanFacilityControlsProps) {
  const facility = settings.reactionFacility
  const copyFacility =
    settings.copyFacility ?? defaultScienceFacility(settings.manufacturingSystemId)
  const inventionFacility =
    settings.inventionFacility ?? defaultScienceFacility(settings.manufacturingSystemId)
  const buildSystemLocked = settings.productionLocationId != null
  const reactionSystemLocked = settings.reactionLocationId != null

  function onManufacturingSystemChange(manufacturingSystemId: number) {
    onChange(
      patchManufacturingSystemFromList(
        systems,
        manufacturingSystemId,
        settings.buildSystemSecurity ?? 1,
      ),
    )
  }

  return (
    <div className={`plan-facility-controls ${className}`.trim()}>
      <div className="plan-facility-controls__sections">
        <section className="plan-facility-controls__section">
          <div className="plan-facility-controls__row">
            <div className="plan-facility-controls__field">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <FormFieldLabel
                    label="Manufacturing location"
                    tooltip={GLOBAL_SETTING_TOOLTIPS.structureType}
                    size="sm"
                  />
                  <ManufacturingLocationPicker
                    settings={settings}
                    onChange={onChange}
                    systems={systems}
                    size="sm"
                    showInventoryHint
                  />
                </div>
                {settings.productionLocationId != null && onRefresh ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shrink-0 gap-2"
                    disabled={isRefreshing}
                    onClick={() => void onRefresh()}
                  >
                    {isRefreshing ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Refreshing…
                      </>
                    ) : (
                      'Refresh'
                    )}
                  </button>
                ) : null}
              </div>
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
                onChange={onManufacturingSystemChange}
                systems={systems}
                regions={regions}
                costIndexKind="manufacturing"
                disabled={buildSystemLocked}
              />
            </div>
          </div>

          {isPlayerStructure(settings.structureType) ? (
            <ManufacturingRigFields settings={settings} onChange={onChange} size="sm" />
          ) : null}
        </section>

        <section className="plan-facility-controls__section">
          <div className="plan-facility-controls__row">
            <div className="plan-facility-controls__field">
              <FormFieldLabel
                label="Copy location"
                tooltip={GLOBAL_SETTING_TOOLTIPS.copyFacility}
                size="sm"
              />
              <ManufacturingLocationPicker
                activity="copy"
                settings={settings}
                onChange={onChange}
                systems={systems}
                size="sm"
              />
            </div>

            <div className="plan-facility-controls__field">
              <FormFieldLabel
                label="Copy system"
                tooltip={
                  settings.copyLocationId != null
                    ? 'Set automatically from the selected copy location.'
                    : GLOBAL_SETTING_TOOLTIPS.copySystemId
                }
                size="sm"
              />
              <ManufacturingSystemPicker
                size="sm"
                value={copyFacility.systemId}
                onChange={(systemId) =>
                  onChange({
                    copyFacility: scienceFacilityForSystem(
                      copyFacility,
                      systemId,
                      securityForSystem(systems, systemId, copyFacility.systemSecurity ?? 1),
                    ),
                  })
                }
                systems={systems}
                regions={regions}
                costIndexKind="copying"
                disabled={settings.copyLocationId != null}
              />
            </div>
          </div>

          {isPlayerStructure(copyFacility.structureType) ? (
            <ScienceFacilityBonusFields
              activity="copy"
              settings={settings}
              onChange={onChange}
              systems={systems}
              size="sm"
            />
          ) : null}
        </section>

        <section className="plan-facility-controls__section">
          <div className="plan-facility-controls__row">
            <div className="plan-facility-controls__field">
              <FormFieldLabel
                label="Invention location"
                tooltip={GLOBAL_SETTING_TOOLTIPS.inventionFacility}
                size="sm"
              />
              <ManufacturingLocationPicker
                activity="invention"
                settings={settings}
                onChange={onChange}
                systems={systems}
                size="sm"
              />
            </div>

            <div className="plan-facility-controls__field">
              <FormFieldLabel
                label="Invention system"
                tooltip={
                  settings.inventionLocationId != null
                    ? 'Set automatically from the selected invention location.'
                    : GLOBAL_SETTING_TOOLTIPS.inventionSystemId
                }
                size="sm"
              />
              <ManufacturingSystemPicker
                size="sm"
                value={inventionFacility.systemId}
                onChange={(systemId) =>
                  onChange({
                    inventionFacility: scienceFacilityForSystem(
                      inventionFacility,
                      systemId,
                      securityForSystem(
                        systems,
                        systemId,
                        inventionFacility.systemSecurity ?? 1,
                      ),
                    ),
                  })
                }
                systems={systems}
                regions={regions}
                costIndexKind="invention"
                disabled={settings.inventionLocationId != null}
              />
            </div>
          </div>

          {isPlayerStructure(inventionFacility.structureType) ? (
            <ScienceFacilityBonusFields
              activity="invention"
              settings={settings}
              onChange={onChange}
              systems={systems}
              size="sm"
            />
          ) : null}
        </section>

        <section className="plan-facility-controls__section">
          <div className="plan-facility-controls__row">
            <div className="plan-facility-controls__field">
              <FormFieldLabel
                label="Reaction refinery"
                tooltip={GLOBAL_SETTING_TOOLTIPS.refineryType}
                size="sm"
              />
              <RefineryLocationPicker
                settings={settings}
                onChange={onChange}
                systems={systems}
                size="sm"
              />
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
                    reactionFacility: {
                      ...facility,
                      reactionSystemId,
                      reactionSystemSecurity: securityForSystem(
                        systems,
                        reactionSystemId,
                        facility.reactionSystemSecurity ?? 1,
                      ),
                    },
                  })
                }
                systems={systems}
                regions={regions}
                costIndexKind="reaction"
                disabled={reactionSystemLocked}
              />
            </div>
          </div>

          {isActiveRefinery(facility.refineryType) ? (
            <ReactionFacilityBonusFields
              settings={settings}
              onChange={onChange}
              systems={systems}
              size="sm"
            />
          ) : null}
        </section>
      </div>

      {hint ? <p className="plan-facility-controls__hint">{hint}</p> : null}
    </div>
  )
}
