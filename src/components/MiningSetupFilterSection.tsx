import { useState } from 'react'
import type { MiningBuffId, MiningShipId, MiningYieldContext } from '@/lib/miningShipPresets'
import {
  MINING_BOOSTER_HULLS,
  MINING_CRYSTAL_OPTIONS,
  MINING_FIT_TYPE_IDS,
  MINING_FOREMAN_BURSTS,
  getMiningShip,
  inferMiningBoostSpace,
  miningBuffsForSetup,
  miningBurstSlotCount,
  miningCrystalExpectedCycles,
  miningCrystalExpectedDurationSeconds,
  miningCrystalLabel,
  miningCrystalLifeMultiplier,
  miningCrystalMercoxitTypeId,
  miningCrystalTypeId,
  miningShipsForSubtype,
  normalizeMiningBoostSpace,
  normalizeMiningFleet,
  normalizeMiningFleetSize,
  normalizeMiningForemanBursts,
  normalizeMiningMiner,
  normalizeMiningCrystal,
  normalizeMiningUpgrade,
  normalizeMiningUpgradeCount,
  normalizeMiningSurveyChipset,
  resolveUserMiningM3PerHr,
  resolveUserMiningM3PerHrFromFleet,
  toggleForemanBurst,
  yieldCtxForLine,
  buffIdsForLine,
  type MiningBoostSpace,
} from '@/lib/miningShipPresets'
import type {
  MiningBoosterHullId,
  MiningBurstTech,
  MiningCrystalId,
  MiningFleetLine,
  MiningForemanBurstId,
  MiningMinerModuleId,
  MiningSubtype,
  MiningSurveyChipsetId,
  MiningUpgradeId,
  SkillLevels,
} from '@/types'
import { EveImage } from '@/components/EveImage'
import { Tooltip, useAnchorTooltip } from '@/components/Tooltip'
import {
  SKILL_FIELDS,
  enforceSkillPrerequisites,
  formatSkillLevel,
  skillLevel,
  type SkillFieldDef,
} from '@/lib/skillFields'

function IconChip({
  active,
  typeId,
  name,
  hint,
  onClick,
  disabled,
  badge,
}: {
  active: boolean
  typeId: number
  name: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  badge?: number
}) {
  return (
    <Tooltip text={hint ? `${name}. ${hint}` : name} placement="top">
      <button
        type="button"
        aria-label={badge ? `${name} ×${badge}` : name}
        aria-pressed={active}
        disabled={disabled}
        className={`mining-filters__icon-chip${active ? ' mining-filters__icon-chip--active' : ''}${
          disabled ? ' mining-filters__icon-chip--disabled' : ''
        }`}
        onClick={onClick}
      >
        <EveImage id={typeId} size={32} framed alt="" lazy={false} />
        {badge ? <span className="mining-filters__icon-chip-badge">{badge}</span> : null}
      </button>
    </Tooltip>
  )
}

function EmptySlot({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip text={label} placement="top">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={`mining-filters__icon-chip mining-filters__icon-chip--empty${
          active ? ' mining-filters__icon-chip--active' : ''
        }`}
        onClick={onClick}
      >
        —
      </button>
    </Tooltip>
  )
}

function CrystalCard({
  active,
  ariaLabel,
  tooltip,
  children,
  onClick,
}: {
  active: boolean
  ariaLabel: string
  tooltip: React.ReactNode
  children: React.ReactNode
  onClick: () => void
}) {
  const { ref, triggerProps, TooltipPortal } = useAnchorTooltip('top')
  return (
    <>
      <button
        ref={(node) => ref(node)}
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={ariaLabel}
        className={`mining-filters__crystal-card${
          active ? ' mining-filters__crystal-card--active' : ''
        }`}
        onClick={onClick}
        {...triggerProps}
      >
        {children}
      </button>
      <TooltipPortal content={tooltip} />
    </>
  )
}

function FitRow({
  label,
  children,
  wide = false,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={`mining-filters__fit-row${wide ? ' mining-filters__fit-row--wide' : ''}`}>
      <span className="mining-filters__fit-label">{label}</span>
      <div className="mining-filters__slots">{children}</div>
    </div>
  )
}

