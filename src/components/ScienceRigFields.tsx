import type { ManufacturingRigTier, ScienceActivity, ScienceFacilitySettings } from '@/types'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'
import {
  LabOptimizationHeader,
  RigCostTimeHeaders,
} from '@/components/RigSelectHeaders'
import {
  labRigPreview,
  rigSecurityLabel,
  rigSecurityMultiplier,
} from '@/lib/manufacturingRigs'
import {
  SCIENCE_RIG_ROW,
  scienceRigLayout,
  scienceRigSetLabel,
  XL_LABORATORY_RIG_ICON,
} from '@/lib/scienceRigFamilies'

const FAMILY_TIERS: ManufacturingRigTier[] = ['none', 't1', 't2']

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

  const selectClass = size === 'sm' ? 'select select-bordered select-sm' : 'select select-bordered'
  const row = SCIENCE_RIG_ROW[activity]
  const setLabel = scienceRigSetLabel(layout)
  const rowIcon =
    layout === 'xl-laboratory'
      ? XL_LABORATORY_RIG_ICON
      : layout === 'optimization'
        ? row.iconTypeId
        : row.mCostIconTypeId

  const costRig = facility.costRig === 'custom' ? 'none' : (facility.costRig ?? 'none')
  const teRig = facility.teRig === 'custom' ? 'none' : (facility.teRig ?? 'none')
  const optimizationRig =
    facility.optimizationRig === 'custom' ? 'none' : (facility.optimizationRig ?? 'none')

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
            <InfoTooltip text="Laboratory rigs from your engineering complex. M-Set splits cost and time rigs. L-Set and XL-Set use one optimization rig that applies both. Values match in-game dogma and scale with system security." />
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
                  <select
                    className={`${selectClass} w-full`}
                    aria-label={`${row.label} cost rig`}
                    value={costRig}
                    onChange={(e) =>
                      onChange({ costRig: e.target.value as ManufacturingRigTier })
                    }
                  >
                    {FAMILY_TIERS.map((option) => (
                      <option key={option} value={option}>
                        {labRigPreview('cost', option, security)}
                      </option>
                    ))}
                  </select>
                  <select
                    className={`${selectClass} w-full`}
                    aria-label={`${row.label} time rig`}
                    value={teRig}
                    onChange={(e) =>
                      onChange({ teRig: e.target.value as ManufacturingRigTier })
                    }
                  >
                    {FAMILY_TIERS.map((option) => (
                      <option key={option} value={option}>
                        {labRigPreview('time', option, security)}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <select
                  className={`${selectClass} w-full`}
                  aria-label={`${row.label} optimization rig`}
                  value={optimizationRig}
                  onChange={(e) =>
                    onChange({ optimizationRig: e.target.value as ManufacturingRigTier })
                  }
                >
                  {FAMILY_TIERS.map((option) => (
                    <option key={option} value={option}>
                      {labRigPreview('optimization', option, security)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}
