import { describe, expect, it } from 'vitest'
import {
  combineBonusPercent,
  manufacturingFacilityDetail,
  migrateManufacturingRigs,
  normalizeReactionFacility,
  normalizeScienceFacility,
  reactionFacilityDetail,
  resolveManufacturingModifiers,
  resolveReactionModifiers,
  resolveScienceModifiers,
  rigPercentFromCombined,
} from '@/lib/facilityModifiers'
import { patchScienceStructureType } from '@/lib/structureSettings'
import { normalizeGlobalSettings } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'

describe('facilityModifiers', () => {
  it('stacks hull and rig bonuses multiplicatively', () => {
    expect(combineBonusPercent(25, 20)).toBeCloseTo(40, 5)
    expect(combineBonusPercent(3, 2)).toBeCloseTo(4.94, 2)
  })

  it('recovers rig bonus from legacy combined hull+rig value', () => {
    expect(rigPercentFromCombined(25, 40)).toBeCloseTo(20, 5)
    expect(combineBonusPercent(25, rigPercentFromCombined(25, 40))).toBeCloseTo(40, 5)
  })

  it('applies Sotiyo hull with zero rigs unchanged from preset', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      structureType: 'sotiyo' as const,
      structureMeBonusPercent: 3,
      structureTeBonusPercent: 25,
      structureJobCostBonusPercent: 5,
      manufacturingRigs: {
        meRig: 'none' as const,
        teRig: 'none' as const,
        rigMeBonusPercent: 0,
        rigTeBonusPercent: 0,
        rigJobCostBonusPercent: 0,
      },
    }
    const mods = resolveManufacturingModifiers(settings)
    expect(mods.meBonusPercent).toBeCloseTo(3, 5)
    expect(mods.teBonusPercent).toBeCloseTo(25, 5)
    expect(mods.jobCostBonusPercent).toBeCloseTo(5, 5)
  })

  it('combines Sotiyo hull with rig ME/TE', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      structureType: 'sotiyo' as const,
      manufacturingRigs: {
        meRig: 'none' as const,
        teRig: 'none' as const,
        rigMeBonusPercent: 0,
        rigTeBonusPercent: 0,
        rigJobCostBonusPercent: 0,
        familyRigs: {
          equipment: { meRig: 't1' as const, teRig: 't1' as const },
        },
      },
    }
    const detail = manufacturingFacilityDetail(settings, {
      productGroup: 'Armor Plate',
      category: 'Module',
    })
    expect(detail.effectiveMeBonusPercent).toBeCloseTo(4.94, 2)
    expect(detail.effectiveTeBonusPercent).toBeCloseTo(40, 5)
  })

  it('migrates custom structure combined values into rig fields', () => {
    const migrated = migrateManufacturingRigs('custom', 5, 30, 4, undefined)
    expect(migrated.hullMe).toBe(0)
    expect(migrated.rigs.rigMeBonusPercent).toBe(5)
    expect(migrated.rigs.rigTeBonusPercent).toBe(30)
    expect(migrated.rigs.rigJobCostBonusPercent).toBe(4)
  })

  it('keeps per-category familyRigs when settings are normalized', () => {
    const familyRigs = { ammo: { meRig: 't2' as const, teRig: 't1' as const } }
    const settings = normalizeGlobalSettings({
      ...DEFAULT_SETTINGS,
      structureType: 'sotiyo',
      manufacturingRigs: {
        ...DEFAULT_SETTINGS.manufacturingRigs,
        familyRigs,
      },
    })
    expect(settings.manufacturingRigs.familyRigs).toEqual(familyRigs)
  })

  it('migrates legacy Tatara family rig tiers into reactorEfficiencyRig', () => {
    const facility = normalizeReactionFacility(
      {
        refineryType: 'tatara',
        reactionSystemSecurity: 0,
        familyModifiers: {
          composite: {
            meRig: 't1',
            teRig: 't1',
            rigMeBonusPercent: 0,
            rigTeBonusPercent: 0,
            taxPercent: 0,
          },
        },
      },
      30000172,
    )
    expect(facility.reactorEfficiencyRig).toBe('t1')
  })

  it('keeps legacy Tatara family rig bonuses when reactorEfficiencyRig is unset', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      buildSystemSecurity: 0,
      reactionFacility: {
        ...DEFAULT_SETTINGS.reactionFacility,
        refineryType: 'tatara' as const,
        reactionSystemSecurity: 0,
        familyModifiers: {
          ...DEFAULT_SETTINGS.reactionFacility.familyModifiers,
          composite: {
            meRig: 't1',
            teRig: 't1',
            rigMeBonusPercent: 0,
            rigTeBonusPercent: 0,
            taxPercent: 0,
          },
        },
      },
    }
    const detail = reactionFacilityDetail(settings, { reactionFamily: 'composite' })
    expect(detail.effectiveMeBonusPercent).toBeCloseTo(2.2, 5)
    expect(detail.effectiveTeBonusPercent).toBeCloseTo(41.5, 1)
  })

  it('applies Tatara hull and L-Set reactor efficiency rig', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      buildSystemSecurity: 0,
      reactionFacility: {
        ...DEFAULT_SETTINGS.reactionFacility,
        refineryType: 'tatara' as const,
        reactionSystemSecurity: 0,
        reactorEfficiencyRig: 't1' as const,
        familyModifiers: {
          ...DEFAULT_SETTINGS.reactionFacility.familyModifiers,
          composite: { rigMeBonusPercent: 0, rigTeBonusPercent: 0, taxPercent: 1 },
        },
      },
    }
    const detail = reactionFacilityDetail(settings, { reactionFamily: 'composite' })
    expect(detail.effectiveTeBonusPercent).toBeCloseTo(41.5, 1)
    expect(detail.effectiveMeBonusPercent).toBeCloseTo(2.2, 5)
    expect(detail.taxPercent).toBe(1)

    const mods = resolveReactionModifiers(settings, { reactionFamily: 'composite' })
    expect(mods.teBonusPercent).toBeCloseTo(41.5, 1)
    expect(mods.taxPercent).toBe(1)
  })

  it('uses per-family tax only for matching reaction type', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      reactionFacility: {
        ...DEFAULT_SETTINGS.reactionFacility,
        refineryType: 'tatara' as const,
        familyModifiers: {
          composite: { rigMeBonusPercent: 0, rigTeBonusPercent: 0, taxPercent: 1 },
          biochemical: { rigMeBonusPercent: 0, rigTeBonusPercent: 0, taxPercent: 2 },
          hybrid: { rigMeBonusPercent: 0, rigTeBonusPercent: 0, taxPercent: 3 },
        },
      },
    }
    expect(
      resolveReactionModifiers(settings, { reactionFamily: 'polymer' }).taxPercent,
    ).toBe(3)
    expect(
      resolveReactionModifiers(settings, { reactionFamily: 'biochemical' }).taxPercent,
    ).toBe(2)
  })

  it('defaults reaction facility from manufacturing system', () => {
    const facility = normalizeReactionFacility(undefined, 30000172)
    expect(facility.reactionSystemId).toBe(30000172)
    expect(facility.refineryType).toBe('none')
  })

  it('normalizes global settings with manufacturing rigs and reaction facility', () => {
    const settings = normalizeGlobalSettings({
      structureType: 'custom',
      structureMeBonusPercent: 4,
      structureTeBonusPercent: 10,
      structureJobCostBonusPercent: 1,
      manufacturingSystemId: 30000144,
    })
    expect(settings.manufacturingRigs.rigMeBonusPercent).toBe(4)
    expect(settings.structureMeBonusPercent).toBe(0)
    expect(settings.reactionFacility.reactionSystemId).toBe(30000144)
  })

  it('migrates legacy combined Sotiyo TE into hull preset plus rig remainder', () => {
    const settings = normalizeGlobalSettings({
      structureType: 'sotiyo',
      structureTeBonusPercent: 40,
      structureMeBonusPercent: 3,
      structureJobCostBonusPercent: 5,
    })
    expect(settings.structureTeBonusPercent).toBe(25)
    expect(settings.manufacturingRigs.rigTeBonusPercent).toBeCloseTo(20, 5)
    const detail = manufacturingFacilityDetail(settings)
    expect(detail.hullTeBonusPercent).toBe(25)
    expect(detail.rigTeBonusPercent).toBe(0)
  })

  it('does not double-stack reaction rig TE when migrating legacy manufacturing bonuses', () => {
    const settings = normalizeGlobalSettings({
      structureType: 'sotiyo',
      structureTeBonusPercent: 25,
      structureTaxPercent: 2,
    })
    expect(settings.reactionFacility.hullTeBonusPercent).toBe(25)
    expect(settings.reactionFacility.familyModifiers.composite.rigTeBonusPercent).toBe(0)
    expect(settings.reactionFacility.familyModifiers.composite.taxPercent).toBe(2)
  })

  it('resolves Sotiyo science hull TE and job cost without ME', () => {
    const facility = {
      ...DEFAULT_SETTINGS.copyFacility,
      structureType: 'sotiyo' as const,
    }
    const mods = resolveScienceModifiers(facility)
    expect(mods.meBonusPercent).toBe(0)
    expect(mods.teBonusPercent).toBe(25)
    expect(mods.jobCostBonusPercent).toBeCloseTo(5, 5)
  })

  it('scales science T2 TE with cached system security', () => {
    const mods = resolveScienceModifiers({
      ...DEFAULT_SETTINGS.copyFacility,
      structureType: 'raitaru',
      systemSecurity: 0,
      teRig: 't2',
    })
    expect(mods.teBonusPercent).toBeCloseTo(combineBonusPercent(15, 24 * 2.1), 5)
  })

  it('uses custom science hull percents and stacks M-Set cost and time rigs', () => {
    const mods = resolveScienceModifiers({
      ...DEFAULT_SETTINGS.copyFacility,
      structureType: 'custom',
      hullTeBonusPercent: 10,
      hullJobCostBonusPercent: 2,
      costRig: 't1',
      teRig: 't2',
      taxPercent: 1,
    })
    expect(mods.teBonusPercent).toBeCloseTo(combineBonusPercent(10, 24), 5)
    expect(mods.jobCostBonusPercent).toBeCloseTo(combineBonusPercent(2, 10), 5)
    expect(mods.taxPercent).toBe(1)
  })

  it('does not overwrite custom science percents when flipping to custom', () => {
    const current = {
      ...DEFAULT_SETTINGS.copyFacility,
      structureType: 'sotiyo' as const,
      hullTeBonusPercent: 12,
      hullJobCostBonusPercent: 4,
    }
    const patch = patchScienceStructureType('copyFacility', 'custom', current)
    expect(patch.copyFacility?.structureType).toBe('custom')
    expect(patch.copyFacility?.hullTeBonusPercent).toBe(12)
    expect(patch.copyFacility?.hullJobCostBonusPercent).toBe(4)
  })

  it('fills missing copy and invention facilities as NPC on normalize', () => {
    const settings = normalizeGlobalSettings({
      manufacturingSystemId: 30000172,
    })
    expect(settings.copyFacility.structureType).toBe('npc')
    expect(settings.copyFacility.systemId).toBe(30000172)
    expect(settings.inventionFacility.structureType).toBe('npc')
    expect(settings.inventionFacility.systemId).toBe(30000172)
    expect(normalizeScienceFacility(undefined, 30000172).structureType).toBe('npc')
  })
})
