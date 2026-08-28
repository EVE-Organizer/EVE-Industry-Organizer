import type { ReactNode } from 'react'
import type {
  GlobalSettings,
  ReactionFamilyGroup,
  RegionsData,
  ScienceActivity,
  ScienceFacilitySettings,
  SystemInfo,
} from '@/types'
import {
  HUBS,
  MAX_ME,
  MAX_TE,
  REACTION_FAMILY_GROUPS,
  STRUCTURE_HULL_PRESETS,
} from '@/types'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import { formatHubLabel } from '@/lib/hubDisplay'
import {
  isPlayerStructure,
  isPresetPlayerStructure,
  scienceFacilityForSystem,
  securityForSystem,
} from '@/lib/structureSettings'
import {
  isActiveRefinery,
  isPresetRefinery,
  REACTION_FAMILY_LABELS,
  refineryHullTePercent,
} from '@/lib/refinerySettings'
import { reactionRigLayout } from '@/lib/reactionRigFamilies'
import { ManufacturingLocationPicker } from '@/components/ManufacturingLocationPicker'
import { ManufacturingRigFields } from '@/components/ManufacturingRigFields'
import { ReactionRigFields } from '@/components/ReactionRigFields'
import { ScienceRigFields } from '@/components/ScienceRigFields'
import { RefineryLocationPicker } from '@/components/RefineryLocationPicker'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'

export interface SettingsSectionProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  size?: 'md' | 'sm'
}

function SettingField({
  label,
  tooltip,
  size,
  valueLabel,
  children,
}: {
  label: string
  tooltip: string
  size: 'md' | 'sm'
  valueLabel?: string | number
  children: ReactNode
}) {
  return (
    <label className="form-control">
      <FormFieldLabel label={label} tooltip={tooltip} valueLabel={valueLabel} size={size} />
      {children}
    </label>
  )
}

function NumberField({
  label,
  tooltip,
  size,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  tooltip: string
  size: 'md' | 'sm'
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const inputClass = size === 'sm' ? 'input input-bordered input-sm' : 'input input-bordered'
  return (
    <SettingField label={label} tooltip={tooltip} size={size}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(Math.max(min, +e.target.value || 0))}
      />
    </SettingField>
  )
}

function StructureBonusTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-eve-border bg-base-200 px-2 py-2.5 text-center min-w-0">
      <div className="text-[10px] uppercase tracking-wide opacity-50 truncate">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight mt-0.5">{value}%</div>
    </div>
  )
}

function StructurePresetBonuses({
  settings,
  size,
}: {
  settings: GlobalSettings
  size: 'md' | 'sm'
}) {
  const hull =
    settings.structureType === 'raitaru' ||
    settings.structureType === 'azbel' ||
    settings.structureType === 'sotiyo'
      ? STRUCTURE_HULL_PRESETS[settings.structureType]
      : null
  if (!hull) return null

  return (
    <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-2">
        <span>Hull role bonuses</span>
        <InfoTooltip text="Fixed for this hull type. Fitted rig bonuses are entered below." />
      </div>
      <div className={`grid grid-cols-3 ${size === 'sm' ? 'gap-2' : 'gap-3'}`}>
        <StructureBonusTile label="Hull ME" value={hull.hullMeBonusPercent} />
        <StructureBonusTile label="Hull TE" value={hull.hullTeBonusPercent} />
        <StructureBonusTile label="Hull job cost" value={hull.hullJobCostBonusPercent} />
      </div>
    </div>
  )
}

function RangeInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  size,
  ariaLabel,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  size: 'md' | 'sm'
  ariaLabel: string
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`range range-primary w-full ${size === 'sm' ? 'range-xs' : 'range-sm'}`}
        aria-label={ariaLabel}
      />
      <div className="flex justify-between text-[10px] opacity-40 px-0.5 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </>
  )
}

function sectionGap(size: 'md' | 'sm') {
  return size === 'sm' ? 'gap-3' : 'gap-4'
}

