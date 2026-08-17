import { describe, expect, it } from 'vitest'
import {
  applicableMiningBuffIds,
  defaultMiningShipForSubtype,
  effectiveMinerForOre,
  fleetCanMineOreGroup,
  fleetBurstYieldMultiplier,
  MINING_SHIPS,
  inferMiningBoostSpace,
  miningBuffIdsForBoostSpace,
  miningBuffsForContext,
  miningBuffsForFleetSetup,
  miningBuffsForSetup,
  miningCrystalExpectedCycles,
  miningCrystalExpectedDurationSeconds,
  miningCrystalLifeMultiplier,
  miningCrystalMultiplier,
  miningCritYieldMultiplier,
  miningHullSkillYieldMultiplier,
  miningSkillYieldMultiplier,
  miningUpgradeMultiplier,
  miningBurstSlotCount,
  normalizeMiningFleet,
  normalizeMiningCrystal,
  normalizeMiningForemanBursts,
  normalizeMiningShipId,
  normalizeMiningFleetSize,
  resolveUserMiningM3PerHr,
  resolveUserMiningM3PerHrForOre,
  resolveUserMiningM3PerHrFromFleet,
  toggleForemanBurst,
  toggleMiningBuffId,
  getMiningShip,
} from '@/lib/miningShipPresets'

