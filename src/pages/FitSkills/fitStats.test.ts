import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { analyzeFit } from '@/pages/FitSkills/analyzeFit'
import { buildChargeGroups, compatibleCharges, eftChargeOptions } from '@/pages/FitSkills/fitCharges'
import { computeFitStats } from '@/pages/FitSkills/fitStats'
import { buildFittingIndex, resolveFit } from '@/pages/FitSkills/fitSkills'
import { maxoutSkillsForFit } from '@/pages/FitSkills/maxoutSkills'
import { parseEft } from '@/pages/FitSkills/parseEft'
import { SAMPLE_RETRIBUTION_EFT as RETRIBUTION_EFT } from '@/pages/FitSkills/sampleEft'
import type { FittingData, FleetLinkId } from '@/pages/FitSkills/types'
import { RAPID_FIRING, WEAPON_UPGRADES } from '@/pages/FitSkills/types'
import type { SkillInfo } from '@/types'

function loadFitting() {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/fitting.json'), 'utf8'),
  ) as FittingData
  return buildFittingIndex(raw)
}

function loadSkills(): SkillInfo[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/data/skills.json'), 'utf8')) as SkillInfo[]
}

function allVMap(ids: number[]): Map<number, number> {
  return new Map(ids.map((id) => [id, 5]))
}

