import { useState } from 'react'
import type { MiningBuffId, MiningShipId, MiningYieldContext } from '@/lib/miningShipPresets'
import {
  MINING_BOOSTER_HULLS,
  MINING_FIT_TYPE_IDS,
  MINING_FOREMAN_BURSTS,
  getMiningShip,
  inferMiningBoostSpace,
  miningBuffsForSetup,
  miningBurstSlotCount,
  miningShipsForSubtype,
  normalizeMiningBoostSpace,
  normalizeMiningFleet,
  normalizeMiningFleetSize,
  normalizeMiningForemanBursts,
  normalizeMiningMiner,
  normalizeMiningCrystal,
  normalizeMiningUpgrade,
  normalizeMiningUpgradeCount,
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
  MiningFleetLine,
  MiningForemanBurstId,
  MiningSubtype,
  MiningUpgradeId,
  SkillLevels,
} from '@/types'
import { EveImage } from '@/components/EveImage'
import { FilterSection } from '@/components/EconomicsFilterSection'
import { Tooltip } from '@/components/Tooltip'
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

function FitRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mining-filters__fit-row">
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
      t1: MINING_FIT_TYPE_IDS.iceHarvesterII,
      t1Name: 'Ice Harvester II',
      t2: MINING_FIT_TYPE_IDS.iceHarvesterII,
      t2Name: 'Ice Harvester II',
    }
  }
  if (subtype === 'moon') {
    return {
      strip: MINING_FIT_TYPE_IDS.stripMinerI,
      stripName: 'Strip Miner I',
      t1: MINING_FIT_TYPE_IDS.moonCrystalT1,
      t1Name: 'Ubiquitous Moon Mining Crystal Type A I',
      t2: MINING_FIT_TYPE_IDS.moonCrystalT2,
      t2Name: 'Ubiquitous Moon Mining Crystal Type A II',
    }
  }
  return {
    strip: MINING_FIT_TYPE_IDS.stripMinerI,
    stripName: 'Strip Miner I',
    t1: MINING_FIT_TYPE_IDS.oreCrystalT1,
    t1Name: 'Simple Asteroid Mining Crystal Type A I',
    t2: MINING_FIT_TYPE_IDS.oreCrystalT2,
    t2Name: 'Simple Asteroid Mining Crystal Type A II',
  }
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
      className="mining-filters__bay-count"
      step={1}
      min={1}
      max={99}
      value={display}
      aria-label={ariaLabel}
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

function gunChoice(line: MiningFleetLine): 'strip' | 't1' | 't2' {
  const crystal = normalizeMiningCrystal(line.crystal)
  const miner = normalizeMiningMiner(line.miner, crystal)
  if (miner !== 'modulated') return 'strip'
  return crystal === 't2' ? 't2' : 't1'
}

function gunPatch(choice: 'strip' | 't1' | 't2'): Pick<MiningFleetLine, 'miner' | 'crystal'> {
  if (choice === 'strip') return { miner: 'strip', crystal: 'none' }
  return { miner: 'modulated', crystal: choice }
}

function FleetLineCard({
  line,
  subtype,
  subtypeShips,
  canRemove,
  globalSkills,
  globalBuffIds,
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
  const gun = gunChoice(line)
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
            <span className="mining-filters__bay-stat-unit">m³/hr each</span>
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
              active={gun === 'strip'}
              typeId={guns.strip}
              name={guns.stripName}
              hint="Unmodulated guns. Hull tables assume this."
              onClick={() => onPatch(gunPatch('strip'))}
            />
            <IconChip
              active={gun === 't1'}
              typeId={guns.t1}
              name={guns.t1Name}
              hint="Modulated guns with Tech I crystals (~8% over Strip Miner I)."
              onClick={() => onPatch(gunPatch('t1'))}
            />
            <IconChip
              active={gun === 't2'}
              typeId={guns.t2}
              name={guns.t2Name}
              hint="Modulated guns with Tech II crystals (~17% over Strip Miner I)."
              onClick={() => onPatch(gunPatch('t2'))}
            />
          </FitRow>
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
              hint="+9% yield each, stacking. Click again to change how many."
              badge={upgrade === 'mlu1' ? upgradeCount : undefined}
              onClick={() => onUpgradeClick('mlu1')}
            />
            <IconChip
              active={upgrade === 'mlu2'}
              typeId={upgradeTypeId.mlu2}
              name={`${upgradeName} II`}
              hint="+10% yield each, stacking. Click again to change how many."
              badge={upgrade === 'mlu2' ? upgradeCount : undefined}
              onClick={() => onUpgradeClick('mlu2')}
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

  const fleetHint = `${normalizedFleet
    .map((line) => {
      const ship = getMiningShip(line.shipId)
      return line.count > 1 ? `${line.count}× ${ship.label}` : ship.label
    })
    .join(' + ')} · ${m3PerHr.toLocaleString()} m³/hr`

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
      <FilterSection
        title="Mining fleet"
        hint={fleetHint}
        className="blueprint-filters__card"
      >
        <div className="flex flex-col gap-3">
          {normalizedFleet.map((line, index) => (
            <FleetLineCard
              key={`${line.shipId}-${index}`}
              line={line}
              subtype={subtype}
              subtypeShips={subtypeShips}
              canRemove={normalizedFleet.length > 1}
              globalSkills={skills}
              globalBuffIds={buffIds}
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
          <button type="button" className="btn btn-ghost btn-xs self-start" onClick={addHull}>
            Add hull
          </button>
        </div>
      </FilterSection>

      <FilterSection
        title="Fleet booster"
        hint={boosterHull ? `${bursts.length}/${burstSlots} charges loaded` : 'No booster on grid'}
        className="blueprint-filters__card"
      >
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
          <>
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
          </>
        ) : null}
      </FilterSection>
    </div>
  )
}
