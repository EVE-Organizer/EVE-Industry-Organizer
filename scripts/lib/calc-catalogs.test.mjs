import { describe, expect, it } from 'vitest'
import {
  buildCalcTypeRecords,
  buildSkillRecords,
  buildUpwellCatalog,
  collectRecipeTypeIds,
  isExcludedCatalogText,
  percentFromMultiplier,
} from './calc-catalogs.mjs'

function attr(typeID, attributeID, value) {
  return { typeID: String(typeID), attributeID: String(attributeID), valueFloat: String(value) }
}

describe('calc catalog filters', () => {
  it('drops event / SKIN / apparel / legacy text', () => {
    expect(isExcludedCatalogText('Festival Launcher', 'Production')).toBe(true)
    expect(isExcludedCatalogText('Rifter', "Women's 'Hephaestus' SKIN")).toBe(true)
    expect(isExcludedCatalogText('T-shirt', 'Apparel')).toBe(true)
    expect(isExcludedCatalogText('Legacy Module', 'Energy Weapon')).toBe(true)
    expect(isExcludedCatalogText('Tritanium', 'Mineral')).toBe(false)
  })

  it('keeps only blueprint materials and products', () => {
    const types = [
      { typeID: '34', typeName: 'Tritanium', groupID: '18', published: '1', volume: '0.01' },
      { typeID: '587', typeName: 'Rifter', groupID: '25', published: '1', volume: '2700' },
      { typeID: '1', typeName: 'Festival Launcher', groupID: '18', published: '1', volume: '1' },
      { typeID: '999', typeName: 'Unused Junk', groupID: '18', published: '1', volume: '1' },
    ]
    const groups = [{ groupID: '18', groupName: 'Mineral', categoryID: '4' }]
    const categories = [{ categoryID: '4', categoryName: 'Material' }]
    const groupById = new Map(groups.map((g) => [g.groupID, g]))
    const categoryById = new Map(categories.map((c) => [c.categoryID, c.categoryName]))
    const blueprints = [
      {
        productTypeId: 587,
        blueprintTypeId: 1234,
        materials: [
          { typeId: 34, quantity: 1 },
          { typeId: 1, quantity: 1 },
        ],
      },
    ]
    const { ids } = collectRecipeTypeIds([
      ...blueprints,
      {
        productTypeId: 191,
        blueprintTypeId: 1911,
        materials: [{ typeId: 189, quantity: 1 }],
        invention: { t1BlueprintTypeId: 890, datacores: [{ typeId: 20423, quantity: 3 }] },
      },
    ])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 34, 189, 191, 587, 890, 1234, 1911, 20423])
    const records = buildCalcTypeRecords(types, groupById, categoryById, blueprints)
    expect(records.map((row) => row.name).sort()).toEqual([
      'Festival Launcher',
      'Rifter',
      'Tritanium',
    ])
  })

  it('keeps Limited and unpublished recipe names for plan buy lines', () => {
    const types = [
      {
        typeID: '23148',
        typeName: 'Blood Raider Limited Ballistic Control',
        groupID: '528',
        published: '1',
        volume: '1',
      },
      {
        typeID: '27029',
        typeName: 'Chalcopyrite',
        groupID: '18',
        published: '0',
        volume: '0.01',
      },
    ]
    const groups = [
      { groupID: '528', groupName: 'Construction Components', categoryID: '17' },
      { groupID: '18', groupName: 'Mineral', categoryID: '4' },
    ]
    const categories = [
      { categoryID: '17', categoryName: 'Commodity' },
      { categoryID: '4', categoryName: 'Material' },
    ]
    const groupById = new Map(groups.map((g) => [g.groupID, g]))
    const categoryById = new Map(categories.map((c) => [c.categoryID, c.categoryName]))
    const records = buildCalcTypeRecords(types, groupById, categoryById, [
      {
        productTypeId: 1,
        blueprintTypeId: 2,
        materials: [
          { typeId: 23148, quantity: 1 },
          { typeId: 27029, quantity: 10 },
        ],
      },
    ])
    expect(records.map((row) => row.name).sort()).toEqual([
      'Blood Raider Limited Ballistic Control',
      'Chalcopyrite',
    ])
  })

  it('keeps invention datacore names used as plan buy lines', () => {
    const types = [
      { typeID: '191', typeName: 'Harpy', groupID: '25', published: '1', volume: '2700' },
      {
        typeID: '20423',
        typeName: 'Datacore - Amarrian Starship Engineering',
        groupID: '333',
        published: '1',
        volume: '0.01',
      },
    ]
    const groups = [
      { groupID: '25', groupName: 'Assault Frigate', categoryID: '6' },
      { groupID: '333', groupName: 'Datacores', categoryID: '17' },
    ]
    const categories = [
      { categoryID: '6', categoryName: 'Ship' },
      { categoryID: '17', categoryName: 'Commodity' },
    ]
    const groupById = new Map(groups.map((g) => [g.groupID, g]))
    const categoryById = new Map(categories.map((c) => [c.categoryID, c.categoryName]))
    const records = buildCalcTypeRecords(types, groupById, categoryById, [
      {
        productTypeId: 191,
        blueprintTypeId: 1911,
        materials: [],
        invention: { datacores: [{ typeId: 20423, quantity: 3 }] },
      },
    ])
    expect(records.map((row) => row.name).sort()).toEqual([
      'Datacore - Amarrian Starship Engineering',
      'Harpy',
    ])
  })
})

