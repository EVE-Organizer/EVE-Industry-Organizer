import { afterEach, describe, expect, it } from 'vitest'
import {
  catalogRigBase,
  refineryHullPreset,
  setUpwellCatalog,
  structureHullPreset,
  upwellRigBonuses,
} from '@/lib/upwellCatalog'
import { STRUCTURE_HULL_PRESETS, REFINERY_HULL_PRESETS } from '@/types'
import { familyRigsFromFitted, fittedRigBonusesFromCatalog } from '@/lib/manufacturingRigs'
import { patchStructureType } from '@/lib/structureSettings'

afterEach(() => {
  setUpwellCatalog(null)
})

describe('upwellCatalog hull presets', () => {
  it('matches today Raitaru 1/15/3 Azbel 2/20/4 Sotiyo 3/25/5 and Tatara 25 TE when catalog is empty', () => {
    expect(structureHullPreset('raitaru')).toEqual(STRUCTURE_HULL_PRESETS.raitaru)
    expect(structureHullPreset('azbel')).toEqual(STRUCTURE_HULL_PRESETS.azbel)
    expect(structureHullPreset('sotiyo')).toEqual(STRUCTURE_HULL_PRESETS.sotiyo)
    expect(refineryHullPreset('tatara')).toEqual(REFINERY_HULL_PRESETS.tatara)
    expect(STRUCTURE_HULL_PRESETS.raitaru).toEqual({
      hullMeBonusPercent: 1,
      hullTeBonusPercent: 15,
      hullJobCostBonusPercent: 3,
    })
    expect(STRUCTURE_HULL_PRESETS.azbel).toEqual({
      hullMeBonusPercent: 2,
      hullTeBonusPercent: 20,
      hullJobCostBonusPercent: 4,
    })
    expect(STRUCTURE_HULL_PRESETS.sotiyo).toEqual({
      hullMeBonusPercent: 3,
      hullTeBonusPercent: 25,
      hullJobCostBonusPercent: 5,
    })
    expect(REFINERY_HULL_PRESETS.tatara.hullTeBonusPercent).toBe(25)
  })

  it('reads hull percents from the loaded catalog', () => {
    setUpwellCatalog({
      hulls: [
        {
          typeId: 35825,
          name: 'Raitaru',
          kind: 'engineering',
          size: 'm',
          roleBonuses: { me: 1, te: 15, jobCost: 3 },
        },
      ],
      rigs: [],
    })
    expect(structureHullPreset('raitaru')).toEqual({
      hullMeBonusPercent: 1,
      hullTeBonusPercent: 15,
      hullJobCostBonusPercent: 3,
    })
    expect(patchStructureType('raitaru').structureMeBonusPercent).toBe(1)
  })

  it('resolves T1/T2 rig bases and ESI fitted bonuses by typeId', () => {
    setUpwellCatalog({
      hulls: [],
      rigs: [
        {
          typeId: 37158,
          name: 'Standup M-Set Ammunition Manufacturing Material Efficiency I',
          size: 'm',
          tier: 't1',
          activity: 'manufacturing',
          families: ['ammo'],
          me: 2,
          te: 0,
          jobCost: 0,
        },
        {
          typeId: 37151,
          name: 'Standup M-Set Ammunition Manufacturing Time Efficiency II',
          size: 'm',
          tier: 't2',
          activity: 'manufacturing',
          families: ['ammo'],
          me: 0,
          te: 24,
          jobCost: 0,
        },
      ],
    })
    expect(catalogRigBase('me', 't1')).toBe(2)
    expect(catalogRigBase('te', 't2')).toBe(24)
    expect(upwellRigBonuses(37151)).toEqual({ me: 0, te: 24, jobCost: 0 })
    expect(fittedRigBonusesFromCatalog(37151)).toEqual({ meBase: 0, teBase: 24, jobCostBase: 0 })
    expect(
      familyRigsFromFitted([
        { typeId: 37151, name: 'ignored', meBase: 0, teBase: 0, jobCostBase: 0 },
      ]).ammo,
    ).toEqual({ meRig: 'none', teRig: 't2' })
  })
})
