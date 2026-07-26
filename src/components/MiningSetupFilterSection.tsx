import { useState } from 'react'
import type { MiningBuffId, MiningShipId } from '@/lib/miningShipPresets'
import {
  MINING_SHIPS,
  applicableMiningBuffIds,
  formatBuffPercent,
  formatMiningSetupSummary,
  getMiningShip,
  inferMiningBoostSpace,
  miningBuffsForSetup,
  miningShipSubtypeHint,
  miningShipSupportsSubtype,
  normalizeMiningBoostSpace,
  normalizeMiningShipId,
  normalizeMiningFleetSize,
  resolveUserMiningBaseM3PerHr,
  resolveUserMiningM3PerHr,
  type MiningBoostSpace,
  type MiningBuffPreset,
} from '@/lib/miningShipPresets'
import type { MiningSpaceClass, MiningSubtype } from '@/types'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'
import { MiningSpaceDot } from '@/components/MiningSpaceBadges'
import { spaceLabel } from '@/lib/miningIph'

function SetupLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="mining-filters__label shrink-0 sm:w-24">
      {label}
      {hint ? <InfoTooltip text={hint} /> : null}
    </span>
  )
}

function ShipChip({
  active,
  disabled,
  title,
  onClick,
  typeId,
  label,
}: {
  active: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  typeId: number
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      className={`mining-filters__ship-chip${active ? ' mining-filters__ship-chip--active' : ''}${
        disabled ? ' mining-filters__ship-chip--disabled' : ''
      }`}
      onClick={onClick}
    >
      <EveImage id={typeId} size={22} alt="" className="shrink-0 rounded-sm" lazy={false} />
      <span className="mining-filters__ship-chip-name">{label}</span>
    </button>
  )
}

function BuffSpaceTags({ spaces }: { spaces: readonly MiningBoostSpace[] }) {
  const tags = spaces.filter((s) => s !== 'solo') as MiningSpaceClass[]
  if (tags.length === 0 || tags.length >= 4) return null
  return (
    <span className="mining-filters__buff-chip-spaces">
      {tags.map((space) => (
        <span key={space} className="mining-filters__buff-chip-space" title={spaceLabel(space)}>
          <MiningSpaceDot space={space} />
          <span>{spaceLabel(space)}</span>
        </span>
      ))}
    </span>
  )
}

function BuffChip({
  buff,
  active,
  onToggle,
}: {
  buff: MiningBuffPreset
  active: boolean
  onToggle: (id: MiningBuffId) => void
}) {
  const isFleet = buff.category === 'fleet'
  const spaces = buff.boostSpaces ?? (isFleet && buff.id !== 'mindlink' ? ['highsec', 'lowsec', 'nullsec', 'wormhole'] : [])

  return (
    <button
      type="button"
      aria-pressed={active}
      title={buff.hint}
      className={`mining-filters__buff-chip${active ? ' mining-filters__buff-chip--active' : ''}${
        isFleet ? ' mining-filters__buff-chip--fleet' : ''
      }`}
      onClick={() => onToggle(buff.id)}
    >
      <span className="mining-filters__buff-chip-name">{buff.shortLabel}</span>
      {isFleet && buff.id !== 'mindlink' ? <BuffSpaceTags spaces={spaces} /> : null}
      <span className="mining-filters__buff-chip-pct tabular-nums">
        {formatBuffPercent(buff.multiplier)}
      </span>
    </button>
  )
}

