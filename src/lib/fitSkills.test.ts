import { describe, expect, it } from 'vitest'
import { parseEft } from '@/lib/eftParse'
import {
  analyzeFit,
  buildTypeNameIndex,
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
]

const fitting = new Map<number, FittingItemRecord>([
  [11393, { slot: 'ship', pgOut: 62, cpuOut: 140, skills: [[3331, 5], [12095, 1]] }],
  [3033, { slot: 'high', pg: 13, cpu: 19, skills: [[3303, 5]] }],
  [2364, { slot: 'low', pg: 1, cpu: 30, skills: [[3318, 4]] }],
])

const skills: SkillInfo[] = [
  { skillId: 3331, name: 'Amarr Frigate', rank: 2, prerequisites: [], iconUrl: '' },
  { skillId: 12095, name: 'Assault Frigates', rank: 4, prerequisites: [{ skillId: 3331, level: 5 }], iconUrl: '' },
  { skillId: 3303, name: 'Small Energy Turret', rank: 1, prerequisites: [], iconUrl: '' },
  { skillId: 3318, name: 'Weapon Upgrades', rank: 2, prerequisites: [], iconUrl: '' },
  { skillId: 3413, name: 'Power Grid Management', rank: 1, prerequisites: [], iconUrl: '' },
  { skillId: 3426, name: 'CPU Management', rank: 1, prerequisites: [], iconUrl: '' },
  { skillId: 11207, name: 'Advanced Weapon Upgrades', rank: 6, prerequisites: [{ skillId: 3318, level: 4 }], iconUrl: '' },
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
})
