import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseEft } from '@/lib/fitting/parseEft'
import {
  ADVANCED_WEAPON_UPGRADES,
  CPU_MANAGEMENT,
  ENERGY_WEAPON_RIGGING,
  POWER_GRID_MANAGEMENT,
  WEAPON_UPGRADES,
  buildFittingIndex,
  computeFitLoad,
  maxFittingLevels,
  minFittingLevels,
  requiredSkills,
  resolveFit,
} from '@/lib/fitting/fitSkills'
import { analyzeFit } from '@/lib/fitting/analyzeFit'
import { SAMPLE_RETRIBUTION_EFT as RETRIBUTION_EFT } from '@/lib/fitting/sampleEft'
import { formatFittingCombo, groupFitSkills, skillGroupName } from '@/lib/fitting/skillDisplay'
import type { FittingData, FitSkillRow } from '@/lib/fitting/types'
import type { SkillInfo } from '@/types'

const PULSE_KITE_EFT = `[Retribution, Pulse kite]

Imperial Navy Heat Sink
Imperial Navy Heat Sink
Centii A-Type Thermal Coating
Dark Blood Multispectrum Coating
Heat Sink II

Coreli A-Type 1MN Afterburner
Republic Fleet Small Cap Battery

Coreli A-Type Small Remote Armor Repairer
Small Focused Pulse Laser II
Small Focused Pulse Laser II
Small Focused Pulse Laser II
Small Focused Pulse Laser II

Small Energy Burst Aerator II
Small Thermal Armor Reinforcer II
`

function loadFitting() {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/fitting.json'), 'utf8'),
  ) as FittingData
  return buildFittingIndex(raw)
}

function loadSkills(): SkillInfo[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/data/skills.json'), 'utf8')) as SkillInfo[]
}

describe('parseEft', () => {
  it('reads ship, modules, cargo qty, and charged lines', () => {
    const parsed = parseEft(RETRIBUTION_EFT)
    expect(parsed.shipName).toBe('Retribution')
    expect(parsed.fitName).toBe('DPS T5/T6 Firestorm')
    expect(parsed.items.some((item) => item.name === 'Heat Sink II')).toBe(true)
    expect(parsed.items.find((item) => item.name === 'Aurora S')?.quantity).toBe(4)
  })

  it('rejects pastes without a hull header', () => {
    expect(() => parseEft('Heat Sink II\n')).toThrow(/Ship Name/)
  })
})