function FleetSizeInput({
  value,
  onCommit,
}: {
  value: number
  onCommit: (size: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? String(value)

  function commit() {
    const parsed = parseInt(draft ?? String(value), 10)
    setDraft(null)
    if (!Number.isFinite(parsed) || parsed < 1) return
    const next = normalizeMiningFleetSize(parsed)
    if (next !== value) onCommit(next)
  }

  return (
    <input
      type="number"
      className="input input-bordered input-xs w-full max-w-[5.5rem] tabular-nums"
      step={1}
      min={1}
      max={99}
      value={display}
      aria-label="Number of mining ships"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

export interface MiningSetupFilterSectionProps {
  subtype: MiningSubtype
  shipId: MiningShipId
  buffIds: MiningBuffId[]
  boostSpace: MiningBoostSpace
  fleetSize: number
  onShipChange: (id: MiningShipId) => void
  onBuffToggle: (id: MiningBuffId) => void
  onFleetSizeChange: (size: number) => void
}

/** Collapsed-by-default ship and buff picker for mining m³/hr scale. */
export function MiningSetupFilterSection({
  subtype,
  shipId,
  buffIds,
  boostSpace,
  fleetSize,
  onShipChange,
  onBuffToggle,
  onFleetSizeChange,
}: MiningSetupFilterSectionProps) {
  const space = inferMiningBoostSpace(buffIds, normalizeMiningBoostSpace(boostSpace))
  const effectiveShipId = normalizeMiningShipId(shipId, subtype)
  const ship = getMiningShip(effectiveShipId)
  const supportedCount = MINING_SHIPS.filter((s) => miningShipSupportsSubtype(s, subtype)).length
  const activeBuffIds = applicableMiningBuffIds(effectiveShipId, subtype, buffIds, space)
  const buffs = miningBuffsForSetup(effectiveShipId, subtype, activeBuffIds)
  const effectiveFleetSize = normalizeMiningFleetSize(fleetSize)
  const baseM3 = resolveUserMiningBaseM3PerHr(subtype, effectiveShipId)
  const m3PerHr = resolveUserMiningM3PerHr(
    subtype,
    effectiveShipId,
    buffIds,
    space,
    effectiveFleetSize,
  )
  const perShipM3 = resolveUserMiningM3PerHr(subtype, effectiveShipId, buffIds, space, 1)
  const summary = formatMiningSetupSummary(
    subtype,
    effectiveShipId,
    buffIds,
    m3PerHr,
    space,
    effectiveFleetSize,
  )
  const hasBuffs = activeBuffIds.length > 0

  return (
    <details className="mining-filters__setup">
      <summary className="mining-filters__setup-summary">
        <span className="mining-filters__setup-title">Ship &amp; rate</span>
        <span className="mining-filters__setup-preview">{summary}</span>
      </summary>

      <div className="mining-filters__setup-body">
        <div className="mining-filters__setup-row">
          <SetupLabel
            label="Ship"
            hint={`${supportedCount} of ${MINING_SHIPS.length} hulls rated for ${subtype}. Greyed ships cannot mine this type.`}
          />
          <div role="group" aria-label="Mining ship" className="mining-filters__ship-grid">
            {MINING_SHIPS.map((s) => {
              const supported = miningShipSupportsSubtype(s, subtype)
              return (
                <ShipChip
                  key={s.id}
                  active={effectiveShipId === s.id}
                  disabled={!supported}
                  title={
                    supported
                      ? undefined
                      : `${s.label} is rated for ${miningShipSubtypeHint(s)} only`
                  }
                  typeId={s.typeId}
                  label={s.label}
                  onClick={() => onShipChange(s.id)}
                />
              )
            })}
          </div>
        </div>

        <div className="mining-filters__setup-row">
          <SetupLabel
            label="Mining ships"
            hint="Number of identical mining ships on grid. Scales m³/hr and ISK/hr rankings; fleet boosts apply to each ship."
          />
          <FleetSizeInput value={effectiveFleetSize} onCommit={onFleetSizeChange} />
        </div>

        <div className="mining-filters__setup-rate-card">
          <div className="mining-filters__setup-rate-main">
            <span className="mining-filters__setup-rate-value tabular-nums">
              {m3PerHr.toLocaleString()}
            </span>
            <span className="mining-filters__setup-rate-unit">m³/hr</span>
          </div>
          <div className="mining-filters__setup-rate-meta">
            {effectiveFleetSize > 1 ? (
              <>
                <span className="tabular-nums">{effectiveFleetSize}× {ship.label}</span>
                <span className="opacity-40" aria-hidden>
                  ·
                </span>
                <span className="tabular-nums opacity-60">
                  {perShipM3.toLocaleString()} each
                </span>
              </>
            ) : (
              <>
                <span className="tabular-nums">{ship.label}</span>
                <span className="opacity-40" aria-hidden>
                  ·
                </span>
                <span className="tabular-nums opacity-60">
                  {hasBuffs ? `${baseM3.toLocaleString()} base` : 'hull only'}
                </span>
              </>
            )}
          </div>
        </div>

        {buffs.length > 0 ? (
          <div className="mining-filters__setup-row mining-filters__setup-row--stack">
            <SetupLabel
              label="Buffs"
              hint="Personal modules, implants, and fleet foreman bursts. Pick one booster ship at a time."
            />
            <div role="group" aria-label="Mining buffs" className="mining-filters__buff-grid">
              {buffs.map((buff) => (
                <BuffChip
                  key={buff.id}
                  buff={buff}
                  active={activeBuffIds.includes(buff.id)}
                  onToggle={onBuffToggle}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  )
}