describe('fit stats and charges', () => {
  const index = loadFitting()
  const skills = loadSkills()

  it('Retribution has combat attrs and traits in fitting.json', () => {
    const ship = index.byName.get('retribution')
    expect(ship?.combat?.shieldHp).toBeGreaterThan(0)
    expect(ship?.combat?.armorHp).toBeGreaterThan(0)
    expect(ship?.traits?.length).toBeGreaterThan(0)
    expect(ship?.combat?.agility).toBeGreaterThan(0)
  })

  it('charge options come from EFT cargo, not full SDE list', () => {
    const parsed = parseEft(RETRIBUTION_EFT)
    const { items } = resolveFit(parsed, index)
    const laser = index.byName.get('small focused beam laser ii')!
    const laserItems = items.filter((i) => i.type.typeId === laser.typeId)
    const eftOptions = eftChargeOptions(laser, parsed, index, laserItems)
    const sdeOptions = compatibleCharges(laser, index)

    expect(eftOptions.map((c) => c.name)).toEqual(['Aurora S', 'Gleam S'])
    expect(sdeOptions.length).toBeGreaterThan(eftOptions.length)

    const groups = buildChargeGroups(items, parsed, index)
    const laserGroup = groups.find((g) => g.label.includes('Small Focused Beam Laser'))!
    expect(laserGroup.options.map((c) => c.name)).toEqual(['Aurora S', 'Gleam S'])
  })

  it('defaults ammo from cargo to Aurora S on sample fit', () => {
    const parsed = parseEft(RETRIBUTION_EFT)
    const { items } = resolveFit(parsed, index)
    const groups = buildChargeGroups(items, parsed, index)
    const laserGroup = groups.find((g) => g.label.includes('Small Focused Beam Laser'))
    expect(laserGroup?.defaultChargeId).toBe(index.byName.get('aurora s')?.typeId)
  })

  it('swapping Gleam S changes DPS vs Aurora S', () => {
    const parsed = parseEft(RETRIBUTION_EFT)
    const { ship, items } = resolveFit(parsed, index)
    const groups = buildChargeGroups(items, parsed, index)
    const laserGroup = groups.find((g) => g.label.includes('Small Focused Beam Laser'))!
    const aurora = index.byName.get('aurora s')!
    const gleam = index.byName.get('gleam s')!
    const maxoutIds = maxoutSkillsForFit(ship, items).map((e) => e.skillId)
    const skillMap = allVMap(maxoutIds)

    const withAurora = items.map((item) =>
      item.type.typeId === laserGroup.moduleTypeId ? { ...item, charge: aurora } : item,
    )
    const withGleam = items.map((item) =>
      item.type.typeId === laserGroup.moduleTypeId ? { ...item, charge: gleam } : item,
    )

    const ctx = {
      skillLevels: skillMap,
      implantTypeIds: [] as number[],
      fleetLinks: [] as FleetLinkId[],
      rangeKm: 12,
      implantIndex: index,
    }
    const auroraStats = computeFitStats(ship, withAurora, ctx)
    const gleamStats = computeFitStats(ship, withGleam, ctx)
    expect(gleamStats.weapons?.rawDps).toBeGreaterThan(auroraStats.weapons?.rawDps ?? 0)
    expect(gleamStats.weapons?.optimalKm).toBeLessThan(auroraStats.weapons?.optimalKm ?? 999)
  })

  it('Shield Management changes shield HP in stats', () => {
    const parsed = parseEft(RETRIBUTION_EFT)
    const { ship, items } = resolveFit(parsed, index)
    const low = new Map<number, number>([[3419, 0]])
    const high = new Map<number, number>([[3419, 5]])
    const baseCtx = {
      implantTypeIds: [] as number[],
      fleetLinks: [] as FleetLinkId[],
      rangeKm: 12,
      implantIndex: index,
    }
    const lowStats = computeFitStats(ship, items, { ...baseCtx, skillLevels: low })
    const highStats = computeFitStats(ship, items, { ...baseCtx, skillLevels: high })
    expect(highStats.tank.shield.hp).toBeGreaterThan(lowStats.tank.shield.hp)
  })

  it('analyzeFit includes stats and charge groups', () => {
    const analysis = analyzeFit(RETRIBUTION_EFT, index, skills)
    expect(analysis.stats.tank.totalEhp).toBeGreaterThan(0)
    expect(analysis.chargeGroups.length).toBeGreaterThan(0)
    expect(analysis.maxoutSkillIds.length).toBeGreaterThan(0)
  })

  it('stats CPU/PG use fitting skills when preview only has maxout skills', () => {
    const draft = analyzeFit(RETRIBUTION_EFT, index, skills)
    const previewOnly = new Map<number, number>()
    for (const id of draft.maxoutSkillIds) previewOnly.set(id, 5)
    const analysis = analyzeFit(RETRIBUTION_EFT, index, skills, undefined, {
      previewSkills: previewOnly,
    })
    expect(analysis.stats.load.cpuOk).toBe(true)
    expect(analysis.stats.load.powerOk).toBe(true)
    expect(analysis.stats.load.cpuUsed).toBeLessThanOrEqual(analysis.stats.load.cpuOutput)
    expect(analysis.stats.load.powerUsed).toBeLessThanOrEqual(analysis.stats.load.powerOutput)
  })

  it('stats CPU/PG follow trained fitting skills when character is loaded', () => {
    const needed = analyzeFit(RETRIBUTION_EFT, index, skills)
    const trained = new Map(needed.skills.map((row) => [row.skillId, row.required]))
    const previewOnly = new Map(needed.maxoutSkillIds.map((id) => [id, 5]))
    const analysis = analyzeFit(RETRIBUTION_EFT, index, skills, trained, {
      previewSkills: previewOnly,
    })
    expect(analysis.stats.load.cpuOk).toBe(true)
    expect(analysis.stats.load.powerOk).toBe(true)
  })

  it('changing preview skill updates combat and fitting stats', () => {
    const draft = analyzeFit(RETRIBUTION_EFT, index, skills)
    const preview = new Map<number, number>()
    for (const row of draft.skills) preview.set(row.skillId, row.required)
    for (const id of draft.maxoutSkillIds) preview.set(id, 5)

    const atMax = analyzeFit(RETRIBUTION_EFT, index, skills, undefined, { previewSkills: preview })
    preview.set(RAPID_FIRING, 0)
    const lowGunnery = analyzeFit(RETRIBUTION_EFT, index, skills, undefined, { previewSkills: preview })
    expect(lowGunnery.stats.weapons!.rawDps).toBeLessThan(atMax.stats.weapons!.rawDps)

    preview.set(WEAPON_UPGRADES, 0)
    const lowWu = analyzeFit(RETRIBUTION_EFT, index, skills, undefined, { previewSkills: preview })
    expect(lowWu.stats.load.cpuUsed).toBeGreaterThan(atMax.stats.load.cpuUsed)
  })

  it('maxout for Firestorm includes gunnery not mining', () => {
    const { ship, items } = resolveFit(parseEft(RETRIBUTION_EFT), index)
    const entries = maxoutSkillsForFit(ship, items)
    const names = entries
      .map((e) => skills.find((s) => s.skillId === e.skillId)?.name ?? '')
      .join(' ')
    expect(names).toMatch(/Motion Prediction|Rapid Firing/i)
    expect(names).not.toMatch(/\bAstrogeology\b/i)
  })
})