describe('hull percent mapping', () => {
  it('maps dogma multipliers to Raitaru / Azbel / Sotiyo / Tatara tables', () => {
    expect(percentFromMultiplier(0.99)).toBe(1)
    expect(percentFromMultiplier(0.85)).toBe(15)
    expect(percentFromMultiplier(0.97)).toBe(3)
    expect(percentFromMultiplier(0.98)).toBe(2)
    expect(percentFromMultiplier(0.8)).toBe(20)
    expect(percentFromMultiplier(0.96)).toBe(4)
    expect(percentFromMultiplier(0.75)).toBe(25)
    expect(percentFromMultiplier(1)).toBe(0)
  })

  it('builds hull role bonuses matching today Raitaru 1/15/3 Azbel 2/20/4 Sotiyo 3/25/5 Tatara 25 TE', () => {
    const types = [
      { typeID: '35825', typeName: 'Raitaru', groupID: '1404', published: '1' },
      { typeID: '35826', typeName: 'Azbel', groupID: '1404', published: '1' },
      { typeID: '35827', typeName: 'Sotiyo', groupID: '1404', published: '1' },
      { typeID: '35836', typeName: 'Tatara', groupID: '1406', published: '1' },
      { typeID: '1', typeName: 'Skipped', groupID: '1404', published: '0' },
    ]
    const groups = [
      { groupID: '1404', groupName: 'Engineering Complex', categoryID: '65' },
      { groupID: '1406', groupName: 'Refinery', categoryID: '65' },
    ]
    const typeAttributes = [
      attr(35825, 1547, 2),
      attr(35825, 2600, 0.99),
      attr(35825, 2602, 0.85),
      attr(35825, 2601, 0.97),
      attr(35826, 1547, 3),
      attr(35826, 2600, 0.98),
      attr(35826, 2602, 0.8),
      attr(35826, 2601, 0.96),
      attr(35827, 1547, 4),
      attr(35827, 2600, 0.97),
      attr(35827, 2602, 0.75),
      attr(35827, 2601, 0.95),
      attr(35836, 1547, 3),
      attr(35836, 2721, 0.75),
    ]
    const { hulls } = buildUpwellCatalog(types, groups, typeAttributes)
    const byName = Object.fromEntries(hulls.map((h) => [h.name, h]))
    expect(byName.Raitaru.roleBonuses).toEqual({ me: 1, te: 15, jobCost: 3 })
    expect(byName.Azbel.roleBonuses).toEqual({ me: 2, te: 20, jobCost: 4 })
    expect(byName.Sotiyo.roleBonuses).toEqual({ me: 3, te: 25, jobCost: 5 })
    expect(byName.Tatara.roleBonuses).toEqual({ me: 0, te: 25, jobCost: 0 })
    expect(byName.Raitaru).toMatchObject({ kind: 'engineering', size: 'm' })
    expect(byName.Azbel.size).toBe('l')
    expect(byName.Sotiyo.size).toBe('xl')
    expect(byName.Tatara.kind).toBe('refinery')
  })

  it('maps T1/T2 standup manufacturing rig percents', () => {
    const types = [
      {
        typeID: '37158',
        typeName: 'Standup M-Set Ammunition Manufacturing Material Efficiency I',
        groupID: '1820',
        published: '1',
      },
      {
        typeID: '37151',
        typeName: 'Standup M-Set Ammunition Manufacturing Time Efficiency II',
        groupID: '1821',
        published: '1',
      },
    ]
    const groups = [
      {
        groupID: '1820',
        groupName: 'Structure Engineering Rig M - Ammunition ME',
        categoryID: '66',
      },
      {
        groupID: '1821',
        groupName: 'Structure Engineering Rig M - Ammunition TE',
        categoryID: '66',
      },
    ]
    const typeAttributes = [
      attr(37158, 1547, 2),
      attr(37158, 422, 1),
      attr(37158, 2594, -2),
      attr(37151, 1547, 2),
      attr(37151, 422, 2),
      attr(37151, 2593, -24),
    ]
    const { rigs } = buildUpwellCatalog(types, groups, typeAttributes)
    const byId = Object.fromEntries(rigs.map((r) => [r.typeId, r]))
    expect(byId[37158]).toMatchObject({
      typeId: 37158,
      size: 'm',
      tier: 't1',
      activity: 'manufacturing',
      families: ['ammo'],
      me: 2,
      te: 0,
    })
    expect(byId[37151]).toMatchObject({ tier: 't2', te: 24, me: 0, families: ['ammo'] })
  })

  it('maps Composite M-Set to composite only and L-Set Reactor Efficiency to all families', () => {
    const types = [
      {
        typeID: '46486',
        typeName: 'Standup M-Set Composite Reactor Material Efficiency I',
        groupID: '1830',
        published: '1',
      },
      {
        typeID: '46494',
        typeName: 'Standup M-Set Biochemical Reactor Material Efficiency I',
        groupID: '1831',
        published: '1',
      },
      {
        typeID: '46496',
        typeName: 'Standup L-Set Reactor Efficiency I',
        groupID: '1832',
        published: '1',
      },
    ]
    const groups = [
      { groupID: '1830', groupName: 'Structure Resource Processing Rig M', categoryID: '66' },
      { groupID: '1831', groupName: 'Structure Resource Processing Rig M', categoryID: '66' },
      { groupID: '1832', groupName: 'Structure Resource Processing Rig L', categoryID: '66' },
    ]
    const typeAttributes = [
      attr(46486, 1547, 2),
      attr(46486, 422, 1),
      attr(46486, 2714, -2),
      attr(46494, 1547, 2),
      attr(46494, 422, 1),
      attr(46494, 2714, -2),
      attr(46496, 1547, 3),
      attr(46496, 422, 1),
      attr(46496, 2714, -2),
      attr(46496, 2713, -20),
    ]
    const { rigs } = buildUpwellCatalog(types, groups, typeAttributes)
    const byId = Object.fromEntries(rigs.map((r) => [r.typeId, r]))
    expect(byId[46486].families).toEqual(['composite'])
    expect(byId[46494].families).toEqual(['biochemical'])
    expect(byId[46496].families).toEqual(['composite', 'biochemical', 'hybrid'])
  })
})