export function CommonSettingsSection({ settings, onChange, size = 'md' }: SettingsSectionProps) {
  const selectClass = size === 'sm' ? 'select select-bordered select-sm' : 'select select-bordered'
  const gap = sectionGap(size)

  return (
    <div className={`flex flex-col ${gap}`}>
      <SettingField
        label="Primary hub"
        tooltip={GLOBAL_SETTING_TOOLTIPS.primaryHub}
        size={size}
      >
        <select
          className={selectClass}
          value={settings.primaryHub}
          onChange={(e) => {
            const primaryHub = e.target.value as GlobalSettings['primaryHub']
            const hub = HUBS.find((h) => h.id === primaryHub)
            onChange({
              primaryHub,
              ...(hub && settings.productionLocationId == null
                ? { manufacturingSystemId: hub.buildSystemId }
                : {}),
            })
          }}
        >
          {HUBS.map((h) => (
            <option key={h.id} value={h.id}>
              {formatHubLabel(h)}
            </option>
          ))}
        </select>
      </SettingField>

      <SettingField
        label="Sell hub"
        tooltip={GLOBAL_SETTING_TOOLTIPS.sellHubId}
        size={size}
      >
        <select
          className={selectClass}
          value={settings.sellHubId ?? settings.primaryHub}
          onChange={(e) =>
            onChange({ sellHubId: e.target.value as GlobalSettings['sellHubId'] })
          }
        >
          {HUBS.map((h) => (
            <option key={h.id} value={h.id}>
              {formatHubLabel(h)}
            </option>
          ))}
        </select>
      </SettingField>

      <SettingField
        label="Price method"
        tooltip={GLOBAL_SETTING_TOOLTIPS.priceMethod}
        size={size}
      >
        <select
          className={selectClass}
          value={settings.priceMethod}
          onChange={(e) =>
            onChange({ priceMethod: e.target.value as GlobalSettings['priceMethod'] })
          }
        >
          <option value="sell_orders">Sell orders (list and average)</option>
          <option value="buy_orders">Buy orders (instant sell)</option>
        </select>
      </SettingField>

      <div className={`grid grid-cols-2 ${gap}`}>
        <SettingField
          label="Default ME"
          tooltip={GLOBAL_SETTING_TOOLTIPS.meDefault}
          size={size}
          valueLabel={settings.meDefault}
        >
          <RangeInput
            value={settings.meDefault}
            min={0}
            max={MAX_ME}
            onChange={(meDefault) => onChange({ meDefault })}
            size={size}
            ariaLabel="Default ME"
          />
        </SettingField>
        <SettingField
          label="Default TE"
          tooltip={GLOBAL_SETTING_TOOLTIPS.teDefault}
          size={size}
          valueLabel={settings.teDefault}
        >
          <RangeInput
            value={settings.teDefault}
            min={0}
            max={MAX_TE}
            onChange={(teDefault) => onChange({ teDefault })}
            size={size}
            ariaLabel="Default TE"
          />
        </SettingField>
      </div>
    </div>
  )
}

export function ManufacturingSettingsSection({
  settings,
  onChange,
  systems,
  size = 'md',
}: SettingsSectionProps & { systems?: SystemInfo[] }) {
  const gap = sectionGap(size)

  return (
    <div className={`flex flex-col ${gap}`}>
      <SettingField
        label="Manufacturing location"
        tooltip={GLOBAL_SETTING_TOOLTIPS.structureType}
        size={size}
      >
        <ManufacturingLocationPicker
          settings={settings}
          onChange={onChange}
          systems={systems}
          size={size}
        />
      </SettingField>

      {isPlayerStructure(settings.structureType) ? (
        <>
          {isPresetPlayerStructure(settings.structureType) ? (
            <StructurePresetBonuses settings={settings} size={size} />
          ) : (
            <div className={`grid grid-cols-2 ${gap}`}>
              <NumberField
                label="Hull ME bonus %"
                tooltip={GLOBAL_SETTING_TOOLTIPS.structureMeBonusPercent}
                size={size}
                value={settings.structureMeBonusPercent}
                min={0}
                max={10}
                step={0.1}
                onChange={(structureMeBonusPercent) => onChange({ structureMeBonusPercent })}
              />
              <NumberField
                label="Hull TE bonus %"
                tooltip={GLOBAL_SETTING_TOOLTIPS.structureTeBonusPercent}
                size={size}
                value={settings.structureTeBonusPercent}
                min={0}
                max={50}
                step={0.1}
                onChange={(structureTeBonusPercent) => onChange({ structureTeBonusPercent })}
              />
              <NumberField
                label="Hull job cost bonus %"
                tooltip={GLOBAL_SETTING_TOOLTIPS.structureJobCostBonusPercent}
                size={size}
                value={settings.structureJobCostBonusPercent}
                min={0}
                max={10}
                step={0.1}
                onChange={(structureJobCostBonusPercent) =>
                  onChange({ structureJobCostBonusPercent })
                }
              />
            </div>
          )}
          <ManufacturingRigFields settings={settings} onChange={onChange} size={size} />
          <NumberField
            label="Owner tax %"
            tooltip={GLOBAL_SETTING_TOOLTIPS.structureTaxPercent}
            size={size}
            value={settings.structureTaxPercent}
            min={0}
            max={50}
            step={0.1}
            onChange={(structureTaxPercent) => onChange({ structureTaxPercent })}
          />
        </>
      ) : null}
    </div>
  )
}

