import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import { buildBuyGroups, buildBuyTableRows } from '@/pages/Plan/planBuyGroups'
import { flattenPlanNodesExpandable, withTreeLineMeta } from '@/pages/Plan/planTreeLines'
import { planNodesToFlow } from '@/pages/Plan/planGraphLayout'
import { schedulePlanJobs } from '@/pages/Plan/planScheduler'
import { buildTypeMap, getAllBlueprints } from '@/services/data/sdeLoader'
import { isManufacturingRecipe } from '@/lib/recipes'
import { createDefaultPlanTemplate } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintRegistry, TypeInfo } from '@/types'

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('expandManufacturingPlan fuzz', () => {
  const registry = loadFixture<BlueprintRegistry>('public/data/blueprints.json')
  const typesRaw = loadFixture<{ types?: TypeInfo[] } | TypeInfo[]>('public/data/types.json')
  const types = Array.isArray(typesRaw) ? typesRaw : typesRaw.types ?? []
  const typeMap = buildTypeMap(types)
  const blueprints = getAllBlueprints(registry)
  const prices = new Map<number, number>()

  it('expands every blueprint without throwing', () => {
    const failures: { productTypeId: number; name: string; error: string }[] = []

    for (const bp of blueprints.filter(isManufacturingRecipe)) {
      const name = typeMap.get(bp.productTypeId)?.name ?? String(bp.productTypeId)
      try {
        const template = createDefaultPlanTemplate('fuzz')
        template.roots = [
          {
            id: `root-${bp.productTypeId}`,
            productTypeId: bp.productTypeId,
            runs: 100,
            productionDurationHours: 24,
          },
        ]

        const { nodes, slots, windowHours: _windowHours } = expandManufacturingPlan({
          template,
          blueprints,
          typeMap,
          prices,
          settings: DEFAULT_SETTINGS,
          systemCostIndex: 0.01,
          reactionCostIndex: 0.01,
        })

        const jobs = schedulePlanJobs({ nodes, slots, windowHours: Number.POSITIVE_INFINITY })
        const nonRootBuild = nodes.filter((n) => n.mode === 'build' && !n.isRoot)
        const subExpandable = flattenPlanNodesExpandable(nonRootBuild, 'build-blueprints')
        const rootNode = nodes.find((n) => n.productTypeId === bp.productTypeId)
        if (!rootNode) throw new Error('missing root node')
        withTreeLineMeta([
          {
            kind: 'leaf' as const,
            node: rootNode,
            depth: 0,
            ancestorCollapseKeys: [],
          },
          ...subExpandable.map((row) => ({ ...row, depth: row.depth + 1 })),
        ])

        const buyNodes = nodes.filter((n) => n.mode === 'buy')
        const groups = buildBuyGroups(nodes, buyNodes)
        buildBuyTableRows(groups, nodes)
        planNodesToFlow(nodes)

        expect(nodes.some((n) => n.isRoot)).toBe(true)
        expect(jobs.length).toBeGreaterThanOrEqual(0)
      } catch (err) {
        failures.push({
          productTypeId: bp.productTypeId,
          name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (failures.length > 0) {
      console.error('Failed blueprints:', failures.slice(0, 20))
    }
    expect(failures).toEqual([])
  }, 60_000)
})