describe('miningShipPresets', () => {
  it('defaults to Retriever for ore', () => {
    expect(defaultMiningShipForSubtype('ore')).toBe('retriever')
    expect(resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, { surveyChipset: 'none' })).toBe(
      42_163,
    )
    expect(resolveUserMiningM3PerHr('ore', 'hulk', [])).toBeGreaterThan(
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

  it('applies Mining Survey Chipset II crit bonus on barges', () => {
    const ship = getMiningShip('retriever')
    const none = miningCritYieldMultiplier('ore', ship, { surveyChipset: 'none' })
    const msc2 = miningCritYieldMultiplier('ore', ship, { surveyChipset: 'msc2' })
    expect(msc2).toBeCloseTo(1 + 0.012 * 2.4, 5)
    expect(msc2).toBeGreaterThan(none)
    const withChip = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      surveyChipset: 'msc2',
    })
    const bare = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      surveyChipset: 'none',
    })
    expect(withChip).toBeGreaterThan(bare)
  })

  it('migrates legacy t1/t2 crystal ids to Type A', () => {
    expect(normalizeMiningCrystal('t1')).toBe('a1')
    expect(normalizeMiningCrystal('t2')).toBe('a2')
  })

  it('estimates crystal lifespan from live volatility', () => {
    expect(miningCrystalExpectedCycles('ore', 'a1')).toBe(800)
    expect(miningCrystalExpectedCycles('ore', 'a2')).toBe(667)
    expect(miningCrystalExpectedCycles('moon', 'b1')).toBe(533)
    expect(miningCrystalExpectedCycles('moon', 'c1')).toBe(333)
    expect(miningCrystalExpectedCycles('ore', 'none')).toBeNull()
    expect(miningCrystalExpectedDurationSeconds('ore', 'a1')).toBe(10 * 60 * 60)
    expect(miningCrystalExpectedDurationSeconds('moon', 'b1')).toBe(21_587)
    expect(miningCrystalExpectedDurationSeconds('ore', 'none')).toBeNull()
  })

  it('extends crystal lifespan with an Equipment Preservation burst', () => {
    const baseCycles = miningCrystalExpectedCycles('ore', 'a2') ?? 0
    const multiplier = miningCrystalLifeMultiplier(
      {
        boosterHull: 'rorqual',
        foremanBursts: ['miningEquipmentPreservation'],
        burstTech: 't2',
        industrialCore: true,
        skills: { capitalIndustrialShips: 5 },
      },
      ['mindlink'],
    )
    expect(multiplier).toBeGreaterThan(1)
    expect(miningCrystalExpectedCycles('ore', 'a2', multiplier)).toBeGreaterThan(baseCycles)
    expect(
      miningCrystalLifeMultiplier({
        boosterHull: 'rorqual',
        foremanBursts: ['miningLaserOptimization'],
      }),
    ).toBe(1)
  })

  it('coerces deep core to modulated when subtype is moon or ice', () => {
    const deepLine = {
      shipId: 'retriever' as const,
      count: 1,
      miner: 'deepCore' as const,
      crystal: 'a2' as const,
    }
    const moonFleet = normalizeMiningFleet([deepLine], 'moon')
    expect(moonFleet[0]?.miner).toBe('modulated')
    expect(moonFleet[0]?.crystal).toBe('a2')
    const iceFleet = normalizeMiningFleet([deepLine], 'ice')
    expect(iceFleet[0]?.miner).toBe('modulated')
    expect(iceFleet[0]?.crystal).toBe('none')
  })

  it('matches live SDE cycle ratios vs Strip Miner I', () => {
    const ship = getMiningShip('retriever')
    expect(miningCrystalMultiplier('ore', ship, 'a1', 'modulated')).toBe(180 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'a2', 'modulated')).toBe(216 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'b1', 'modulated')).toBe(
      180 / 0.9 / 150,
    )
    expect(miningCrystalMultiplier('ore', ship, 'b2', 'modulated')).toBe(
      216 / 0.8 / 150,
    )
    expect(miningCrystalMultiplier('ore', ship, 'c1', 'modulated')).toBe(30 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'c2', 'modulated')).toBe(24 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'none', 'modulated')).toBe(120 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'none', 'strip')).toBe(1)
    expect(resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, { surveyChipset: 'none' })).toBe(
      42_163,
    )
    const strip = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      miner: 'strip',
      crystal: 'none',
      surveyChipset: 'none',
    })
    const t1 = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      miner: 'modulated',
      crystal: 'a1',
      surveyChipset: 'none',
    })
    expect(t1).toBe(Math.round(strip * (180 / 150)))
  })

  it('uses MDCSM II ratios for deep core and Mercoxit requirement', () => {
    const ship = getMiningShip('retriever')
    expect(miningCrystalMultiplier('ore', ship, 'a1', 'deepCore')).toBe(120 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'a2', 'deepCore')).toBe(144 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'none', 'deepCore')).toBe(80 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'a2', 'deepCore')).toBeLessThan(
      miningCrystalMultiplier('ore', ship, 'a2', 'modulated'),
    )
    expect(effectiveMinerForOre('modulated', 'a2', 'Mercoxit')).toBeNull()
    expect(effectiveMinerForOre('deepCore', 'a2', 'Mercoxit')).toEqual({
      miner: 'deepCore',
      crystal: 'a2',
    })
    expect(effectiveMinerForOre('strip', 'none', 'Mercoxit')).toBeNull()
    const fleet = [{ shipId: 'retriever' as const, count: 1, miner: 'modulated' as const, crystal: 'a2' as const }]
    expect(fleetCanMineOreGroup('ore', fleet, {}, 'Veldspar')).toBe(true)
    expect(fleetCanMineOreGroup('ore', fleet, {}, 'Mercoxit')).toBe(false)
    const msmM3 = resolveUserMiningM3PerHrForOre('ore', fleet, [], 'highsec', {}, 'Veldspar')
    const mercM3 = resolveUserMiningM3PerHrForOre('ore', fleet, [], 'highsec', {}, 'Mercoxit')
    const msmDirect = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      miner: 'modulated',
      crystal: 'a2',
      surveyChipset: 'msc2',
    })
    expect(msmM3).toBe(msmDirect)
    expect(mercM3).toBe(0)
    const deepFleet = [{ shipId: 'retriever' as const, count: 1, miner: 'deepCore' as const, crystal: 'a2' as const }]
    expect(fleetCanMineOreGroup('ore', deepFleet, {}, 'Mercoxit')).toBe(true)
    expect(fleetCanMineOreGroup('ore', deepFleet, {}, 'Veldspar')).toBe(false)
    const deepMercM3 = resolveUserMiningM3PerHrForOre('ore', deepFleet, [], 'highsec', {}, 'Mercoxit')
    const deepDirect = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      miner: 'deepCore',
      crystal: 'a2',
      surveyChipset: 'msc2',
    })
    expect(deepMercM3).toBe(deepDirect)
    expect(deepMercM3).toBeLessThan(msmM3)
  })

  it('applies T2 crystals on barges', () => {
    const ship = getMiningShip('retriever')
    expect(miningCrystalMultiplier('ore', ship, 'a2')).toBe(216 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'a1', 'modulated')).toBe(180 / 150)
    expect(miningCrystalMultiplier('ore', ship, 'none', 'strip')).toBe(1)
    expect(miningCrystalMultiplier('ore', getMiningShip('venture'), 'a2')).toBe(1)
    expect(miningCrystalMultiplier('ice', ship, 'a2', 'modulated')).toBe(240 / 200)
    expect(miningUpgradeMultiplier('ice', ship, 'mlu2', 3)).toBeGreaterThan(1.2)
  })

  it('scales ore yield from baked skill IV', () => {
    expect(miningSkillYieldMultiplier('ore', { mining: 4, astrogeology: 4 })).toBe(1)
    expect(miningSkillYieldMultiplier('ore', { mining: 5, astrogeology: 5 })).toBeGreaterThan(1)
    expect(miningSkillYieldMultiplier('ore', { mining: 0, astrogeology: 0 })).toBeLessThan(1)
  })

  it('applies Mining Barge and Exhumers hull bonuses', () => {
    const retriever = getMiningShip('retriever')
    const hulk = getMiningShip('hulk')
    expect(miningHullSkillYieldMultiplier('ore', retriever, { miningBarge: 4 })).toBe(1)
    expect(miningHullSkillYieldMultiplier('ore', retriever, { miningBarge: 5 })).toBeGreaterThan(1)
    expect(
      miningHullSkillYieldMultiplier('ore', hulk, { miningBarge: 5, exhumers: 5 }),
    ).toBeGreaterThan(1)
    expect(
      miningHullSkillYieldMultiplier('ice', hulk, { miningBarge: 5, exhumers: 5 }),
    ).toBeGreaterThan(1)
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
    expect(resolveUserMiningM3PerHr('ice', 'mackinaw', [])).toBe(60_739)
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
        { shipId: 'retriever', count: 1, miner: 'modulated', crystal: 'a2' },
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
    const soloHulk = resolveUserMiningM3PerHr('ore', 'hulk', [], 'highsec', 1, { surveyChipset: 'msc2' })
    const soloRetriever = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec', 1, {
      surveyChipset: 'msc2',
    })
    const fleet = normalizeMiningFleet(
      [
        { shipId: 'hulk', count: 2 },
        { shipId: 'retriever', count: 3 },
      ],
      'ore',
    )
    const fleetTotal = resolveUserMiningM3PerHrFromFleet('ore', fleet, [], 'highsec')
    const soloSum = soloHulk * 2 + soloRetriever * 3
    expect(Math.abs(fleetTotal - soloSum)).toBeLessThanOrEqual(2)
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
    const retrieverBoosted = resolveUserMiningM3PerHr('ore', 'retriever', [...buffs], 'highsec', 1, {
      surveyChipset: 'msc2',
    })
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
