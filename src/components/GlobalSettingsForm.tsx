import type { ReactNode } from 'react'
import type { GlobalSettings } from '@/types'
import {
  HUBS,
  MAX_ME,
  MAX_TE,
  MIN_BATCH_SIZE,
  MAX_BATCH_SIZE,
  BATCH_SIZE_STEP,
  MIN_BLUEPRINT_LIFETIME_RUNS,
  MAX_BLUEPRINT_LIFETIME_RUNS,
} from '@/types'
import { formatQuantity } from '@/lib/profit'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'

interface GlobalSettingsFormProps {
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

export function GlobalSettingsForm({ settings, onChange, size = 'md' }: GlobalSettingsFormProps) {
  const inputClass = size === 'sm' ? 'input input-bordered input-sm' : 'input input-bordered'
  const selectClass = size === 'sm' ? 'select select-bordered select-sm' : 'select select-bordered'
  const gap = size === 'sm' ? 'gap-3' : 'gap-4'

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

      <section className={`flex flex-col ${gap} border-t border-eve-border/50 pt-4`}>
        <SettingField
          label="Batch size (runs)"
          tooltip={GLOBAL_SETTING_TOOLTIPS.batchSize}
          size={size}
          valueLabel={settings.batchSize}
        >
          <RangeInput
            value={settings.batchSize}
            min={MIN_BATCH_SIZE}
            max={MAX_BATCH_SIZE}
            step={BATCH_SIZE_STEP}
            onChange={(batchSize) => onChange({ batchSize })}
            size={size}
            ariaLabel="Batch size"
          />
        </SettingField>
      </section>

      <section className={`flex flex-col ${gap} border-t border-eve-border/50 pt-4`}>
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

        {settings.includeBlueprintCost && (
          <div className={`grid grid-cols-2 ${gap}`}>
            <SettingField
              label="BPO lifetime (runs)"
              tooltip={GLOBAL_SETTING_TOOLTIPS.blueprintLifetimeRuns}
              size={size}
              valueLabel={formatQuantity(settings.blueprintLifetimeRuns)}
            >
              <input
                type="number"
                min={MIN_BLUEPRINT_LIFETIME_RUNS}
                max={MAX_BLUEPRINT_LIFETIME_RUNS}
                step={50}
                className={inputClass}
                value={settings.blueprintLifetimeRuns}
                onChange={(e) =>
                  onChange({
                    blueprintLifetimeRuns: Math.min(
                      MAX_BLUEPRINT_LIFETIME_RUNS,
                      Math.max(MIN_BLUEPRINT_LIFETIME_RUNS, Math.round(+e.target.value) || MIN_BLUEPRINT_LIFETIME_RUNS),
                    ),
                  })
                }
                aria-label="BPO lifetime runs"
              />
            </SettingField>
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
        )}
      </section>

      <div className={`grid grid-cols-2 ${gap}`}>
        <SettingField
          label="Broker fee %"
          tooltip={GLOBAL_SETTING_TOOLTIPS.brokerFeePercent}
          size={size}
        >
          <input
            type="number"
            step={0.1}
            className={inputClass}
            value={settings.brokerFeePercent}
            onChange={(e) => onChange({ brokerFeePercent: +e.target.value })}
          />
        </SettingField>
        <SettingField
          label="Sales tax %"
          tooltip={GLOBAL_SETTING_TOOLTIPS.salesTaxPercent}
          size={size}
        >
          <input
            type="number"
            step={0.1}
            className={inputClass}
            value={settings.salesTaxPercent}
            onChange={(e) => onChange({ salesTaxPercent: +e.target.value })}
          />
        </SettingField>
      </div>
    </div>
  )
}