export function ReactionFacilityBonusFields({
  settings,
  onChange,
  systems,
  size = 'md',
}: SettingsSectionProps & { systems?: SystemInfo[] }) {
  const gap = sectionGap(size)
  const facility = settings.reactionFacility
  if (!isActiveRefinery(facility.refineryType)) return null

  const hullTe = refineryHullTePercent(facility.refineryType, facility.hullTeBonusPercent)
  const security = securityForSystem(systems, facility.reactionSystemId, 1)
  const showHull = size !== 'sm'
  const rigLayout = reactionRigLayout(facility.refineryType)

  function patchFamilyTax(group: ReactionFamilyGroup, taxPercent: number) {
    onChange({
      reactionFacility: {
        ...facility,
        familyModifiers: {
          ...facility.familyModifiers,
          [group]: { ...facility.familyModifiers[group], taxPercent },
        },
      },
    })
  }

  return (
    <div className={`flex flex-col ${gap}`}>
      {showHull && isPresetRefinery(facility.refineryType) ? (
        <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-2">
            <span>Hull role bonuses</span>
            <InfoTooltip text="Fixed for this hull type. Fitted rig bonuses are entered below." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StructureBonusTile label="Hull ME" value={0} />
            <StructureBonusTile label="Hull TE" value={hullTe} />
            <StructureBonusTile label="Hull job cost" value={0} />
          </div>
        </div>
      ) : showHull ? (
        <NumberField
          label="Hull TE bonus %"
          tooltip={GLOBAL_SETTING_TOOLTIPS.refineryHullTeBonusPercent}
          size={size}
          value={facility.hullTeBonusPercent}
          min={0}
          max={50}
          step={0.1}
          onChange={(hullTeBonusPercent) =>
            onChange({ reactionFacility: { ...facility, hullTeBonusPercent } })
          }
        />
      ) : null}

      <ReactionRigFields
        settings={settings}
        onChange={onChange}
        security={security}
        size={size}
      />

      {showHull ? (
        rigLayout === 'split' ? (
          <div className={`grid grid-cols-1 ${size === 'sm' ? 'gap-2' : 'gap-3'}`}>
            {REACTION_FAMILY_GROUPS.map((group) => (
              <NumberField
                key={group}
                label={`${REACTION_FAMILY_LABELS[group]} owner tax %`}
                tooltip={GLOBAL_SETTING_TOOLTIPS.reactionTaxPercent}
                size={size}
                value={facility.familyModifiers[group].taxPercent}
                min={0}
                max={50}
                step={0.1}
                onChange={(taxPercent) => patchFamilyTax(group, taxPercent)}
              />
            ))}
          </div>
        ) : (
          <NumberField
            label="Owner tax %"
            tooltip={GLOBAL_SETTING_TOOLTIPS.reactionTaxPercent}
            size={size}
            value={facility.familyModifiers.composite.taxPercent}
            min={0}
            max={50}
            step={0.1}
            onChange={(taxPercent) =>
              onChange({
                reactionFacility: {
                  ...facility,
                  familyModifiers: {
                    composite: { ...facility.familyModifiers.composite, taxPercent },
                    biochemical: { ...facility.familyModifiers.biochemical, taxPercent },
                    hybrid: { ...facility.familyModifiers.hybrid, taxPercent },
                  },
                },
              })
            }
          />
        )
      ) : null}
    </div>
  )
}