function minerTypeIds(subtype: MiningSubtype) {
  if (subtype === 'ice') {
    return {
      strip: MINING_FIT_TYPE_IDS.iceHarvesterI,
      stripName: 'Ice Harvester I',
      modulated: MINING_FIT_TYPE_IDS.iceHarvesterII,
      modulatedName: 'Ice Harvester II',
    }
  }
  return {
    strip: MINING_FIT_TYPE_IDS.stripMinerI,
    stripName: 'Strip Miner I',
    modulated: MINING_FIT_TYPE_IDS.modulatedStripMinerII,
    modulatedName: 'Modulated Strip Miner II',
    deepCore: MINING_FIT_TYPE_IDS.modulatedDeepCoreStripMinerII,
    deepCoreName: 'Modulated Deep Core Strip Miner II',
  }
}

function crystalGroupLabel(subtype: MiningSubtype): string {
  if (subtype === 'moon') return 'Moon mining crystals'
  if (subtype === 'ice') return 'Mining crystals (not used by ice harvesters)'
  return 'Asteroid mining crystals'
}

function minerStripHint(subtype: MiningSubtype): string {
  if (subtype === 'ice') return 'Ice Harvester I: 1000 m³ / 240s. No crystal.'
  return 'Strip Miner I: 150 m³ / 45s. Cannot mine Mercoxit.'
}

function minerModulatedHint(subtype: MiningSubtype): string {
  if (subtype === 'ice') {
    return 'Ice Harvester II: same 1000 m³, 200s cycle (~20% faster).'
  }
  return 'Modulated Strip Miner II. Load a matching crystal for full yield. Not for Mercoxit.'
}

function CountInput({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number
  onCommit: (count: number) => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? String(value)

  function commit(raw = draft ?? String(value)) {
    const parsed = parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return
    const next = normalizeMiningFleetSize(parsed)
    if (next !== value) onCommit(next)
  }

  return (
    <input
      type="number"
      className="mining-filters__bay-count"
      step={1}
      min={1}
      max={99}
      value={display}
      aria-label={ariaLabel}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        commit(text)
      }}
      onBlur={() => {
        commit()
        setDraft(null)
      }}
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

function minerSkillKeys(subtype: MiningSubtype): SkillFieldDef['key'][] {
  if (subtype === 'ice') return ['iceHarvesting']
  if (subtype === 'gas') return ['gasCloudHarvesting']
  return ['mining', 'astrogeology']
}

function boosterSkillKeys(hull: MiningBoosterHullId | null): SkillFieldDef['key'][] {
  if (hull === 'rorqual') return ['capitalIndustrialShips']
  if (hull) return ['industrialCommandShips']
  return []
}


function setMinerModule(
  miner: MiningMinerModuleId,
  crystal: MiningCrystalId,
): Pick<MiningFleetLine, 'miner' | 'crystal'> {
  const xtal = normalizeMiningCrystal(crystal)
  if (miner === 'strip') return { miner: 'strip', crystal: 'none' }
  if (miner === 'deepCore') {
    if (xtal === 'none') return { miner, crystal: 'a1' }
    if (xtal[0] !== 'a') return { miner, crystal: xtal[1] === '2' ? 'a2' : 'a1' }
    return { miner, crystal: xtal }
  }
  return { miner, crystal: xtal === 'none' ? 'a2' : xtal }
}

function crystalOptionsForMiner(miner: MiningMinerModuleId) {
  if (miner === 'deepCore') {
    return MINING_CRYSTAL_OPTIONS.filter((opt) => opt.id.startsWith('a'))
  }
  return MINING_CRYSTAL_OPTIONS
}

function crystalTypeId(
  subtype: MiningSubtype,
  miner: MiningMinerModuleId,
  crystal: MiningCrystalId,
): number | null {
  if (miner === 'deepCore') return miningCrystalMercoxitTypeId(crystal)
  return miningCrystalTypeId(subtype, crystal)
}

type MiningCrystalOption = (typeof MINING_CRYSTAL_OPTIONS)[number]

function formatCrystalLifetime(seconds: number | null): string {
  if (seconds == null) return 'Unknown'
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 1) return `~${minutes}m`
  return minutes > 0 ? `~${hours}h ${minutes}m` : `~${hours}h`
}