describe('Retribution Firestorm fit', () => {
  const index = loadFitting()
  const skills = loadSkills()

  it('resolves every module including the thermal rig', () => {
    const { ship, items, unknown } = resolveFit(parseEft(RETRIBUTION_EFT), index)
    expect(ship.name).toBe('Retribution')
    expect(unknown).toEqual([])
    expect(items.some((item) => item.type.name === 'Small Energy Burst Aerator II')).toBe(true)
    expect(items.some((item) => item.type.name === 'Small Thermal Armor Reinforcer II')).toBe(true)
  })

  it('needs Weapon Upgrades V for CPU, not IV', () => {
    const { ship, items } = resolveFit(parseEft(RETRIBUTION_EFT), index)
    const required = requiredSkills(ship, items, skills)
    const min = minFittingLevels(ship, items, required, skills)
    expect(min).not.toBeNull()
    expect(min?.levels.weaponUpgrades).toBe(5)
    expect(min?.levels.cpuManagement).toBe(5)
    expect(min?.load.cpuOk).toBe(true)
    expect(min?.load.powerOk).toBe(true)
  })

  it('fits on AWU IV plus Energy Weapon Rigging V, not AWU V', () => {
    const { ship, items } = resolveFit(parseEft(RETRIBUTION_EFT), index)
    const required = requiredSkills(ship, items, skills)
    const min = minFittingLevels(ship, items, required, skills)
    expect(min?.levels.advancedWeaponUpgrades).toBe(4)
    expect(min?.levels.rigging.energy).toBe(5)
    expect(min?.levels.powerGridManagement).toBe(5)
  })

  it('does not fit with WU IV even at CPU V', () => {
    const { ship, items } = resolveFit(parseEft(RETRIBUTION_EFT), index)
    const load = computeFitLoad(ship, items, {
      cpuManagement: 5,
      powerGridManagement: 5,
      weaponUpgrades: 4,
      advancedWeaponUpgrades: 5,
      electronicsUpgrades: 0,
      rigging: { energy: 5 },
    })
    expect(load.cpuOk).toBe(false)
  })

  it('lists Aurora crystal skill and Heat Sink II Weapon Upgrades', () => {
    const analysis = analyzeFit(RETRIBUTION_EFT, index, skills)
    expect(analysis.possible).toBe(true)
    expect(analysis.unknown).toEqual([])
    const names = Object.fromEntries(analysis.skills.map((row) => [row.name, row.required]))
    expect(names['Small Beam Laser Specialization']).toBeGreaterThanOrEqual(1)
    expect(names['Weapon Upgrades']).toBe(5)
    expect(names['Energy Weapon Rigging']).toBe(5)
    expect(names['Advanced Weapon Upgrades']).toBe(4)
    expect(names['Assault Frigates']).toBe(1)
    expect(names['Jury Rigging']).toBeGreaterThanOrEqual(3)
  })

  it('treats a missing skill sheet as untrained, not already qualified', () => {
    const analysis = analyzeFit(RETRIBUTION_EFT, index, skills)
    expect(analysis.possible).toBe(true)
    expect(analysis.fits).toBe(true)
    expect(analysis.maxLoad.cpuOk).toBe(true)
    expect(analysis.maxLoad.powerOk).toBe(true)
    expect(analysis.skills.length).toBeGreaterThan(0)
    expect(analysis.skills.every((row) => row.trained === 0)).toBe(true)
    expect(analysis.skills.some((row) => row.trained < row.required)).toBe(true)
  })

  it('only reports ready when the character actually has the skills', () => {
    const needed = analyzeFit(RETRIBUTION_EFT, index, skills)
    const trained = new Map(needed.skills.map((row) => [row.skillId, row.required]))
    const ready = analyzeFit(RETRIBUTION_EFT, index, skills, trained)
    expect(ready.fits).toBe(true)
    expect(ready.skills.every((row) => row.trained >= row.required)).toBe(true)

    trained.set(WEAPON_UPGRADES, 4)
    const short = analyzeFit(RETRIBUTION_EFT, index, skills, trained)
    expect(short.fits).toBe(false)
    const wu = short.skills.find((row) => row.skillId === WEAPON_UPGRADES)
    expect(wu?.trained).toBe(4)
    expect(wu?.required).toBe(5)
  })

  it('online a pulse kite Retribution when all fitting skills are V', () => {
    const analysis = analyzeFit(PULSE_KITE_EFT, index, skills)
    expect(analysis.possible).toBe(true)
    expect(analysis.fits).toBe(true)
    const max = computeFitLoad(
      resolveFit(parseEft(PULSE_KITE_EFT), index).ship,
      resolveFit(parseEft(PULSE_KITE_EFT), index).items,
      maxFittingLevels(),
    )
    expect(max.cpuOk).toBe(true)
    expect(max.powerOk).toBe(true)
    expect(max.cpuUsed).toBeLessThanOrEqual(max.cpuOutput)
    expect(max.powerUsed).toBeLessThanOrEqual(max.powerOutput)
  })
})

describe('fitting skill ids', () => {
  it('uses live SDE ids', () => {
    expect(CPU_MANAGEMENT).toBe(3426)
    expect(POWER_GRID_MANAGEMENT).toBe(3413)
    expect(WEAPON_UPGRADES).toBe(3318)
    expect(ADVANCED_WEAPON_UPGRADES).toBe(11207)
    expect(ENERGY_WEAPON_RIGGING).toBe(26258)
  })
})

describe('skillDisplay', () => {
  it('groups fitting, ship, and gunnery rows', () => {
    const rows: FitSkillRow[] = [
      { skillId: WEAPON_UPGRADES, name: 'Weapon Upgrades', required: 5, trained: 0, rank: 2 },
      { skillId: 12095, name: 'Assault Frigates', required: 1, trained: 0, rank: 4 },
      { skillId: 11083, name: 'Small Beam Laser Specialization', required: 1, trained: 0, rank: 3 },
    ]
    expect(skillGroupName(rows[0])).toBe('Fitting')
    expect(skillGroupName(rows[1])).toBe('Ship')
    expect(skillGroupName(rows[2])).toBe('Gunnery')
    expect(groupFitSkills(rows).map((group) => group.title)).toEqual(['Fitting', 'Ship', 'Gunnery'])
  })

  it('formats a fitting combo without empty rigging', () => {
    expect(
      formatFittingCombo({
        cpuManagement: 5,
        powerGridManagement: 5,
        weaponUpgrades: 5,
        advancedWeaponUpgrades: 4,
        electronicsUpgrades: 0,
        rigging: { energy: 5 },
      }),
    ).toContain('Energy Weapon Rigging V')
  })
})