export function ReactionFacilitySection({
  settings,
  onChange,
  systems,
  regions,
  size = 'md',
}: SettingsSectionProps & {
  systems: SystemInfo[]
  regions: RegionsData
}) {
  const gap = sectionGap(size)
  const facility = settings.reactionFacility
  const reactionSystemLocked = settings.reactionLocationId != null

  return (
    <div className={`flex flex-col ${gap}`}>
      <SettingField
        label="Reaction location"
        tooltip={GLOBAL_SETTING_TOOLTIPS.refineryType}
        size={size}
      >
        <RefineryLocationPicker
          settings={settings}
          onChange={onChange}
          systems={systems}
          size={size}
        />
      </SettingField>

      <SettingField
        label="Reaction system"
        tooltip={
          reactionSystemLocked
            ? 'Set automatically from the selected refinery location.'
            : GLOBAL_SETTING_TOOLTIPS.reactionSystemId
        }
        size={size}
      >
        <ManufacturingSystemPicker
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
          size={size}
          disabled={reactionSystemLocked}
        />
      </SettingField>

      <ReactionFacilityBonusFields
        settings={settings}
        onChange={onChange}
        systems={systems}
        size={size}
      />
    </div>
  )
}

export function ScienceFacilityBonusFields({
  activity,
  settings,
  onChange,
  systems,
  size = 'md',
}: SettingsSectionProps & { activity: ScienceActivity; systems?: SystemInfo[] }) {
  const gap = sectionGap(size)
  const facilityKey = activity === 'copy' ? 'copyFacility' : 'inventionFacility'
  const facility =
    settings[facilityKey] ?? {
      systemId: settings.manufacturingSystemId,
      systemSecurity: 1,
      structureType: 'npc' as const,
      hullTeBonusPercent: 0,
      hullJobCostBonusPercent: 0,
      costRig: 'none' as const,
      teRig: 'none' as const,
      optimizationRig: 'none' as const,
      rigTeBonusPercent: 0,
      rigJobCostBonusPercent: 0,
      taxPercent: 0,
    }
  if (!isPlayerStructure(facility.structureType)) return null

  const hull =
    facility.structureType === 'raitaru' ||
    facility.structureType === 'azbel' ||
    facility.structureType === 'sotiyo'
      ? STRUCTURE_HULL_PRESETS[facility.structureType]
      : null
  const security = securityForSystem(
    systems,
    facility.systemId,
    facility.systemSecurity ?? 1,
  )
  const showHull = size !== 'sm'

  function patchFacility(patch: Partial<ScienceFacilitySettings>) {
    onChange({ [facilityKey]: { ...facility, ...patch } })
  }

  return (
    <div className={`flex flex-col ${gap}`}>
      {showHull && isPresetPlayerStructure(facility.structureType) && hull ? (
        <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-2">
            <span>Hull role bonuses</span>
            <InfoTooltip text="Fixed for this hull type. Fitted rig bonuses are entered below." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StructureBonusTile label="Hull ME" value={0} />
            <StructureBonusTile label="Hull TE" value={hull.hullTeBonusPercent} />
            <StructureBonusTile
              label="Hull job cost"
              value={hull.hullJobCostBonusPercent}
            />
          </div>
        </div>
      ) : showHull ? (
        <div className={`grid grid-cols-2 ${gap}`}>
          <NumberField
            label="Hull TE bonus %"
            tooltip={GLOBAL_SETTING_TOOLTIPS.scienceHullTeBonusPercent}
            size={size}
            value={facility.hullTeBonusPercent}
            min={0}
            max={50}
            step={0.1}
            onChange={(hullTeBonusPercent) => patchFacility({ hullTeBonusPercent })}
          />
          <NumberField
            label="Hull job cost bonus %"
            tooltip={GLOBAL_SETTING_TOOLTIPS.scienceHullJobCostBonusPercent}
            size={size}
            value={facility.hullJobCostBonusPercent}
            min={0}
            max={10}
            step={0.1}
            onChange={(hullJobCostBonusPercent) =>
              patchFacility({ hullJobCostBonusPercent })
            }
          />
        </div>
      ) : null}

      <ScienceRigFields
        activity={activity}
        facility={facility}
        onChange={patchFacility}
        security={security}
        size={size}
      />

      {showHull ? (
        <NumberField
          label="Owner tax %"
          tooltip={GLOBAL_SETTING_TOOLTIPS.scienceTaxPercent}
          size={size}
          value={facility.taxPercent}
          min={0}
          max={50}
          step={0.1}
          onChange={(taxPercent) => patchFacility({ taxPercent })}
        />
      ) : null}
    </div>
  )
}

