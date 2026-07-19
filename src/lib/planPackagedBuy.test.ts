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

describe('packagedBuyNodesFromPlan', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
  const typeMap = buildTypeMap(types)
  const blueprints = getAllBlueprints(registry)

  it('creates a buy line for Small Ship Assembly Array packaged input', () => {
    const template = createDefaultPlanTemplate('test')
    template.roots = [
      { id: 'root-1', productTypeId: 24574, runs: 100, productionDurationHours: 24 },
    ]

    const { nodes } = expandManufacturingPlan({
      template,
      blueprints,
      typeMap,
      prices: new Map([[24574, 5_000_000]]),
      settings: DEFAULT_SETTINGS,
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const root = nodes.find((n) => n.productTypeId === 24574)
    expect(root?.packagedBuyQty).toBeGreaterThan(0)

    const packaged = packagedBuyNodesFromPlan(nodes)
    expect(packaged).toHaveLength(1)
    expect(packaged[0].packagedInput).toBe(true)
    expect(packaged[0].totalDemandQty).toBe(root!.packagedBuyQty)
    expect(packaged[0].buyCost).toBeGreaterThan(0)

    const groups = buildBuyGroups(nodes, packaged)
    const rows = buildBuyTableRows(groups, nodes)
    expect(rows.some((r) => r.kind === 'item' && r.node.productTypeId === 24574)).toBe(true)
  })
})
