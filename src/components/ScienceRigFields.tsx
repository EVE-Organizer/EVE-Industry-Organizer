import type { ScienceActivity, ScienceFacilitySettings } from '@/types'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'
import { LabOptimizationHeader, RigCostTimeHeaders } from '@/components/RigSelectHeaders'
import { RigTierCombobox } from '@/components/RigTierCombobox'
import {
  customRigClosedLabel,
  customRigPairClosedLabel,
  labRigPreview,
  resolveTypedRigPair,
  resolveTypedRigSingle,
  rigSecurityLabel,
  rigSecurityMultiplier,
  presetRigOptions,
  seedPairRigDraft,
  seedSingleRigDraft,
} from '@/lib/manufacturingRigs'
import {
  SCIENCE_RIG_ROW,
  scienceRigLayout,
  scienceRigSetLabel,
  XL_LABORATORY_RIG_ICON,
} from '@/lib/scienceRigFamilies'

interface ScienceRigFieldsProps {
  activity: ScienceActivity
  facility: ScienceFacilitySettings
  onChange: (patch: Partial<ScienceFacilitySettings>) => void
  security: number
  size?: 'md' | 'sm'
}

export function ScienceRigFields({
  activity,
  facility,
  onChange,
  security,
  size = 'md',
}: ScienceRigFieldsProps) {
  const layout = scienceRigLayout(facility.structureType)
  if (!layout) return null

  const row = SCIENCE_RIG_ROW[activity]
  const setLabel = scienceRigSetLabel(layout)
  const rowIcon =
    layout === 'xl-laboratory'
      ? XL_LABORATORY_RIG_ICON
      : layout === 'optimization'
        ? row.iconTypeId
        : row.mCostIconTypeId

  const costRig = facility.costRig ?? 'none'
  const teRig = facility.teRig ?? 'none'
  const optimizationRig = facility.optimizationRig ?? 'none'

  return (
    <details className="manufacturing-rig-fields">
      <summary className="manufacturing-rig-fields__summary">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate">Structure rigs ({setLabel})</span>
          <span
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <InfoTooltip text="Laboratory rigs from your engineering complex. M-Set splits cost and time. L-Set and XL-Set use one optimization rig. Pick T1/T2 or type a custom percent." />
          </span>
        </span>
        <span className="manufacturing-rig-fields__summary-meta shrink-0 tabular-nums">
          {rigSecurityLabel(security)} ({rigSecurityMultiplier(security).toFixed(1)}x)
        </span>
      </summary>

      <div className="manufacturing-rig-fields__body">
        <div className="mb-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-1">{row.section}</p>
            {layout === 'split' ? <RigCostTimeHeaders /> : <LabOptimizationHeader />}
            <div
              className={
                layout === 'split'
                  ? 'grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_7.25rem] items-center gap-2'
                  : 'grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2'
              }
            >
              <EveImage id={rowIcon} variant="icon" size={24} framed lazy={false} alt="" />
              <span className="text-xs truncate">{row.label}</span>

              {layout === 'split' ? (
                <>
                  <RigTierCombobox
                    ariaLabel={`${row.label} cost rig`}
                    size={size}
                    selected={costRig}
                    selectedLabel={
                      costRig === 'custom'
                        ? customRigClosedLabel(facility.rigJobCostBonusPercent)
                        : labRigPreview('cost', costRig, security)
                    }
                    options={presetRigOptions((tier) => labRigPreview('cost', tier, security))}
                    seedDraft={seedSingleRigDraft(
                      costRig,
                      facility.rigJobCostBonusPercent,
                      'cost',
                      security,
                    )}
                    customHint="Type a custom cost %"
                    onPick={(costRig) => onChange({ costRig })}
                    onCommitDraft={(raw) => {
                      const next = resolveTypedRigSingle(raw, 'cost', security)
                      if (!next) return
                      onChange({ costRig: next.tier, rigJobCostBonusPercent: next.percent })
                    }}
                  />
                  <RigTierCombobox
                    ariaLabel={`${row.label} time rig`}
                    size={size}
                    selected={teRig}
                    selectedLabel={
                      teRig === 'custom'
                        ? customRigClosedLabel(facility.rigTeBonusPercent)
                        : labRigPreview('time', teRig, security)
                    }
                    options={presetRigOptions((tier) => labRigPreview('time', tier, security))}
                    seedDraft={seedSingleRigDraft(
                      teRig,
                      facility.rigTeBonusPercent,
                      'te',
                      security,
                    )}
                    customHint="Type a custom time %"
                    onPick={(teRig) => onChange({ teRig })}
                    onCommitDraft={(raw) => {
                      const next = resolveTypedRigSingle(raw, 'te', security)
                      if (!next) return
                      onChange({ teRig: next.tier, rigTeBonusPercent: next.percent })
                    }}
                  />
                </>
              ) : (
                <RigTierCombobox
                  ariaLabel={`${row.label} optimization rig`}
                  size={size}
                  selected={optimizationRig}
                  selectedLabel={
                    optimizationRig === 'custom'
                      ? customRigPairClosedLabel(
                          facility.rigJobCostBonusPercent,
                          facility.rigTeBonusPercent,
                        )
                      : labRigPreview('optimization', optimizationRig, security)
                  }
                  options={presetRigOptions((tier) =>
                    labRigPreview('optimization', tier, security),
                  )}
                  seedDraft={seedPairRigDraft(
                    optimizationRig,
                    {
                      a: facility.rigJobCostBonusPercent,
                      b: facility.rigTeBonusPercent,
                    },
                    security,
                    { a: 'cost', b: 'te' },
                  )}
                  customHint="Type custom cost% / time%"
                  onPick={(optimizationRig) => onChange({ optimizationRig })}
                  onCommitDraft={(raw) => {
                    const next = resolveTypedRigPair(raw, security, { a: 'cost', b: 'te' })
                    if (!next) return
                    onChange({
                      optimizationRig: next.tier,
                      rigJobCostBonusPercent: next.a,
                      rigTeBonusPercent: next.b,
                    })
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}
