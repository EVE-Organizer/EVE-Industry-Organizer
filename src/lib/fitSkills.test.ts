import { describe, expect, it } from 'vitest'
import { parseEft } from '@/lib/eftParse'
import {
  analyzeFit,
  buildTypeNameIndex,
  effectiveDrawbackPct,
  parsePastedSkillLevels,
  skillpointsBetween,
  type FittingItemRecord,
} from '@/lib/fitSkills'
import type { SkillInfo, TypeInfo } from '@/types'

function typeInfo(typeId: number, name: string, group: string, category: string): TypeInfo {
  return {
    typeId,
    name,
    group,
    category,
    volume: 1,
    iconUrl: '',
    renderUrl: '',
    bpIconUrl: '',
  }
}

const types: TypeInfo[] = [
  typeInfo(11393, 'Retribution', 'Assault Frigate', 'Ship'),
  typeInfo(3033, 'Small Focused Beam Laser II', 'Energy Weapon', 'Module'),
  typeInfo(2364, 'Heat Sink II', 'Heat Sink', 'Module'),
  typeInfo(31454, 'Small Energy Collision Accelerator I', 'Rig Energy Weapon', 'Module'),
  typeInfo(31460, 'Small Energy Collision Accelerator II', 'Rig Energy Weapon', 'Module'),
]

const fitting = new Map<number, FittingItemRecord>([
  [11393, { slot: 'ship', pgOut: 62, cpuOut: 140, calOut: 400, rigSize: 1, skills: [[3331, 5], [12095, 1]] }],
  [3033, { slot: 'high', pg: 13, cpu: 19, skills: [[3303, 5]] }],
  [2364, { slot: 'low', pg: 1, cpu: 30, skills: [[3318, 4]] }],
  [31454, { slot: 'rig', cal: 200, rigSize: 1, meta: 1, drawback: 10, de: [2706] }],
  [31460, { slot: 'rig', cal: 300, rigSize: 1, meta: 2, drawback: 10, de: [2706] }],
])

const skills: SkillInfo[] = [
  { skillId: 3331, name: 'Amarr Frigate', rank: 2, prerequisites: [], iconUrl: '' },
  { skillId: 12095, name: 'Assault Frigates', rank: 4, prerequisites: [{ skillId: 3331, level: 5 }], iconUrl: '' },
  { skillId: 3303, name: 'Small Energy Turret', rank: 1, prerequisites: [], iconUrl: '' },
  { skillId: 3318, name: 'Weapon Upgrades', rank: 2, prerequisites: [], iconUrl: '' },
  { skillId: 3413, name: 'Power Grid Management', rank: 1, prerequisites: [], iconUrl: '' },
  { skillId: 3426, name: 'CPU Management', rank: 1, prerequisites: [], iconUrl: '' },
  { skillId: 11207, name: 'Advanced Weapon Upgrades', rank: 6, prerequisites: [{ skillId: 3318, level: 4 }], iconUrl: '' },
  { skillId: 26252, name: 'Jury Rigging', rank: 2, prerequisites: [], iconUrl: '' },
  { skillId: 26258, name: 'Energy Weapon Rigging', rank: 3, prerequisites: [{ skillId: 26252, level: 3 }], iconUrl: '' },
]

describe('fitSkills', () => {
  it('parses pasted skill lines', () => {
    const levels = parsePastedSkillLevels('Amarr Frigate V\nSmall Energy Turret: 4', skills)
    expect(levels.get(3331)).toBe(5)
    expect(levels.get(3303)).toBe(4)
  })

  it('uses rank tables for SP gaps', () => {
    expect(skillpointsBetween(1, 0, 5)).toBe(256000)
    expect(skillpointsBetween(2, 4, 5)).toBe((256000 - 45255) * 2)
  })

  it('flags a hull that cannot online and lists skill gaps', () => {
    const parsed = parseEft(`[Retribution, Test]
Heat Sink II
Small Focused Beam Laser II
Small Focused Beam Laser II
Small Focused Beam Laser II
Small Focused Beam Laser II
`)
    const analysis = analyzeFit({
      parsed,
      typesByName: buildTypeNameIndex(types),
      fittingByTypeId: fitting,
      skills,
      characterLevels: new Map(),
      role: 'dps',
      budgetDays: 30,
    })

    expect(analysis.hullTypeId).toBe(11393)
    expect(analysis.fitSkills.some((row) => row.skillId === 3331 && !row.enough)).toBe(true)
    expect(analysis.owned.some((p) => p.name === 'Heat Sink II')).toBe(true)
    expect(analysis.queueFits.length).toBeGreaterThan(0)
    expect(analysis.pg.output).toBeGreaterThan(0)
  })

  it('adds energy weapon rigging for T1 rigs and IV for T2', () => {
    const t1 = analyzeFit({
      parsed: parseEft('[Retribution, Rigs]\nSmall Energy Collision Accelerator I\n'),
      typesByName: buildTypeNameIndex(types),
      fittingByTypeId: fitting,
      skills,
      characterLevels: new Map(),
      role: 'general',
      budgetDays: 30,
    })
    expect(t1.fitSkills.some((row) => row.skillId === 26258 && row.need === 1)).toBe(true)
    expect(t1.owned.find((p) => p.slot === 'rig')?.cal).toBe(200)
    expect(t1.cal.used).toBe(200)
    expect(t1.cal.output).toBe(400)

    const t2 = analyzeFit({
      parsed: parseEft('[Retribution, Rigs]\nSmall Energy Collision Accelerator II\n'),
      typesByName: buildTypeNameIndex(types),
      fittingByTypeId: fitting,
      skills,
      characterLevels: new Map(),
      role: 'general',
      budgetDays: 30,
    })
    expect(t2.fitSkills.some((row) => row.skillId === 26258 && row.need === 4)).toBe(true)
    expect(t2.queueFits.some((item) => item.skillId === 26252 && item.to >= 3)).toBe(true)
  })

  it('applies energy weapon PG drawback and halves it at rigging V', () => {
    expect(effectiveDrawbackPct(10, 0)).toBe(10)
    expect(effectiveDrawbackPct(10, 5)).toBe(5)

    const none = analyzeFit({
      parsed: parseEft(`[Retribution, Rigs]
Small Focused Beam Laser II
Small Energy Collision Accelerator I
`),
      typesByName: buildTypeNameIndex(types),
      fittingByTypeId: fitting,
      skills,
      characterLevels: new Map(),
      role: 'general',
      budgetDays: 7,
    })
    expect(none.rigDrawbacks[0]).toMatchObject({ label: 'Laser PG', nowPct: 10, atVPct: 5, affectsFit: true })
    expect(none.pg.used).toBeCloseTo(13 * 1.1, 5)

    const trained = analyzeFit({
      parsed: parseEft(`[Retribution, Rigs]
Small Focused Beam Laser II
Small Energy Collision Accelerator I
`),
      typesByName: buildTypeNameIndex(types),
      fittingByTypeId: fitting,
      skills,
      characterLevels: new Map([[26258, 5]]),
      role: 'general',
      budgetDays: 7,
    })
    expect(trained.rigDrawbacks[0]?.nowPct).toBe(5)
    expect(trained.pg.used).toBeCloseTo(13 * 1.05, 5)
  })
})