describe('skill calc fields', () => {
  it('keeps SKILL_FIELDS and BPO required skills, drops unused event skills', () => {
    const types = [
      { typeID: '3380', typeName: 'Industry', groupID: '268', published: '1' },
      {
        typeID: '3395',
        typeName: 'Advanced Small Ship Construction',
        groupID: '268',
        published: '1',
      },
      { typeID: '3452', typeName: 'Acceleration Control', groupID: '268', published: '1' },
      { typeID: '1', typeName: 'Festival Industry', groupID: '268', published: '1' },
    ]
    const groups = [{ groupID: '268', groupName: 'Production', categoryID: '16' }]
    const typeAttributes = [
      attr(3380, 275, 1),
      attr(3380, 180, 166),
      attr(3380, 181, 165),
      attr(3380, 440, -4),
      attr(3395, 275, 2),
      attr(3395, 180, 165),
      attr(3395, 181, 166),
      attr(3395, 1982, -1),
      attr(3452, 275, 4),
      attr(1, 275, 1),
    ]
    const skills = buildSkillRecords(types, groups, typeAttributes, {
      activitySkills: [{ activityID: '1', skillID: '3395' }],
    })
    expect(skills.map((s) => s.name).sort()).toEqual([
      'Advanced Small Ship Construction',
      'Industry',
    ])
    expect(skills.find((s) => s.skillId === 3380).manufacturingTimeBonusPerLevel).toBe(0.04)
    expect(skills.find((s) => s.skillId === 3395).manufacturingTimeBonusPerLevel).toBe(0.01)
  })
})
