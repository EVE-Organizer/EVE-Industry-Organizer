import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { buildProductGroupTree, buildTypeMap } from '@/services/data/sdeLoader'
import type { BlueprintRegistry, TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('buildProductGroupTree', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types!
  const typeMap = buildTypeMap(types)

  it('includes formula-only groups even when ranking filter is manufacturing only', () => {
    const pickerTree = buildProductGroupTree(registry.blueprints, ['t1'], typeMap, [
      'manufacturing',
      'reaction',
    ])
    const mfgFilterTree = buildProductGroupTree(registry.blueprints, ['t1'], typeMap, [
      'manufacturing',
    ])

    const pickerNames = new Set(pickerTree.flatMap((n) => n.groups.map((g) => g.name)))
    const mfgNames = new Set(mfgFilterTree.flatMap((n) => n.groups.map((g) => g.name)))

    expect(pickerNames.has('Composite')).toBe(true)
    expect(mfgNames.has('Composite')).toBe(false)

    const composite = pickerTree.flatMap((n) => n.groups).find((g) => g.name === 'Composite')
    expect(composite?.recipeKinds).toEqual(['reaction'])
  })
})
