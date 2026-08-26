import { describe, expect, it } from 'vitest'
import {
  hullManufacturingRigSections,
  manufacturingFamiliesFromRigName,
  manufacturingRigFamilyForProduct,
} from '@/lib/manufacturingRigFamilies'

describe('manufacturingRigFamilyForProduct', () => {
  it('maps ammo, modules, and T1 frigates to wiki families', () => {
    expect(
      manufacturingRigFamilyForProduct({ productGroup: 'Projectile Ammo', category: 'Charge' }),
    ).toBe('ammo')
    expect(
      manufacturingRigFamilyForProduct({ productGroup: 'Armor Plate', category: 'Module' }),
    ).toBe('equipment')
    expect(
      manufacturingRigFamilyForProduct({ productGroup: 'Veldspar' }),
    ).toBeNull()
    expect(
      manufacturingRigFamilyForProduct({ productGroup: 'Assault Frigate', category: 'Ship' }),
    ).toBe('ships_t2_small')
  })
})

describe('hullManufacturingRigSections', () => {
  it('uses M-Set split ME/TE on Raitaru and L-Set combined Efficiency on Azbel', () => {
    const raitaru = hullManufacturingRigSections('raitaru').flatMap((s) => s.rows)
    const azbel = hullManufacturingRigSections('azbel').flatMap((s) => s.rows)
    expect(raitaru).toHaveLength(13)
    expect(raitaru.every((row) => !row.combinedMeTe)).toBe(true)
    expect(azbel).toHaveLength(13)
    expect(azbel.every((row) => row.combinedMeTe)).toBe(true)
  })

  it('uses three XL-Set bundles on Sotiyo', () => {
    const rows = hullManufacturingRigSections('sotiyo').flatMap((s) => s.rows)
    expect(rows.map((row) => row.id)).toEqual(['xl_consumable', 'xl_ships', 'xl_structures'])
    expect(rows[0].families).toEqual(['ammo', 'drones', 'equipment'])
    expect(rows[1].families).toContain('ships_capital')
    expect(rows[2].families).toEqual(['components_t2', 'components_capital', 'structures'])
    expect(rows.every((row) => row.combinedMeTe)).toBe(true)
  })
})

describe('manufacturingFamiliesFromRigName', () => {
  it('keeps ammunition rigs off ships', () => {
    expect(
      manufacturingFamiliesFromRigName(
        'Standup M-Set Ammunition Manufacturing Time Efficiency II',
      ),
    ).toEqual(['ammo'])
  })

  it('expands XL equipment and consumable to ammo, drones, and equipment', () => {
    expect(
      manufacturingFamiliesFromRigName(
        'Standup XL-Set Equipment and Consumable Manufacturing Efficiency II',
      ),
    ).toEqual(['ammo', 'drones', 'equipment'])
  })
})