function CrystalDetailTooltip({
  option,
  subtype,
  lifespanMultiplier,
}: {
  option: MiningCrystalOption
  subtype: MiningSubtype
  lifespanMultiplier: number
}) {
  const family = option.id[0]
  const purpose =
    family === 'a'
      ? 'Resource efficient'
      : family === 'b'
        ? 'Fast extraction'
        : 'Field clearance'
  const purposeClass =
    family === 'a'
      ? 'border-success/30 bg-success/10 text-success'
      : family === 'b'
        ? 'border-warning/30 bg-warning/10 text-warning'
        : 'border-error/30 bg-error/10 text-error'
  const effectiveRate = (option.yieldMultiplier / option.durationMultiplier).toFixed(2)
  const expectedCycles = miningCrystalExpectedCycles(subtype, option.id, lifespanMultiplier)
  const expectedDuration = miningCrystalExpectedDurationSeconds(
    subtype,
    option.id,
    lifespanMultiplier,
  )
  const preservationGainPct = Math.round((lifespanMultiplier - 1) * 100)

  if (subtype === 'ice') {
    return (
      <div className="flex w-60 flex-col gap-2">
        <div className="flex items-center justify-between gap-2 border-b border-eve-border/70 pb-1.5">
          <span className="font-semibold text-primary">{option.label}</span>
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${purposeClass}`}>
            {purpose}
          </span>
        </div>
        <p className="m-0 text-base-content/75">
          Ice harvesters do not use mining crystals. This selection is saved for ore or moon
          mining.
        </p>
      </div>
    )
  }

  const statClass = 'rounded bg-base-300/70 px-2 py-1.5'
  const labelClass = 'block text-[9px] uppercase tracking-wide text-base-content/45'
  const valueClass = 'block text-sm font-semibold text-base-content/90'

  return (
    <div className="flex w-60 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 border-b border-eve-border/70 pb-1.5">
        <span className="font-semibold text-primary">{option.label}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${purposeClass}`}>
          {purpose}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className={statClass}>
          <span className={labelClass}>Yield</span>
          <span className={valueClass}>{option.yieldMultiplier}×</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>Cycle duration</span>
          <span className={valueClass}>{option.durationMultiplier}×</span>
        </div>
        <div className={`${statClass} border border-primary/25 bg-primary/10`}>
          <span className={labelClass}>Effective rate</span>
          <span className="block text-sm font-semibold text-primary">{effectiveRate}×</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>Residue chance</span>
          <span className={option.residueProbabilityBonus > 0 ? 'block text-sm font-semibold text-warning' : valueClass}>
            +{option.residueProbabilityBonus}%
          </span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>Residue volume</span>
          <span className={option.residueVolumeBonus > 0 ? 'block text-sm font-semibold text-warning' : valueClass}>
            +{option.residueVolumeBonus}%
          </span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>Average life</span>
          <span className="block text-sm font-semibold text-base-content/90">
            ~{expectedCycles?.toLocaleString() ?? '—'} cycles
          </span>
          <span className="block text-[9px] text-base-content/50">
            {formatCrystalLifetime(expectedDuration)}
            {preservationGainPct > 0 ? ` · +${preservationGainPct}%` : ' · base'}
          </span>
        </div>
      </div>
      <div className="border-t border-eve-border/60 pt-1.5">
        <span className="block text-[9px] font-semibold uppercase tracking-wide text-primary/70">
          Best used for
        </span>
        <p className="m-0 mt-0.5 text-[11px] leading-snug text-base-content/80">
          {option.hint}
        </p>
      </div>
      <p className="m-0 text-[9px] leading-snug text-base-content/40">
        Lifespan is an average because damage is random. Preservation extends it; hull and fleet
        cycle bonuses reduce elapsed time.
      </p>
    </div>
  )
}

