import { describe, expect, it } from 'vitest'
import { buildFittingRecords } from './fitting-records.mjs'

describe('buildFittingRecords', () => {
  it('keeps ships and weapons with cpu/pg and skills', () => {
    const types = [
      { typeID: '11393', typeName: 'Retribution', groupID: '324', published: '1' },
      { typeID: '3033', typeName: 'Small Focused Beam Laser II', groupID: '53', published: '1' },
      { typeID: '1', typeName: 'Skipped skin', groupID: '1', published: '1' },
    ]
    const groups = [
      { groupID: '324', groupName: 'Assault Frigate', categoryID: '6' },
      { groupID: '53', groupName: 'Energy Weapon', categoryID: '7' },
      { groupID: '1', groupName: 'Skin', categoryID: '91' },
    ]
    const categories = [
      { categoryID: '6', categoryName: 'Ship' },
      { categoryID: '7', categoryName: 'Module' },
      { categoryID: '91', categoryName: 'Apparel' },
    ]
    const typeAttributes = [
      { typeID: '11393', attributeID: '11', valueFloat: '62' },
      { typeID: '11393', attributeID: '48', valueFloat: '140' },
      { typeID: '11393', attributeID: '182', valueFloat: '3331' },
      { typeID: '11393', attributeID: '277', valueFloat: '5' },
      { typeID: '3033', attributeID: '30', valueFloat: '13' },
      { typeID: '3033', attributeID: '50', valueFloat: '19' },
      { typeID: '3033', attributeID: '182', valueFloat: '3303' },
      { typeID: '3033', attributeID: '277', valueFloat: '5' },
    ]

    const records = buildFittingRecords(types, groups, categories, typeAttributes, [])
    expect(records.map((row) => row.name)).toEqual(['Small Focused Beam Laser II', 'Retribution'])
    expect(records[1].cpuOutput).toBe(140)
    expect(records[1].powerOutput).toBe(62)
    expect(records[0].cpu).toBe(19)
    expect(records[0].power).toBe(13)
    expect(records[0].weapon).toBe('turret')
    expect(records[0].family).toBe('energy')
  })

  it('tags energy burst aerators as power drawback on energy weapons', () => {
    const types = [
      { typeID: '31448', typeName: 'Small Energy Burst Aerator II', groupID: '775', published: '1' },
    ]
    const groups = [{ groupID: '775', groupName: 'Rig Energy Weapon', categoryID: '7' }]
    const categories = [{ categoryID: '7', categoryName: 'Module' }]
    const typeAttributes = [
      { typeID: '31448', attributeID: '204', valueFloat: '0.85' },
      { typeID: '31448', attributeID: '1138', valueFloat: '10' },
    ]
    const [rig] = buildFittingRecords(types, groups, categories, typeAttributes)
    expect(rig.rigDrawback).toEqual({ family: 'energy', stat: 'power', pct: 10 })
  })
})
