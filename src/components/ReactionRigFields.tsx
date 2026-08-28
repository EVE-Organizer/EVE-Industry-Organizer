import type {
  GlobalSettings,
  ManufacturingRigTier,
  ReactionFamilyGroup,
  ReactionFamilyModifiers,
} from '@/types'
import { REACTION_FAMILY_GROUPS } from '@/types'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'
import { LabOptimizationHeader, RigMeTeHeaders } from '@/components/RigSelectHeaders'
import {
  reactionCombinedPreview,
  reactionRigPreview,
  reactionRigSecurityMultiplier,
  rigSecurityLabel,
} from '@/lib/manufacturingRigs'
import {
  REACTION_FAMILY_RIG_ICONS,
  REACTOR_EFFICIENCY_RIG_ICON,
  reactionRigLayout,
  reactionRigSetLabel,
} from '@/lib/reactionRigFamilies'
import { REACTION_FAMILY_LABELS } from '@/lib/refinerySettings'

const FAMILY_TIERS: ManufacturingRigTier[] = ['none', 't1', 't2']

interface ReactionRigFieldsProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  security: number
  size?: 'md' | 'sm'
}

export function ReactionRigFields({
  settings,
  onChange,
  security,
  size = 'md',
}: ReactionRigFieldsProps) {
  const facility = settings.reactionFacility
  const layout = reactionRigLayout(facility.refineryType)
  if (!layout) return null

  const selectClass = size === 'sm' ? 'select select-bordered select-sm' : 'select select-bordered'
  const setLabel = reactionRigSetLabel(layout)
  const secMultiplier = reactionRigSecurityMultiplier(security)
  const secLabel =
    secMultiplier > 1
      ? `${rigSecurityLabel(security)} (${secMultiplier.toFixed(1)}x)`
      : rigSecurityLabel(security)

  function patchFamily(group: ReactionFamilyGroup, patch: Partial<ReactionFamilyModifiers>) {
    onChange({
      reactionFacility: {
        ...facility,
        familyModifiers: {
          ...facility.familyModifiers,
          [group]: { ...facility.familyModifiers[group], ...patch },
        },
      },
    })
  }

  function patchReactorEfficiency(reactorEfficiencyRig: ManufacturingRigTier) {
    onChange({
      reactionFacility: { ...facility, reactorEfficiencyRig },
    })
  }

  const reactorTier =
    facility.reactorEfficiencyRig === 'custom' ? 'none' : (facility.reactorEfficiencyRig ?? 'none')

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
            <InfoTooltip text="Athanor fits M-Set reactor rigs (separate ME and TE per family). Tatara fits one L-Set Reactor Efficiency rig for all reaction types. Reactor rigs use a +10% bonus in nullsec and wormhole space only." />
          </span>
        </span>
        <span className="manufacturing-rig-fields__summary-meta shrink-0 tabular-nums">
          {secLabel}
        </span>
      </summary>

      <div className="manufacturing-rig-fields__body">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-1">Reactions</p>

            {layout === 'optimization' ? (
              <>
                <LabOptimizationHeader />
                <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2">
                  <EveImage
                    id={REACTOR_EFFICIENCY_RIG_ICON}
                    variant="icon"
                    size={24}
                    framed
                    lazy={false}
                    alt=""
                  />
                  <span className="text-xs truncate">Reactor efficiency</span>
                  <select
                    className={`${selectClass} w-full`}
                    aria-label="Reactor efficiency rig"
                    value={reactorTier}
                    onChange={(e) =>
                      patchReactorEfficiency(e.target.value as ManufacturingRigTier)
                    }
                  >
                    {FAMILY_TIERS.map((option) => (
                      <option key={option} value={option}>
                        {reactionCombinedPreview(option, security)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <RigMeTeHeaders />
                <div className="space-y-1">
                  {REACTION_FAMILY_GROUPS.map((group) => {
                    const row = facility.familyModifiers[group]
                    const meRig = row.meRig === 'custom' ? 'none' : (row.meRig ?? 'none')
                    const teRig = row.teRig === 'custom' ? 'none' : (row.teRig ?? 'none')

                    return (
                      <div
                        key={group}
                        className="grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_7.25rem] items-center gap-2"
                      >
                        <EveImage
                          id={REACTION_FAMILY_RIG_ICONS[group]}
                          variant="icon"
                          size={24}
                          framed
                          lazy={false}
                          alt=""
                        />
                        <span className="text-xs truncate">{REACTION_FAMILY_LABELS[group]}</span>
                        <select
                          className={`${selectClass} w-full`}
                          aria-label={`${REACTION_FAMILY_LABELS[group]} ME rig`}
                          value={meRig}
                          onChange={(e) =>
                            patchFamily(group, {
                              meRig: e.target.value as ManufacturingRigTier,
                            })
                          }
                        >
                          {FAMILY_TIERS.map((option) => (
                            <option key={option} value={option}>
                              {reactionRigPreview('me', option, security)}
                            </option>
                          ))}
                        </select>
                        <select
                          className={`${selectClass} w-full`}
                          aria-label={`${REACTION_FAMILY_LABELS[group]} TE rig`}
                          value={teRig}
                          onChange={(e) =>
                            patchFamily(group, {
                              teRig: e.target.value as ManufacturingRigTier,
                            })
                          }
                        >
                          {FAMILY_TIERS.map((option) => (
                            <option key={option} value={option}>
                              {reactionRigPreview('te', option, security)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}
