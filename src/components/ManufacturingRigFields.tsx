import type {
  GlobalSettings,
  ManufacturingFamilyRigTiers,
  ManufacturingRigModifiers,
  ManufacturingRigTier,
} from '@/types'
import { DEFAULT_MANUFACTURING_RIGS } from '@/types'
import { EveImage } from '@/components/EveImage'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import {
  manufacturingRigTierLabel,
  rigSecurityLabel,
  rigSecurityMultiplier,
  RIG_ME_BASE,
  RIG_TE_BASE,
} from '@/lib/manufacturingRigs'
import { isPlayerStructure } from '@/lib/structureSettings'
import {
  hullManufacturingRigSections,
  manufacturingRigFamilyLabel,
  manufacturingRigFitSize,
  type HullManufacturingRigRow,
  type ManufacturingRigFamily,
} from '@/lib/manufacturingRigFamilies'

interface ManufacturingRigFieldsProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  size?: 'md' | 'sm'
}

const FAMILY_TIERS: ManufacturingRigTier[] = ['none', 't1', 't2']

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
    <label className="form-control">
      <FormFieldLabel label={label} tooltip={tooltip} size={size} />
      <input
        type="number"
        className={`${inputClass} tabular-nums`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}

function scaledPreview(kind: 'me' | 'te', tier: ManufacturingRigTier, security: number): string {
  if (tier === 'none' || tier === 'custom') return manufacturingRigTierLabel(tier)
  const base = kind === 'me' ? RIG_ME_BASE[tier] : RIG_TE_BASE[tier]
  const scaled = base * rigSecurityMultiplier(security)
  return `${kind.toUpperCase()} ${tier.toUpperCase()} ${scaled.toFixed(1)}%`
}

function combinedPreview(tier: ManufacturingRigTier, security: number): string {
  if (tier === 'none' || tier === 'custom') return manufacturingRigTierLabel(tier)
  const me = RIG_ME_BASE[tier] * rigSecurityMultiplier(security)
  const te = RIG_TE_BASE[tier] * rigSecurityMultiplier(security)
  return `${tier.toUpperCase()} ME ${me.toFixed(1)}% / TE ${te.toFixed(1)}%`
}

function patchRigs(
  rigs: ManufacturingRigModifiers,
  patch: Partial<ManufacturingRigModifiers>,
): ManufacturingRigModifiers {
  return { ...DEFAULT_MANUFACTURING_RIGS, ...rigs, ...patch }
}

function familyTiers(
  rigs: ManufacturingRigModifiers,
  family: ManufacturingRigFamily,
): ManufacturingFamilyRigTiers {
  return rigs.familyRigs?.[family] ?? { meRig: 'none', teRig: 'none' }
}

export function ManufacturingRigFields({
  settings,
  onChange,
  size = 'md',
}: ManufacturingRigFieldsProps) {
  if (!isPlayerStructure(settings.structureType)) return null

  const selectClass = size === 'sm' ? 'select select-bordered select-sm' : 'select select-bordered'
  const rigs = settings.manufacturingRigs ?? DEFAULT_MANUFACTURING_RIGS
  const security = settings.buildSystemSecurity ?? 1
  const fitSize = manufacturingRigFitSize(settings.structureType)
  const sections = hullManufacturingRigSections(settings.structureType)
  const setLabel =
    fitSize === 'l' ? 'L-Set' : fitSize === 'xl' ? 'XL-Set' : 'M-Set'

  function setFamilies(
    families: ManufacturingRigFamily[],
    patch: Partial<ManufacturingFamilyRigTiers>,
  ) {
    const familyRigs = { ...rigs.familyRigs }
    for (const family of families) {
      familyRigs[family] = { ...familyTiers(rigs, family), ...patch }
    }
    onChange({ manufacturingRigs: patchRigs(rigs, { familyRigs }) })
  }

  function combinedTier(row: HullManufacturingRigRow): ManufacturingRigTier {
    const first = familyTiers(rigs, row.families[0])
    if (first.meRig !== first.teRig) return 'none'
    const same = row.families.every((family) => {
      const t = familyTiers(rigs, family)
      return t.meRig === first.meRig && t.teRig === first.teRig
    })
    if (!same || first.meRig === 'custom') return 'none'
    return first.meRig
  }

  return (
    <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-2">
        <span>Structure rigs ({setLabel})</span>
        <InfoTooltip text="Raitaru fits M-Set (separate ME and TE per category). Azbel fits L-Set Efficiency (ME and TE in one rig). Sotiyo fits XL-Set bundles: equipment and consumable, all ships, and structure and component. Values scale with system security." />
      </div>
      <p className="text-[11px] opacity-60 mb-3">
        Scaling: {rigSecurityLabel(security)} ({rigSecurityMultiplier(security).toFixed(1)}x)
      </p>

      <div className="mb-3 space-y-3">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-1">{section.title}</p>
            <div className="space-y-1">
              {section.rows.map((row) => {
                if (row.combinedMeTe) {
                  const tier = combinedTier(row)
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2"
                    >
                      <EveImage
                        id={row.iconTypeId}
                        variant="icon"
                        size={24}
                        framed
                        lazy={false}
                        alt=""
                      />
                      <span className="text-xs truncate">{row.label}</span>
                      <select
                        className={`${selectClass} w-full`}
                        aria-label={`${row.label} efficiency`}
                        value={tier}
                        onChange={(e) => {
                          const next = e.target.value as ManufacturingRigTier
                          setFamilies(row.families, { meRig: next, teRig: next })
                        }}
                      >
                        {FAMILY_TIERS.map((option) => (
                          <option key={option} value={option}>
                            {combinedPreview(option, security)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                }

                const family = row.families[0]
                const familyRow = familyTiers(rigs, family)
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_7.25rem] items-center gap-2"
                  >
                    <EveImage
                      id={row.iconTypeId}
                      variant="icon"
                      size={24}
                      framed
                      lazy={false}
                      alt=""
                    />
                    <span className="text-xs truncate">{row.label}</span>
                    <select
                      className={`${selectClass} w-full`}
                      aria-label={`${manufacturingRigFamilyLabel(family)} ME`}
                      value={familyRow.meRig}
                      onChange={(e) =>
                        setFamilies([family], {
                          meRig: e.target.value as ManufacturingRigTier,
                        })
                      }
                    >
                      {FAMILY_TIERS.map((option) => (
                        <option key={option} value={option}>
                          {scaledPreview('me', option, security)}
                        </option>
                      ))}
                    </select>
                    <select
                      className={`${selectClass} w-full`}
                      aria-label={`${manufacturingRigFamilyLabel(family)} TE`}
                      value={familyRow.teRig}
                      onChange={(e) =>
                        setFamilies([family], {
                          teRig: e.target.value as ManufacturingRigTier,
                        })
                      }
                    >
                      {FAMILY_TIERS.map((option) => (
                        <option key={option} value={option}>
                          {scaledPreview('te', option, security)}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <NumberField
        label="Rig job cost %"
        tooltip={GLOBAL_SETTING_TOOLTIPS.manufacturingRigJobCostBonusPercent}
        size={size}
        value={rigs.rigJobCostBonusPercent}
        min={0}
        max={10}
        step={0.1}
        onChange={(rigJobCostBonusPercent) =>
          onChange({ manufacturingRigs: patchRigs(rigs, { rigJobCostBonusPercent }) })
        }
      />
    </div>
  )
}
