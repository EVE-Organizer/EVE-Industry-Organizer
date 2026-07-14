import type { ReactNode } from 'react'
import type { GlobalSettings } from '@/types'
import {
  HUBS,
  MAX_ME,
  MAX_TE,
  BPO_LIFETIME_CATEGORY_KEYS,
  MIN_BLUEPRINT_LIFETIME_RUNS,
  MAX_BLUEPRINT_LIFETIME_RUNS,
} from '@/types'
import { formatQuantity } from '@/lib/profit'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import { isPlayerStructure, isPresetPlayerStructure, patchStructureType } from '@/lib/structureSettings'
import { StructureTypePicker } from '@/components/StructureTypePicker'
import { BPO_LIFETIME_CATEGORY_LABELS, clampLifetimeRuns } from '@/lib/bpoLifetime'

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
  return (
    <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-2">
        <span>Structure role bonuses</span>
        <InfoTooltip text="Fixed for this hull type. Pick Custom structure to enter your own values." />
      </div>
      <div className={`grid grid-cols-3 ${size === 'sm' ? 'gap-2' : 'gap-3'}`}>
        <StructureBonusTile label="ME" value={settings.structureMeBonusPercent} />
        <StructureBonusTile label="TE" value={settings.structureTeBonusPercent} />
        <StructureBonusTile label="Job cost" value={settings.structureJobCostBonusPercent} />
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
              ...(hub ? { manufacturingSystemId: hub.buildSystemId } : {}),
            })
          }}
        >
          {HUBS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
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
  size = 'md',
}: SettingsSectionProps) {
  const gap = sectionGap(size)

  return (
    <div className={`flex flex-col ${gap}`}>
      <SettingField
        label="Manufacturing location"
        tooltip={GLOBAL_SETTING_TOOLTIPS.structureType}
        size={size}
      >
        <StructureTypePicker
          size={size}
          value={settings.structureType}
          onChange={(structureType) => onChange(patchStructureType(structureType))}
        />
      </SettingField>

      {isPlayerStructure(settings.structureType) ? (
        isPresetPlayerStructure(settings.structureType) ? (
          <>
            <StructurePresetBonuses settings={settings} size={size} />
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
        ) : (
          <div className={`grid grid-cols-2 ${gap}`}>
            <NumberField
              label="Structure ME bonus %"
              tooltip={GLOBAL_SETTING_TOOLTIPS.structureMeBonusPercent}
              size={size}
              value={settings.structureMeBonusPercent}
              min={0}
              max={10}
              step={0.1}
              onChange={(structureMeBonusPercent) => onChange({ structureMeBonusPercent })}
            />
            <NumberField
              label="Structure TE bonus %"
              tooltip={GLOBAL_SETTING_TOOLTIPS.structureTeBonusPercent}
              size={size}
              value={settings.structureTeBonusPercent}
              min={0}
              max={50}
              step={0.1}
              onChange={(structureTeBonusPercent) => onChange({ structureTeBonusPercent })}
            />
            <NumberField
              label="Job cost bonus %"
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
          </div>
        )
      ) : null}
    </div>
  )
}

export function BpoCostSettingsSection({ settings, onChange, size = 'md' }: SettingsSectionProps) {
  const inputClass = size === 'sm' ? 'input input-bordered input-sm' : 'input input-bordered'
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
        <>
          <p className="text-xs opacity-60">
            BPO lifetime by product type. Charges (ammo, scripts) are excluded from blueprint cost.
          </p>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gap}`}>
            {BPO_LIFETIME_CATEGORY_KEYS.map((key) => (
              <SettingField
                key={key}
                label={`${BPO_LIFETIME_CATEGORY_LABELS[key]} lifetime`}
                tooltip={GLOBAL_SETTING_TOOLTIPS.blueprintLifetimeRunsByCategory}
                size={size}
                valueLabel={formatQuantity(settings.blueprintLifetimeRunsByCategory[key])}
              >
                <input
                  type="number"
                  min={MIN_BLUEPRINT_LIFETIME_RUNS}
                  max={MAX_BLUEPRINT_LIFETIME_RUNS}
                  step={key === 'ship' || key === 'deployable' || key === 'structure' ? 10 : 50}
                  className={inputClass}
                  value={settings.blueprintLifetimeRunsByCategory[key]}
                  onChange={(e) =>
                    onChange({
                      blueprintLifetimeRunsByCategory: {
                        ...settings.blueprintLifetimeRunsByCategory,
                        [key]: clampLifetimeRuns(+e.target.value),
                      },
                    })
                  }
                  aria-label={`${BPO_LIFETIME_CATEGORY_LABELS[key]} BPO lifetime runs`}
                />
              </SettingField>
            ))}
          </div>
          <div className="max-w-sm">
            <SettingField
              label="Invention skill level"
              tooltip={GLOBAL_SETTING_TOOLTIPS.inventionSkillLevel}
              size={size}
              valueLabel={settings.inventionSkillLevel}
            >
              <RangeInput
                value={settings.inventionSkillLevel}
                min={0}
                max={5}
                onChange={(inventionSkillLevel) => onChange({ inventionSkillLevel })}
                size={size}
                ariaLabel="Invention skill level"
              />
            </SettingField>
          </div>
        </>
      ) : (
        <p className="text-xs opacity-60">
          Profit and budget ignore BPO purchase and invention costs. Turn on to amortize T1 BPOs or
          charge full T2 invention per batch.
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
