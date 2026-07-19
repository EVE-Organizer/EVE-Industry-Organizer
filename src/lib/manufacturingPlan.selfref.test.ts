import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { buildBuyGroups, buildBuyTableRows } from '@/lib/planBuyGroups'
import { packagedBuyNodesFromPlan } from '@/lib/planPackagedBuy'
import { buildTypeMap, getAllBlueprints } from '@/services/data/sdeLoader'
import { createDefaultPlanTemplate } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintRegistry, TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('self-referential structure blueprints', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
  const typeMap = buildTypeMap(types)
  const blueprints = getAllBlueprints(registry)

  it('keeps root build mode for Reprocessing Array', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 12238, runs: 100, productionDurationHours: 24 },
    ]

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices: new Map([[12238, 1_000_000]]),
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const root = nodes.find((n) => n.productTypeId === 12238)
    expect(root).toBeDefined()
    expect(root!.isRoot).toBe(true)
    expect(root!.mode).toBe('build')
    expect(root!.parentProductTypeIds).not.toContain(12238)
    expect(root!.packagedBuyQty).toBeGreaterThan(0)

    const packaged = packagedBuyNodesFromPlan(nodes)
    expect(packaged).toHaveLength(1)
    expect(packaged[0].buyCost).toBeGreaterThan(0)

    const buyNodes = nodes.filter((n) => n.mode === 'buy')
    expect(() => {
      const groups = buildBuyGroups(nodes, [...buyNodes, ...packaged])
      buildBuyTableRows(groups, nodes)
    }).not.toThrow()
  })
})
