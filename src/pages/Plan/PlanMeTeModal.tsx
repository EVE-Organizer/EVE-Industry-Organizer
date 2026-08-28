import { useMemo, useState } from 'react'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import { resolveBlueprintMeTe, blueprintMeTe } from '@/lib/cost'
import type { BlueprintInfo, GlobalSettings, PlanNodeOverride } from '@/types'
import { MAX_ME, MAX_TE } from '@/types'

interface PlanMeTeModalProps {
  blueprint: BlueprintInfo
  name: string
  settings: GlobalSettings
  nodeOverride?: PlanNodeOverride
  onChange: (patch: { me?: number; te?: number } | null) => void
  onClose: () => void
}

function MeTeSlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="form-control gap-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        <span className="text-xs tabular-nums font-semibold">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range range-primary range-xs w-full"
        aria-label={label}
      />
    </label>
  )
}

export function PlanMeTeModal({
  blueprint,
  name,
  settings,
  nodeOverride,
  onChange,
  onClose,
}: PlanMeTeModalProps) {
  const resolved = resolveBlueprintMeTe(blueprint.tier, settings, nodeOverride, blueprint)
  const defaults = blueprintMeTe(blueprint.tier, settings, blueprint)

  const [draftMe, setDraftMe] = useState(resolved.me)
  const [draftTe, setDraftTe] = useState(resolved.te)

  const hasCustomOverride = useMemo(() => {
    if (resolved.locked) return false
    return nodeOverride?.me != null || nodeOverride?.te != null
  }, [resolved.locked, nodeOverride?.me, nodeOverride?.te])

  const lockedNote =
    blueprint.kind === 'reaction'
      ? 'Reaction formulas cannot be researched. ME and TE stay at 0.'
      : blueprint.tier === 't2'
      ? 'Invented T2 BPCs stay at ME 2 / TE 4.'
      : blueprint.tier === 'faction'
        ? 'Faction BPOs stay at ME 0 / TE 0.'
        : null

  function commitMeTe(me: number, te: number) {
    if (resolved.locked) return
    const sameAsDefault = me === defaults.me && te === defaults.te
    if (sameAsDefault) {
      onChange(null)
      return
    }
    onChange({ me, te })
  }

  function handleMe(next: number) {
    setDraftMe(next)
    commitMeTe(next, draftTe)
  }

  function handleTe(next: number) {
    setDraftTe(next)
    commitMeTe(draftMe, next)
  }

  function resetToDefault() {
    setDraftMe(defaults.me)
    setDraftTe(defaults.te)
    onChange(null)
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm p-0 overflow-hidden border border-eve-border bg-base-200 shadow-2xl">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-eve-border">
          <PlanProductIcon
            productTypeId={blueprint.productTypeId}
            blueprintTypeId={blueprint.blueprintTypeId}
            size={32}
            alt={name}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate leading-tight">{name}</h3>
            <p className="text-[11px] opacity-50 mt-0.5">Blueprint ME / TE</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle shrink-0 opacity-70 hover:opacity-100"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3">
          {lockedNote ? (
            <p className="text-xs opacity-70">{lockedNote}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MeTeSlider
                label="ME"
                value={draftMe}
                min={0}
                max={MAX_ME}
                disabled={resolved.locked}
                onChange={handleMe}
              />
              <MeTeSlider
                label="TE"
                value={draftTe}
                min={0}
                max={MAX_TE}
                disabled={resolved.locked}
                onChange={handleTe}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-eve-border bg-base-300/30">
          <p className="text-[11px] opacity-50 tabular-nums truncate">
            ME {resolved.me} · TE {resolved.te}
            {hasCustomOverride ? ' · custom' : ' · default'}
          </p>
          {!resolved.locked && hasCustomOverride ? (
            <button type="button" className="btn btn-ghost btn-xs shrink-0 h-7 min-h-0" onClick={resetToDefault}>
              Reset
            </button>
          ) : null}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  )
}
