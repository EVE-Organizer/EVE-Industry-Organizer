import type { GlobalSettings, ReactionFamilyGroup, ReactionFamilyModifiers } from '@/types'
import { REACTION_FAMILY_GROUPS } from '@/types'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'
import { RigEfficiencyHeader, RigMeTeHeaders } from '@/components/RigSelectHeaders'
import { RigTierCombobox } from '@/components/RigTierCombobox'
import {
  customRigClosedLabel,
  customRigPairClosedLabel,
  reactionCombinedPreview,
  reactionRigPreview,
  reactionRigSecurityMultiplier,
  resolveTypedRigPair,
  resolveTypedRigSingle,
  rigSecurityLabel,
  presetRigOptions,
  seedPairRigDraft,
  seedSingleRigDraft,
} from '@/lib/manufacturingRigs'
import {
  reactionFamilyRigIcon,
  reactorEfficiencyRigIcon,
  reactionRigLayout,
  reactionRigSetLabel,
} from '@/lib/reactionRigFamilies'
import { REACTION_FAMILY_LABELS } from '@/lib/refinerySettings'

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

  const setLabel = reactionRigSetLabel(layout)
  const secMultiplier = reactionRigSecurityMultiplier(security)
  const secLabel =
    secMultiplier > 1
      ? `${rigSecurityLabel(security)} (${secMultiplier.toFixed(1)}x)`
      : rigSecurityLabel(security)
  const reactorTier = facility.reactorEfficiencyRig ?? 'none'
  const composite = facility.familyModifiers.composite

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
            <InfoTooltip text="Athanor fits M-Set reactor rigs per family. Tatara fits one L-Set Reactor Efficiency rig. Pick T1/T2 or type a custom percent. Nullsec/WH adds +10%." />
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
                <RigEfficiencyHeader />
                <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2">
                  <EveImage
                    id={reactorEfficiencyRigIcon()}
                    variant="icon"
                    size={24}
                    framed
                    lazy={false}
                    alt=""
                  />
                  <span className="text-xs truncate">Reactor efficiency</span>
                  <RigTierCombobox
                    ariaLabel="Reactor efficiency rig"
                    size={size}
                    selected={reactorTier}
                    selectedLabel={
                      reactorTier === 'custom'
                        ? customRigPairClosedLabel(
                            composite.rigMeBonusPercent,
                            composite.rigTeBonusPercent,
                          )
                        : reactionCombinedPreview(reactorTier, security)
                    }
                    options={presetRigOptions((option) =>
                      reactionCombinedPreview(option, security),
                    )}
                    seedDraft={seedPairRigDraft(
                      reactorTier,
                      { a: composite.rigMeBonusPercent, b: composite.rigTeBonusPercent },
                      security,
                      { a: 'me', b: 'te' },
                      'reaction',
                    )}
                    customHint="Type custom ME% / TE%"
                    onPick={(reactorEfficiencyRig) =>
                      onChange({ reactionFacility: { ...facility, reactorEfficiencyRig } })
                    }
                    onCommitDraft={(raw) => {
                      const next = resolveTypedRigPair(
                        raw,
                        security,
                        { a: 'me', b: 'te' },
                        'reaction',
                      )
                      if (!next) return
                      onChange({
                        reactionFacility: {
                          ...facility,
                          reactorEfficiencyRig: next.tier,
                          familyModifiers: {
                            ...facility.familyModifiers,
                            composite: {
                              ...composite,
                              meRig: next.tier,
                              teRig: next.tier,
                              rigMeBonusPercent: next.a,
                              rigTeBonusPercent: next.b,
                            },
                          },
                        },
                      })
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <RigMeTeHeaders />
                <div className="space-y-1">
                  {REACTION_FAMILY_GROUPS.map((group) => {
                    const row = facility.familyModifiers[group]
                    return (
                      <div
                        key={group}
                        className="grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_7.25rem] items-center gap-2"
                      >
                        <EveImage
                          id={reactionFamilyRigIcon(group)}
                          variant="icon"
                          size={24}
                          framed
                          lazy={false}
                          alt=""
                        />
                        <span className="text-xs truncate">{REACTION_FAMILY_LABELS[group]}</span>
                        <RigTierCombobox
                          ariaLabel={`${REACTION_FAMILY_LABELS[group]} ME rig`}
                          size={size}
                          selected={row.meRig}
                          selectedLabel={
                            row.meRig === 'custom'
                              ? customRigClosedLabel(row.rigMeBonusPercent)
                              : reactionRigPreview('me', row.meRig, security)
                          }
                          options={presetRigOptions((option) =>
                            reactionRigPreview('me', option, security),
                          )}
                          seedDraft={seedSingleRigDraft(
                            row.meRig,
                            row.rigMeBonusPercent,
                            'me',
                            security,
                            'reaction',
                          )}
                          customHint="Type a custom ME %"
                          onPick={(meRig) => patchFamily(group, { meRig })}
                          onCommitDraft={(raw) => {
                            const next = resolveTypedRigSingle(raw, 'me', security, 'reaction')
                            if (!next) return
                            patchFamily(group, {
                              meRig: next.tier,
                              rigMeBonusPercent: next.percent,
                            })
                          }}
                        />
                        <RigTierCombobox
                          ariaLabel={`${REACTION_FAMILY_LABELS[group]} TE rig`}
                          size={size}
                          selected={row.teRig}
                          selectedLabel={
                            row.teRig === 'custom'
                              ? customRigClosedLabel(row.rigTeBonusPercent)
                              : reactionRigPreview('te', row.teRig, security)
                          }
                          options={presetRigOptions((option) =>
                            reactionRigPreview('te', option, security),
                          )}
                          seedDraft={seedSingleRigDraft(
                            row.teRig,
                            row.rigTeBonusPercent,
                            'te',
                            security,
                            'reaction',
                          )}
                          customHint="Type a custom TE %"
                          onPick={(teRig) => patchFamily(group, { teRig })}
                          onCommitDraft={(raw) => {
                            const next = resolveTypedRigSingle(raw, 'te', security, 'reaction')
                            if (!next) return
                            patchFamily(group, {
                              teRig: next.tier,
                              rigTeBonusPercent: next.percent,
                            })
                          }}
                        />
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