function FleetLineCard({
  line,
  subtype,
  subtypeShips,
  canRemove,
  globalSkills,
  globalBuffIds,
  crystalLifespanMultiplier,
  perShipM3,
  onShipChange,
  onCountChange,
  onPatch,
  onRemove,
}: {
  line: MiningFleetLine
  subtype: MiningSubtype
  subtypeShips: ReturnType<typeof miningShipsForSubtype>
  canRemove: boolean
  globalSkills: SkillLevels
  globalBuffIds: MiningBuffId[]
  crystalLifespanMultiplier: number
  perShipM3: number
  onShipChange: (shipId: MiningShipId) => void
  onCountChange: (count: number) => void
  onPatch: (patch: Partial<MiningFleetLine>) => void
  onRemove: () => void
}) {
  const ship = getMiningShip(line.shipId)
  const showFit = subtype !== 'gas' && (ship.tier === 'barge' || ship.tier === 'exhumer')
  const upgrade = normalizeMiningUpgrade(line.upgrade)
  const upgradeCount = normalizeMiningUpgradeCount(line.upgradeCount, upgrade)
  const surveyChipset = normalizeMiningSurveyChipset(line.surveyChipset)
  const crystal = normalizeMiningCrystal(line.crystal)
  const miner = normalizeMiningMiner(line.miner, crystal)
  const selectedCrystal = MINING_CRYSTAL_OPTIONS.find((opt) => opt.id === crystal)
  const selectedCrystalCycles = miningCrystalExpectedCycles(
    subtype,
    crystal,
    crystalLifespanMultiplier,
  )
  const selectedCrystalDuration = miningCrystalExpectedDurationSeconds(
    subtype,
    crystal,
    crystalLifespanMultiplier,
  )
  const preservationGainPct = Math.round((crystalLifespanMultiplier - 1) * 100)
  const lineSkills: SkillLevels = { ...globalSkills }
  if (line.skills) {
    for (const [key, value] of Object.entries(line.skills)) {
      if (typeof value === 'number') lineSkills[key] = value
    }
  }
  const skillKeys = minerSkillKeys(subtype)
  const implantBuffs = miningBuffsForSetup(line.shipId, subtype, globalBuffIds, null).filter(
    (b) => b.category === 'fit',
  )
  const lineBuffs = line.buffIds ?? globalBuffIds
  const guns = minerTypeIds(subtype)
  const upgradeTypeId = subtype === 'ice'
    ? { mlu1: MINING_FIT_TYPE_IDS.ihu1, mlu2: MINING_FIT_TYPE_IDS.ihu2 }
    : { mlu1: MINING_FIT_TYPE_IDS.mlu1, mlu2: MINING_FIT_TYPE_IDS.mlu2 }
  const upgradeName = subtype === 'ice' ? 'Ice Harvester Upgrade' : 'Mining Laser Upgrade'
  const hullKind =
    ship.tier === 'exhumer'
      ? 'Exhumer'
      : ship.tier === 'barge'
        ? 'Mining barge'
        : ship.tier === 'expedition'
          ? 'Expedition frigate'
          : 'Mining frigate'

  function setSkill(key: SkillFieldDef['key'], level: number) {
    const merged = enforceSkillPrerequisites({ ...lineSkills, [key]: level })
    onPatch({
      skills: {
        mining: merged.mining,
        astrogeology: merged.astrogeology,
        iceHarvesting: merged.iceHarvesting,
        gasCloudHarvesting: merged.gasCloudHarvesting,
      },
    })
  }

  function setUpgrade(next: MiningUpgradeId) {
    onPatch({
      upgrade: next,
      upgradeCount: next === 'none' ? 0 : Math.max(1, upgradeCount || 3),
    })
  }

  function onUpgradeClick(next: MiningUpgradeId) {
    if (next === 'none') {
      setUpgrade('none')
      return
    }
    if (upgrade === next) {
      const count = upgradeCount >= 3 ? 1 : upgradeCount + 1
      onPatch({ upgrade: next, upgradeCount: count })
      return
    }
    setUpgrade(next)
  }

  function setSurveyChipset(next: MiningSurveyChipsetId) {
    onPatch({ surveyChipset: next })
  }

  return (
    <article className="mining-filters__bay">
      <header className="mining-filters__bay-head">
        <span className="mining-filters__bay-art" aria-hidden>
          <EveImage
            id={ship.typeId}
            variant="render"
            size={64}
            alt=""
            framed={false}
            lazy={false}
            className="max-h-full max-w-full object-contain"
          />
        </span>
        <div className="mining-filters__bay-identity">
          <select
            className="mining-filters__bay-select"
            value={line.shipId}
            aria-label={`Hull for ${ship.label}`}
            onChange={(e) => onShipChange(e.target.value as MiningShipId)}
          >
            {subtypeShips.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <p className="mining-filters__bay-hint">
            {hullKind}
            {ship.tech === 't2' ? ' · Tech II' : ' · Tech I'}
          </p>
        </div>
        <div className="mining-filters__bay-meta">
          <CountInput
            value={line.count}
            ariaLabel={`${ship.label} count`}
            onCommit={onCountChange}
          />
          <div className="mining-filters__bay-stat">
            <span className="mining-filters__bay-stat-value">{perShipM3.toLocaleString()}</span>
            <span className="mining-filters__bay-stat-unit">
              {showFit && miner !== 'strip' && crystal !== 'none' && subtype !== 'ice'
                ? `m³/hr each, ${miningCrystalLabel(crystal)}`
                : showFit && miner !== 'strip' && subtype === 'ore' && miner === 'deepCore'
                  ? 'm³/hr each, MDCSM Mercoxit'
                  : 'm³/hr each'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square shrink-0"
            disabled={!canRemove}
            aria-label={`Remove ${ship.label}`}
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </header>

      {showFit ? (
        <>
          <FitRow label="Miner">
            <IconChip
              active={miner === 'strip'}
              typeId={guns.strip}
              name={guns.stripName}
              hint={minerStripHint(subtype)}
              onClick={() => onPatch(setMinerModule('strip', 'none'))}
            />
            <IconChip
              active={miner === 'modulated'}
              typeId={guns.modulated}
              name={guns.modulatedName}
              hint={minerModulatedHint(subtype)}
              onClick={() =>
                onPatch(
                  subtype === 'ice'
                    ? { miner: 'modulated', crystal: 'none' }
                    : setMinerModule('modulated', crystal),
                )
              }
            />
          </FitRow>
          {subtype === 'ore' ? (
            <FitRow label="Deep core">
              <IconChip
                active={miner === 'deepCore'}
                typeId={guns.deepCore!}
                name={guns.deepCoreName!}
                hint="Modulated Deep Core Strip Miner II. Table shows Mercoxit only when this is selected."
                onClick={() => onPatch(setMinerModule('deepCore', crystal))}
              />
            </FitRow>
          ) : null}
          {subtype !== 'ice' && (miner === 'modulated' || miner === 'deepCore') ? (
            <FitRow label="Crystal" wide>
              <div
                className="mining-filters__crystal-grid"
                role="radiogroup"
                aria-label={crystalGroupLabel(subtype)}
              >
                <CrystalCard
                  active={crystal === 'none'}
                  ariaLabel="No crystal"
                  tooltip={
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-primary">No crystal</span>
                      <span>Uses the module's base yield.</span>
                      <span className="text-base-content/65">No crystal residue or wear.</span>
                    </div>
                  }
                  onClick={() => onPatch({ crystal: 'none' })}
                >
                  <span className="mining-filters__crystal-empty" aria-hidden>∅</span>
                  <span className="mining-filters__crystal-name">None</span>
                </CrystalCard>
                {crystalOptionsForMiner(miner).map((opt) => {
                  const typeId = crystalTypeId(subtype, miner, opt.id)
                  return (
                    <CrystalCard
                      key={opt.id}
                      active={crystal === opt.id}
                      ariaLabel={`${opt.label}: ${opt.hint}`}
                      tooltip={
                        <CrystalDetailTooltip
                          option={opt}
                          subtype={subtype}
                          lifespanMultiplier={crystalLifespanMultiplier}
                        />
                      }
                      onClick={() => onPatch({ crystal: opt.id })}
                    >
                      {typeId ? (
                        <EveImage id={typeId} size={30} framed alt="" lazy={false} />
                      ) : null}
                      <span className="mining-filters__crystal-name">
                        {opt.label.replace('Type ', '')}
                      </span>
                    </CrystalCard>
                  )
                })}
              </div>
              {selectedCrystal ? (
                <div className="mining-filters__crystal-summary">
                  <span className="mining-filters__crystal-summary-name">
                    {selectedCrystal.label}
                  </span>
                  <div className="mining-filters__crystal-stats">
                    <span>Yield <strong>{selectedCrystal.yieldMultiplier}×</strong></span>
                    <span>Cycle <strong>{selectedCrystal.durationMultiplier}×</strong></span>
                    <span>
                      Throughput{' '}
                      <strong>
                        {(selectedCrystal.yieldMultiplier /
                          selectedCrystal.durationMultiplier).toFixed(2)}
                        ×
                      </strong>
                    </span>
                    <span>
                      Residue chance <strong>+{selectedCrystal.residueProbabilityBonus}%</strong>
                    </span>
                    <span>
                      Residue volume <strong>+{selectedCrystal.residueVolumeBonus}%</strong>
                    </span>
                    <span>
                      Avg. life{' '}
                      <strong>
                        ~{selectedCrystalCycles?.toLocaleString() ?? '—'} cycles ·{' '}
                        {formatCrystalLifetime(selectedCrystalDuration)}
                        {preservationGainPct > 0
                          ? ` with Preservation (+${preservationGainPct}%)`
                          : ' base'}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mining-filters__crystal-summary">
                  <span className="mining-filters__crystal-summary-name">No crystal</span>
                  <span className="mining-filters__crystal-summary-note">
                    Base module yield with no crystal residue or wear.
                  </span>
                </div>
              )}
            </FitRow>
          ) : null}
          <FitRow label="Upgrade">
            <EmptySlot
              active={upgrade === 'none'}
              label="No upgrade"
              onClick={() => onUpgradeClick('none')}
            />
            <IconChip
              active={upgrade === 'mlu1'}
              typeId={upgradeTypeId.mlu1}
              name={`${upgradeName} I`}
              hint="+5% yield each, stacking. Click again to change how many."
              badge={upgrade === 'mlu1' ? upgradeCount : undefined}
              onClick={() => onUpgradeClick('mlu1')}
            />
            <IconChip
              active={upgrade === 'mlu2'}
              typeId={upgradeTypeId.mlu2}
              name={`${upgradeName} II`}
              hint="+9% yield each, stacking. Click again to change how many."
              badge={upgrade === 'mlu2' ? upgradeCount : undefined}
              onClick={() => onUpgradeClick('mlu2')}
            />
          </FitRow>
          <FitRow label="Chipset">
            <EmptySlot
              active={surveyChipset === 'none'}
              label="No chipset"
              onClick={() => setSurveyChipset('none')}
            />
            <IconChip
              active={surveyChipset === 'msc1'}
              typeId={MINING_FIT_TYPE_IDS.msc1}
              name="Mining Survey Chipset I"
              hint="+12% mining crit chance and crit yield."
              onClick={() => setSurveyChipset('msc1')}
            />
            <IconChip
              active={surveyChipset === 'msc2'}
              typeId={MINING_FIT_TYPE_IDS.msc2}
              name="Mining Survey Chipset II"
              hint="+20% mining crit chance and crit yield."
              onClick={() => setSurveyChipset('msc2')}
            />
          </FitRow>
        </>
      ) : null}

      {implantBuffs.length > 0 ? (
        <FitRow label="Implant">
          {implantBuffs.map((buff) =>
            buff.typeId ? (
              <IconChip
                key={buff.id}
                active={lineBuffs.includes(buff.id)}
                typeId={buff.typeId}
                name={buff.label}
                hint={buff.hint}
                onClick={() => {
                  const current = line.buffIds ?? globalBuffIds.filter((b) => b !== 'mindlink')
                  const next = current.includes(buff.id)
                    ? current.filter((b) => b !== buff.id)
                    : [...current, buff.id]
                  onPatch({ buffIds: next as MiningBuffId[] })
                }}
              />
            ) : null,
          )}
        </FitRow>
      ) : null}

      <details className="mining-filters__pilot">
        <summary>Skills</summary>
        <div className="mt-2 flex flex-col gap-2">
          {skillKeys.map((key) => {
            const field = SKILL_FIELDS.find((f) => f.key === key)
            if (!field) return null
            const value = skillLevel(lineSkills, key)
            return (
              <label key={key} className="flex min-w-0 flex-col gap-1">
                <span className="flex justify-between text-xs">
                  {field.label}
                  <span className="tabular-nums opacity-60">{formatSkillLevel(value)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={value}
                  aria-label={`${ship.label} ${field.label}`}
                  className="range range-primary range-xs"
                  onChange={(e) => setSkill(key, Number(e.target.value))}
                />
              </label>
            )
          })}
        </div>
      </details>
    </article>
  )
}

export interface MiningSetupFilterSectionProps {
  subtype: MiningSubtype
  fleet: MiningFleetLine[]
  buffIds: MiningBuffId[]
  boostSpace: MiningBoostSpace
  yieldCtx: MiningYieldContext
  skills: SkillLevels
  onFleetChange: (fleet: MiningFleetLine[]) => void
  onBuffToggle: (id: MiningBuffId) => void
  onYieldChange: (patch: MiningYieldContext) => void
  onSkillsChange: (skills: SkillLevels) => void
}

export function MiningSetupFilterSection({
  subtype,
  fleet,
  buffIds,
  boostSpace,
  yieldCtx,
  skills,
  onFleetChange,
  onBuffToggle,
  onYieldChange,
  onSkillsChange,
}: MiningSetupFilterSectionProps) {
  const boosterHull = yieldCtx.boosterHull ?? null
  const space = inferMiningBoostSpace(buffIds, normalizeMiningBoostSpace(boostSpace), boosterHull)
  const normalizedFleet = normalizeMiningFleet(fleet, subtype)
  const subtypeShips = miningShipsForSubtype(subtype)
  const m3PerHr = resolveUserMiningM3PerHrFromFleet(
    subtype,
    normalizedFleet,
    buffIds,
    space,
    yieldCtx,
  )
  const bursts = normalizeMiningForemanBursts(
    boosterHull,
    yieldCtx.foremanBursts,
    yieldCtx.foremanBurst,
  )
  const burstSlots = miningBurstSlotCount(boosterHull)
  const burstTech = yieldCtx.burstTech === 't1' ? 't1' : 't2'
  const boosterSkills = boosterSkillKeys(boosterHull)
  const selectedBooster = MINING_BOOSTER_HULLS.find((hull) => hull.id === boosterHull)
  const crystalLifespanMultiplier = miningCrystalLifeMultiplier(yieldCtx, buffIds)

  const fleetComposition = normalizedFleet
    .map((line) => {
      const ship = getMiningShip(line.shipId)
      return line.count > 1 ? `${line.count}× ${ship.label}` : ship.label
    })
    .join(' + ')
  const fleetShipCount = normalizedFleet.reduce((total, line) => total + line.count, 0)

  function updateLine(index: number, patch: Partial<MiningFleetLine>) {
    const next = normalizedFleet.map((line, i) =>
      i === index ? { ...line, ...patch } : line,
    )
    onFleetChange(normalizeMiningFleet(next, subtype))
  }

  function removeLine(index: number) {
    if (normalizedFleet.length <= 1) return
    onFleetChange(normalizeMiningFleet(normalizedFleet.filter((_, i) => i !== index), subtype))
  }

  function addHull() {
    const shipId = subtypeShips[0]?.id
    if (!shipId) return
    onFleetChange(
      normalizeMiningFleet([...normalizedFleet, { shipId, count: 1 }], subtype),
    )
  }

  function setSkill(key: SkillFieldDef['key'], level: number) {
    onSkillsChange(enforceSkillPrerequisites({ ...skills, [key]: level }))
  }

  return (
    <div className="mining-filters__fleet-grid">
      <section className="mining-filters__workspace-panel mining-filters__workspace-panel--fleet">
        <header className="mining-filters__workspace-head">
          <div className="min-w-0">
            <span className="mining-filters__workspace-kicker">Operation setup</span>
            <h3 className="mining-filters__workspace-title">Mining fleet</h3>
            <p className="mining-filters__workspace-subtitle">
              {fleetShipCount} {fleetShipCount === 1 ? 'ship' : 'ships'} · {fleetComposition}
            </p>
          </div>
          <div className="mining-filters__output">
            <span>Total output</span>
            <strong>{m3PerHr.toLocaleString()}</strong>
            <small>m³/hr</small>
          </div>
        </header>
        <div className="mining-filters__workspace-body">
          <div className="mining-filters__fleet-lines">
          {normalizedFleet.map((line, index) => (
            <FleetLineCard
              key={`${line.shipId}-${index}`}
              line={line}
              subtype={subtype}
              subtypeShips={subtypeShips}
              canRemove={normalizedFleet.length > 1}
              globalSkills={skills}
              globalBuffIds={buffIds}
              crystalLifespanMultiplier={crystalLifespanMultiplier}
              perShipM3={resolveUserMiningM3PerHr(
                subtype,
                line.shipId,
                buffIdsForLine(line, buffIds),
                space,
                1,
                yieldCtxForLine(line, yieldCtx),
              )}
              onShipChange={(shipId) => updateLine(index, { shipId })}
              onCountChange={(count) => updateLine(index, { count })}
              onPatch={(patch) => updateLine(index, patch)}
              onRemove={() => removeLine(index)}
            />
          ))}
          </div>
          <button type="button" className="mining-filters__add-hull" onClick={addHull}>
            <span aria-hidden>+</span>
            Add another hull
          </button>
        </div>
      </section>

      <section className="mining-filters__workspace-panel mining-filters__workspace-panel--booster">
        <header className="mining-filters__workspace-head">
          <div className="min-w-0">
            <span className="mining-filters__workspace-kicker">Command support</span>
            <h3 className="mining-filters__workspace-title">Fleet booster</h3>
            <p className="mining-filters__workspace-subtitle">
              {boosterHull
                ? `${selectedBooster?.label ?? 'Booster'} · ${bursts.length}/${burstSlots} charges loaded`
                : 'Optional foreman bonuses for the whole fleet'}
            </p>
          </div>
          <span
            className={`mining-filters__status-pill${
              boosterHull ? ' mining-filters__status-pill--active' : ''
            }`}
          >
            {boosterHull ? 'Online' : 'Offline'}
          </span>
        </header>
        <div className="mining-filters__workspace-body">
          <div role="group" aria-label="Booster hull" className="mining-filters__hull-tiles">
          <button
            type="button"
            aria-pressed={boosterHull == null}
            className={`mining-filters__hull-tile${boosterHull == null ? ' mining-filters__hull-tile--active' : ''}`}
            onClick={() => onYieldChange({ boosterHull: null, foremanBursts: [] })}
          >
            <span className="mining-filters__icon-chip mining-filters__icon-chip--empty">—</span>
            <span className="mining-filters__hull-tile-name">None</span>
          </button>
          {MINING_BOOSTER_HULLS.map((hull) => {
            const active = boosterHull === hull.id
            return (
              <button
                key={hull.id}
                type="button"
                title={hull.hint}
                aria-pressed={active}
                className={`mining-filters__hull-tile${active ? ' mining-filters__hull-tile--active' : ''}`}
                onClick={() =>
                  onYieldChange({
                    boosterHull: hull.id,
                    foremanBursts: normalizeMiningForemanBursts(
                      hull.id,
                      bursts,
                      'miningLaserOptimization',
                    ),
                  })
                }
              >
                <EveImage id={hull.typeId} size={40} framed={false} alt="" lazy={false} />
                <span className="mining-filters__hull-tile-name">{hull.label}</span>
              </button>
            )
          })}
          </div>

          {boosterHull ? (
            <div className="mining-filters__booster-fit">
            <FitRow label={`Charge ${bursts.length}/${burstSlots}`}>
              {MINING_FOREMAN_BURSTS.map((b) => {
                const active = bursts.includes(b.id)
                const full = !active && bursts.length >= burstSlots
                return (
                  <IconChip
                    key={b.id}
                    active={active}
                    disabled={full}
                    typeId={b.typeId}
                    name={b.label}
                    hint={full ? `All ${burstSlots} burst slots are filled.` : b.hint}
                    onClick={() =>
                      onYieldChange({
                        foremanBursts: toggleForemanBurst(
                          boosterHull,
                          bursts,
                          b.id as MiningForemanBurstId,
                        ),
                      })
                    }
                  />
                )
              })}
            </FitRow>
            <FitRow label="Burst">
              <IconChip
                active={burstTech === 't1'}
                typeId={MINING_FIT_TYPE_IDS.burstI}
                name="Mining Foreman Burst I"
                onClick={() => onYieldChange({ burstTech: 't1' as MiningBurstTech })}
              />
              <IconChip
                active={burstTech === 't2'}
                typeId={MINING_FIT_TYPE_IDS.burstII}
                name="Mining Foreman Burst II"
                hint="+25% burst strength"
                onClick={() => onYieldChange({ burstTech: 't2' })}
              />
            </FitRow>
            {boosterHull === 'orca' || boosterHull === 'rorqual' ? (
              <FitRow label="Core">
                <IconChip
                  active={yieldCtx.industrialCore !== false}
                  typeId={
                    boosterHull === 'rorqual'
                      ? MINING_FIT_TYPE_IDS.capitalIndustrialCore
                      : MINING_FIT_TYPE_IDS.largeIndustrialCore
                  }
                  name={
                    boosterHull === 'rorqual'
                      ? 'Capital Industrial Core I'
                      : 'Large Industrial Core I'
                  }
                  hint="+30% Mining Foreman burst strength. Click to toggle."
                  onClick={() =>
                    onYieldChange({ industrialCore: yieldCtx.industrialCore === false })
                  }
                />
              </FitRow>
            ) : null}
            <FitRow label="Mindlink">
              <IconChip
                active={buffIds.includes('mindlink')}
                typeId={MINING_FIT_TYPE_IDS.mindlink}
                name="Mining Foreman Mindlink"
                hint="+25% Mining Foreman burst strength. Click to toggle."
                onClick={() => onBuffToggle('mindlink')}
              />
            </FitRow>
            {boosterSkills.length > 0 ? (
              <details className="mining-filters__pilot">
                <summary>Skills</summary>
                <div className="mt-2 flex flex-col gap-2">
                  {boosterSkills.map((key) => {
                    const field = SKILL_FIELDS.find((f) => f.key === key)
                    if (!field) return null
                    const value = skillLevel(skills, key)
                    return (
                      <label key={key} className="flex min-w-0 flex-col gap-1">
                        <span className="flex justify-between text-xs">
                          {field.label}
                          <span className="tabular-nums opacity-60">{formatSkillLevel(value)}</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          step={1}
                          value={value}
                          aria-label={`${field.label} level`}
                          className="range range-primary range-xs"
                          onChange={(e) => setSkill(key, Number(e.target.value))}
                        />
                      </label>
                    )
                  })}
                </div>
              </details>
            ) : null}
            </div>
          ) : (
            <div className="mining-filters__booster-empty">
              <span className="mining-filters__booster-empty-mark" aria-hidden>+</span>
              <div>
                <strong>No command ship assigned</strong>
                <p>Select a Porpoise, Orca, or Rorqual to configure bursts and support skills.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
