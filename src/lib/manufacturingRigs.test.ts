import { describe, expect, it } from 'vitest'
import {
  familyRigsFromFitted,
  normalizeManufacturingRigs,
  resolveRigBonuses,
  resolveRigMePercent,
  resolveRigTePercent,
  rigSecurityMultiplier,
} from '@/lib/manufacturingRigs'
import { combineBonusPercent, manufacturingFacilityDetail } from '@/lib/facilityModifiers'
import { DEFAULT_MANUFACTURING_RIGS, DEFAULT_SETTINGS } from '@/types'

describe('manufacturingRigs', () => {
  it('scales rig security multipliers from displayed security', () => {
    expect(rigSecurityMultiplier(0.9)).toBe(1)
    expect(rigSecurityMultiplier(0.45)).toBe(1)
    expect(rigSecurityMultiplier(0.44)).toBe(1.9)
    expect(rigSecurityMultiplier(0.3)).toBe(1.9)
    expect(rigSecurityMultiplier(0.04)).toBe(2.1)
    expect(rigSecurityMultiplier(0)).toBe(2.1)
    expect(rigSecurityMultiplier(-0.5)).toBe(2.1)
  })

  it('resolves T1 ME in highsec as 2%', () => {
    const rigs = normalizeManufacturingRigs({ meRig: 't1' })
    expect(resolveRigMePercent(rigs, 1)).toBe(2)
  })

  it('applies per-category TE only to that family', () => {
    const rigs = normalizeManufacturingRigs({
      familyRigs: {
        ammo: { meRig: 'none', teRig: 't2' },
      },
    })
    expect(
      resolveRigBonuses(rigs, 0, { productGroup: 'Projectile Ammo', category: 'Charge' }).te,
    ).toBeCloseTo(50.4, 1)
    expect(resolveRigBonuses(rigs, 0, { productGroup: 'Frigate', category: 'Ship' }).te).toBe(0)
  })

  it('uses custom TE percent as-is without security scaling', () => {
    const rigs = normalizeManufacturingRigs({
      teRig: 'custom',
      rigTeBonusPercent: 50,
    })
    expect(resolveRigTePercent(rigs, 0)).toBe(50)
  })

  it('infers custom tier from legacy percent-only saves', () => {
    const rigs = normalizeManufacturingRigs({ rigTeBonusPercent: 50.4 })
    expect(rigs.teRig).toBe('custom')
    expect(resolveRigTePercent(rigs, 0)).toBeCloseTo(50.4, 5)
  })

  it('combines Sotiyo hull with T2 nullsec TE on ammunition only', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      structureType: 'sotiyo' as const,
      buildSystemSecurity: 0,
      manufacturingRigs: {
        ...DEFAULT_MANUFACTURING_RIGS,
        familyRigs: {
          ammo: { meRig: 'none' as const, teRig: 't2' as const },
        },
      },
    }
    const detail = manufacturingFacilityDetail(settings, {
      productGroup: 'Projectile Ammo',
      category: 'Charge',
    })
    expect(detail.rigTeBonusPercent).toBeCloseTo(50.4, 5)
    expect(detail.effectiveTeBonusPercent).toBeCloseTo(
      combineBonusPercent(25, 50.4),
      1,
    )
    expect(detail.effectiveTeBonusPercent).toBeCloseTo(62.8, 1)
    expect(
      manufacturingFacilityDetail(settings, {
        productGroup: 'Frigate',
        category: 'Ship',
      }).rigTeBonusPercent,
    ).toBe(0)
  })

  it('fills familyRigs from a fitted ammo TE rig on old saves', () => {
    const familyRigs = familyRigsFromFitted([
      {
        typeId: 37151,
        name: 'Standup M-Set Ammunition Manufacturing Time Efficiency II',
        meBase: 0,
        teBase: 24,
        jobCostBase: 0,
      },
    ])
    expect(familyRigs.ammo).toEqual({ meRig: 'none', teRig: 't2' })
  })
})