export function ScienceFacilitySection({
  activity,
  settings,
  onChange,
  systems,
  regions,
  size = 'md',
}: SettingsSectionProps & {
  activity: ScienceActivity
  systems: SystemInfo[]
  regions: RegionsData
}) {
  const gap = sectionGap(size)
  const facilityKey = activity === 'copy' ? 'copyFacility' : 'inventionFacility'
  const facility =
    settings[facilityKey] ?? {
      systemId: settings.manufacturingSystemId,
      systemSecurity: 1,
      structureType: 'npc' as const,
      hullTeBonusPercent: 0,
      hullJobCostBonusPercent: 0,
      costRig: 'none' as const,
      teRig: 'none' as const,
      optimizationRig: 'none' as const,
      rigTeBonusPercent: 0,
      rigJobCostBonusPercent: 0,
      taxPercent: 0,
    }
  const locationLocked =
    activity === 'copy' ? settings.copyLocationId != null : settings.inventionLocationId != null
  const locationTooltip =
    activity === 'copy' ? GLOBAL_SETTING_TOOLTIPS.copyFacility : GLOBAL_SETTING_TOOLTIPS.inventionFacility
  const systemTooltip =
    activity === 'copy' ? GLOBAL_SETTING_TOOLTIPS.copySystemId : GLOBAL_SETTING_TOOLTIPS.inventionSystemId

  function patchFacility(patch: Partial<ScienceFacilitySettings>) {
    onChange({ [facilityKey]: { ...facility, ...patch } })
  }

  return (
    <div className={`flex flex-col ${gap}`}>
      <SettingField
        label={activity === 'copy' ? 'Copy location' : 'Invention location'}
        tooltip={locationTooltip}
        size={size}
      >
        <ManufacturingLocationPicker
          activity={activity}
          settings={settings}
          onChange={onChange}
          systems={systems}
          size={size}
        />
      </SettingField>

      <SettingField
        label={activity === 'copy' ? 'Copy system' : 'Invention system'}
        tooltip={
          locationLocked
            ? 'Set automatically from the selected location.'
            : systemTooltip
        }
        size={size}
      >
        <ManufacturingSystemPicker
          value={facility.systemId}
          onChange={(systemId) =>
            patchFacility(
              scienceFacilityForSystem(
                facility,
                systemId,
                securityForSystem(systems, systemId, facility.systemSecurity ?? 1),
              ),
            )
          }
          systems={systems}
          regions={regions}
          costIndexKind={activity === 'copy' ? 'copying' : 'invention'}
          size={size}
          disabled={locationLocked}
        />
      </SettingField>

      <ScienceFacilityBonusFields
        activity={activity}
        settings={settings}
        onChange={onChange}
        systems={systems}
        size={size}
      />
    </div>
  )
}

export function BpoCostSettingsSection({ settings, onChange, size = 'md' }: SettingsSectionProps) {
  const gap = sectionGap(size)

  return (
    <div className={`flex flex-col ${gap}`}>
      <label className="label cursor-pointer justify-start gap-2 p-0">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={settings.includeBlueprintCost}
          onChange={(e) => onChange({ includeBlueprintCost: e.target.checked })}
        />
        <span className="label-text text-sm">Include blueprint cost</span>
        <InfoTooltip text={GLOBAL_SETTING_TOOLTIPS.includeBlueprintCost} />
      </label>

      {settings.includeBlueprintCost ? (
        <p className="text-xs opacity-60">
          T1 BPOs are treated as reusable (upfront capital only). When no BPO is listed, BPC
          contract prices are used. Charges (ammo, scripts) are excluded. Set invention skill level
          on the Skills page (avatar).
        </p>
      ) : (
        <p className="text-xs opacity-60">
          Profit and budget ignore BPO purchase, BPC copies, and invention costs.
        </p>
      )}
    </div>
  )
}

/** @deprecated Use section components directly on the settings page. */
export function GlobalSettingsForm({ settings, onChange, size = 'md' }: SettingsSectionProps) {
  const gap = sectionGap(size)
  return (
    <div className={`flex flex-col ${gap}`}>
      <CommonSettingsSection settings={settings} onChange={onChange} size={size} />
      <BpoCostSettingsSection settings={settings} onChange={onChange} size={size} />
      <ManufacturingSettingsSection settings={settings} onChange={onChange} size={size} />
    </div>
  )
}
