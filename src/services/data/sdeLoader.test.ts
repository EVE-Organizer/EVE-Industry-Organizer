import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { buildProductGroupTree, buildTypeMap } from '@/services/data/sdeLoader'
import type { BlueprintRegistry, TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('buildProductGroupTree', () => {
  it('nests groups under categories with representative icons', () => {
    const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
    const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
    const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
    const typeMap = buildTypeMap(types)

    const tree = buildProductGroupTree(registry.blueprints, 't1', typeMap)

    expect(tree.length).toBeGreaterThan(0)
    expect(tree.some((node) => node.category === 'Charge')).toBe(true)

    const charge = tree.find((node) => node.category === 'Charge')!
    const rocket = charge.groups.find((g) => g.name === 'Rocket')
    expect(rocket).toBeDefined()
    expect(rocket!.iconTypeId).toBeGreaterThan(0)

    for (const node of tree) {
      expect(node.groups.length).toBeGreaterThan(0)
      for (let i = 1; i < node.groups.length; i++) {
        expect(node.groups[i - 1]!.name.localeCompare(node.groups[i]!.name)).toBeLessThanOrEqual(0)
      }
    }
  })
})
