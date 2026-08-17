import { describe, expect, it } from 'vitest'
import {
  applicableMiningBuffIds,
  defaultMiningShipForSubtype,
  fleetBurstYieldMultiplier,
  MINING_SHIPS,
  inferMiningBoostSpace,
  miningBuffIdsForBoostSpace,
  miningBuffsForContext,
  miningBuffsForFleetSetup,
  miningBuffsForSetup,
  miningCrystalMultiplier,
  miningSkillYieldMultiplier,
  miningUpgradeMultiplier,
  miningBurstSlotCount,
  normalizeMiningFleet,
  normalizeMiningForemanBursts,
  normalizeMiningShipId,
  normalizeMiningFleetSize,
  resolveUserMiningM3PerHr,
  resolveUserMiningM3PerHrFromFleet,
  toggleForemanBurst,
  toggleMiningBuffId,
  getMiningShip,
} from '@/lib/miningShipPresets'

describe('miningShipPresets', () => {
  it('defaults to Retriever for ore', () => {
    expect(defaultMiningShipForSubtype('ore')).toBe('retriever')
    expect(resolveUserMiningM3PerHr('ore', 'retriever', [])).toBe(42_163)
    expect(resolveUserMiningM3PerHr('ore', 'hulk', [])).toBeLessThan(
      resolveUserMiningM3PerHr('ore', 'covetor', []),
    )
  })

  it('switches invalid ship when subtype changes', () => {
    expect(normalizeMiningShipId('venture', 'ice')).toBe('retriever')
    expect(normalizeMiningShipId('prospect', 'ice')).toBe('retriever')
  })

  it('stacks implants on ship rate', () => {
    const base = resolveUserMiningM3PerHr('ore', 'retriever', [])
    const boosted = resolveUserMiningM3PerHr('ore', 'retriever', ['highwall'])
    expect(boosted).toBe(Math.round(base * 1.05))
    expect(resolveUserMiningM3PerHr('ore', 'venture', ['highwall'])).toBe(26_127)
  })

  it('applies MLU stacking to barges but not Ventures', () => {
    const retriever = getMiningShip('retriever')
    const venture = getMiningShip('venture')
    expect(miningUpgradeMultiplier('ore', retriever, 'mlu1', 3)).toBeGreaterThan(1.12)
    expect(miningUpgradeMultiplier('ore', venture, 'mlu1', 3)).toBe(1)
    const withMlu = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      upgrade: 'mlu1',
      upgradeCount: 3,
    })
    expect(withMlu).toBeGreaterThan(42_163)
    expect(
      resolveUserMiningM3PerHr('ore', 'venture', [], 'highsec', 1, {
        upgrade: 'mlu1',
        upgradeCount: 3,
      }),
    ).toBe(24_883)
  })

  it('applies T2 crystals on barges', () => {
    const ship = getMiningShip('retriever')
    expect(miningCrystalMultiplier('ore', ship, 't2')).toBe(810 / 150)
    expect(miningCrystalMultiplier('ore', ship, 't1', 'modulated')).toBe(675 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'none', 'strip')).toBe(1)
    expect(miningCrystalMultiplier('ore', getMiningShip('venture'), 't2')).toBe(1)
    expect(miningCrystalMultiplier('ice', ship, 't2', 'modulated')).toBe(240 / 200)
    expect(miningUpgradeMultiplier('ice', ship, 'mlu2', 3)).toBeGreaterThan(1.2)
  })

  it('scales ore yield from baked skill IV', () => {
    expect(miningSkillYieldMultiplier('ore', { mining: 4, astrogeology: 4 })).toBe(1)
    expect(miningSkillYieldMultiplier('ore', { mining: 5, astrogeology: 5 })).toBeGreaterThan(1)
    expect(miningSkillYieldMultiplier('ore', { mining: 0, astrogeology: 0 })).toBeLessThan(1)
  })

  it('uses booster hull and optimization burst for yield', () => {
    const solo = resolveUserMiningM3PerHr('ore', 'retriever', [])
    const orca = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      boosterHull: 'orca',
      foremanBurst: 'miningLaserOptimization',
      burstTech: 't2',
      industrialCore: true,
      skills: { industrialCommandShips: 4 },
    })
    expect(orca).toBeGreaterThan(solo)
    const rangeOnly = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      boosterHull: 'orca',
      foremanBurst: 'miningLaserFieldEnhancement',
    })
    expect(rangeOnly).toBe(solo)
  })

  it('lets a booster run two different Foreman charges', () => {
    expect(miningBurstSlotCount('porpoise')).toBe(2)
    expect(miningBurstSlotCount('orca')).toBe(3)
    const two = normalizeMiningForemanBursts('porpoise', [
      'miningLaserOptimization',
      'miningLaserFieldEnhancement',
    ])
    expect(two).toEqual(['miningLaserOptimization', 'miningLaserFieldEnhancement'])
    const capped = toggleForemanBurst('porpoise', two, 'miningEquipmentPreservation')
    expect(capped).toEqual(two)
    const withOpt = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      boosterHull: 'porpoise',
      foremanBursts: two,
      burstTech: 't2',
      industrialCore: false,
    })
    const rangeOnly = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      boosterHull: 'porpoise',
      foremanBursts: ['miningLaserFieldEnhancement', 'miningEquipmentPreservation'],
      burstTech: 't2',
      industrialCore: false,
    })
    expect(withOpt).toBeGreaterThan(rangeOnly)
  })

  it('stacks Mining Laser Efficiency crit yield on top of Optimization', () => {
    const ctx = {
      boosterHull: 'orca' as const,
      burstTech: 't2' as const,
      industrialCore: true,
      skills: { industrialCommandShips: 4 },
    }
    const solo = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1)
    const efficiency = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      ...ctx,
      foremanBursts: ['miningLaserEfficiency'],
    })
    const optimization = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      ...ctx,
      foremanBursts: ['miningLaserOptimization'],
    })
    const both = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      ...ctx,
      foremanBursts: ['miningLaserOptimization', 'miningLaserEfficiency'],
    })
    expect(efficiency).toBeGreaterThan(solo)
    expect(efficiency).toBeLessThan(optimization)
    expect(both).toBeGreaterThan(optimization)
  })

  it('mindlink increases optimization burst', () => {
    const ctx = {
      boosterHull: 'porpoise' as const,
      foremanBurst: 'miningLaserOptimization' as const,
      burstTech: 't2' as const,
      industrialCore: false,
    }
    const without = fleetBurstYieldMultiplier(
      ctx.boosterHull,
      ctx.foremanBurst,
      { industrialCommandShips: 4 },
      ctx.burstTech,
      false,
      false,
    )
    const withMind = fleetBurstYieldMultiplier(
      ctx.boosterHull,
      ctx.foremanBurst,
      { industrialCommandShips: 4 },
      ctx.burstTech,
      false,
      true,
    )
    expect(withMind).toBeGreaterThan(without)
  })

  it('shows mindlink when a booster hull is set', () => {
    const without = miningBuffsForContext('hulk', 'moon', 'nullsec', [], null)
    expect(without.fleet.some((b) => b.id === 'mindlink')).toBe(false)

    const withRorqual = miningBuffsForContext('hulk', 'moon', 'nullsec', [], 'rorqual')
    expect(withRorqual.fleet.some((b) => b.id === 'mindlink')).toBe(true)
  })

  it('filters implant buffs for hull and subtype', () => {
    expect(applicableMiningBuffIds('venture', 'ore', ['highwall'], 'highsec')).toEqual([
      'highwall',
    ])
    expect(applicableMiningBuffIds('hulk', 'moon', ['yeti'], 'nullsec')).toEqual([])
  })

  it('clears mindlink when booster is off', () => {
    expect(miningBuffIdsForBoostSpace(['highwall', 'mindlink'], 'solo', null)).toEqual([
      'highwall',
    ])
  })

  it('toggles implants', () => {
    expect(toggleMiningBuffId(['highwall'], 'mindlink')).toEqual(['highwall', 'mindlink'])
    expect(toggleMiningBuffId(['highwall', 'mindlink'], 'mindlink')).toEqual(['highwall'])
  })

  it('infers boost space from booster hull or legacy buffs', () => {
    expect(inferMiningBoostSpace([], 'highsec', 'orca')).toBe('highsec')
    expect(inferMiningBoostSpace([], 'solo', 'rorqual')).toBe('nullsec')
    expect(inferMiningBoostSpace(['orcaBoost'])).toBe('highsec')
    expect(inferMiningBoostSpace(['rorqualBoost'])).toBe('nullsec')
    expect(inferMiningBoostSpace(['porpoiseBoost'], 'solo')).toBe('wormhole')
    expect(inferMiningBoostSpace([])).toBe('solo')
  })

  it('lists fit implants without old hull boost chips', () => {
    const buffs = miningBuffsForSetup('retriever', 'ore', [], null)
    expect(buffs.some((b) => b.id === 'highwall')).toBe(true)
    expect(buffs.some((b) => b.id === 'mlu3')).toBe(false)
    expect(buffs.some((b) => b.id === 'orcaBoost')).toBe(false)
    expect(buffs.some((b) => b.id === 'mindlink')).toBe(false)
  })

  it('uses Mackinaw rate for ice', () => {
    expect(resolveUserMiningM3PerHr('ice', 'mackinaw', [])).toBe(51_020)
  })

  it('scales ice m³/hr with upgrades, booster, and fleet count', () => {
    const solo = resolveUserMiningM3PerHr('ice', 'retriever', [])
    const fitted = resolveUserMiningM3PerHr('ice', 'retriever', [], 'highsec', 2, {
      upgrade: 'mlu2',
      upgradeCount: 3,
      boosterHull: 'porpoise',
      foremanBursts: ['miningLaserOptimization'],
      burstTech: 't2',
    })
    expect(fitted).toBeGreaterThan(solo * 2)
  })

  it('uses Venture scoop rate for gas', () => {
    expect(resolveUserMiningM3PerHr('gas', 'venture', [])).toBe(9_000)
  })

  it('includes Endurance for all mining types', () => {
    expect(resolveUserMiningM3PerHr('ore', 'endurance', [])).toBe(24_883)
    expect(resolveUserMiningM3PerHr('ice', 'endurance', [])).toBe(22_000)
    expect(resolveUserMiningM3PerHr('gas', 'endurance', [])).toBe(1_800)
  })

  it('lists all nine mining hulls', () => {
    expect(MINING_SHIPS).toHaveLength(9)
  })

  it('scales m³/hr by fleet size', () => {
    expect(normalizeMiningFleetSize(undefined)).toBe(1)
    expect(normalizeMiningFleetSize(0)).toBe(1)
    expect(normalizeMiningFleetSize(5)).toBe(5)
    expect(normalizeMiningFleetSize(150)).toBe(99)

    const solo = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1)
    expect(resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 5)).toBe(solo * 5)
  })

  it('migrates legacy ship and fleet size', () => {
    expect(normalizeMiningFleet(undefined, 'ore', 'hulk', 3)).toMatchObject([
      { shipId: 'hulk', count: 3, miner: 'strip', crystal: 'none' },
    ])
  })

  it('merges duplicate hulls in fleet', () => {
    expect(
      normalizeMiningFleet(
        [
          { shipId: 'retriever', count: 2 },
          { shipId: 'retriever', count: 3 },
        ],
        'ore',
      ),
    ).toMatchObject([{ shipId: 'retriever', count: 5 }])
  })

  it('keeps the same hull with different crystals as separate lines', () => {
    const fleet = normalizeMiningFleet(
      [
        { shipId: 'retriever', count: 1, miner: 'strip', crystal: 'none' },
        { shipId: 'retriever', count: 1, miner: 'modulated', crystal: 't2' },
      ],
      'ore',
    )
    expect(fleet).toHaveLength(2)
  })

  it('remaps hulls that cannot mine the subtype and keeps count and fit', () => {
    expect(
      normalizeMiningFleet(
        [{ shipId: 'venture', count: 2, upgrade: 'mlu2', upgradeCount: 3 }],
        'ice',
      ),
    ).toMatchObject([{ shipId: 'retriever', count: 2, upgrade: 'mlu2', upgradeCount: 3 }])
    expect(normalizeMiningFleet([{ shipId: 'retriever', count: 2 }], 'gas')).toMatchObject([
      { shipId: 'venture', count: 2 },
    ])
  })

  it('sums mixed fleet m³/hr', () => {
    const soloHulk = resolveUserMiningM3PerHr('ore', 'hulk', [], 'highsec', 1)
    const soloRetriever = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1)
    const fleet = normalizeMiningFleet(
      [
        { shipId: 'hulk', count: 2 },
        { shipId: 'retriever', count: 3 },
      ],
      'ore',
    )
    expect(resolveUserMiningM3PerHrFromFleet('ore', fleet, [], 'highsec')).toBe(
      soloHulk * 2 + soloRetriever * 3,
    )
  })

  it('applies implants per hull in mixed fleet', () => {
    const buffs = ['highwall'] as const
    const fleet = normalizeMiningFleet(
      [
        { shipId: 'retriever', count: 1 },
        { shipId: 'venture', count: 1 },
      ],
      'ore',
    )
    const retrieverBoosted = resolveUserMiningM3PerHr('ore', 'retriever', [...buffs], 'highsec', 1)
    const ventureBoosted = resolveUserMiningM3PerHr('ore', 'venture', [...buffs], 'highsec', 1)
    expect(resolveUserMiningM3PerHrFromFleet('ore', fleet, [...buffs], 'highsec')).toBe(
      retrieverBoosted + ventureBoosted,
    )
  })

  it('unions implant chips across mixed fleet hulls', () => {
    const fleet = normalizeMiningFleet(
      [
        { shipId: 'retriever', count: 1 },
        { shipId: 'venture', count: 1 },
      ],
      'ore',
    )
    const buffs = miningBuffsForFleetSetup(fleet, 'ore', [], null)
    expect(buffs.some((b) => b.id === 'highwall')).toBe(true)
  })
})
