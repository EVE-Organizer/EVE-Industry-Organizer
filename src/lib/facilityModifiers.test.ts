import { describe, expect, it } from 'vitest'
import {
  combineBonusPercent,
  manufacturingFacilityDetail,
  migrateManufacturingRigs,
  normalizeReactionFacility,
  reactionFacilityDetail,
  resolveManufacturingModifiers,
  resolveReactionModifiers,
  rigPercentFromCombined,
} from '@/lib/facilityModifiers'
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
      manufacturingRigs: { rigMeBonusPercent: 0, rigTeBonusPercent: 0, rigJobCostBonusPercent: 0 },
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
      manufacturingRigs: { rigMeBonusPercent: 2, rigTeBonusPercent: 20, rigJobCostBonusPercent: 0 },
    }
    const detail = manufacturingFacilityDetail(settings)
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

  it('applies Tatara hull and composite rig for reactions', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      reactionFacility: {
        ...DEFAULT_SETTINGS.reactionFacility,
        refineryType: 'tatara' as const,
        familyModifiers: {
          ...DEFAULT_SETTINGS.reactionFacility.familyModifiers,
          composite: { rigMeBonusPercent: 2.2, rigTeBonusPercent: 22, taxPercent: 1 },
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
    expect(detail.effectiveTeBonusPercent).toBeCloseTo(40, 5)
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
})
