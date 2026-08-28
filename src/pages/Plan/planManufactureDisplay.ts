import {
  flattenPlanNodesExpandable,
  withTreeLineMeta,
  type ExpandablePlanRow,
} from '@/pages/Plan/planTreeLines'
import { bpcCountForRuns, defaultRunsPerBpc, jobTimeSecondsForRuns } from '@/lib/rootRunsDuration'
import { activeConcurrentCopies } from '@/lib/supplyChainSlots'
import type { BlueprintInfo, GlobalSettings, PlanNode, PlanRootEntry } from '@/types'

export type ManufactureDisplayRow = ExpandablePlanRow & {
  rowKey: string
  rootInstance?: number
  rootInstanceTotal?: number
}

export function rootDisplayPlanNode(
  root: PlanRootEntry,
  merged: PlanNode,
  blueprint: BlueprintInfo,
  settings: GlobalSettings,
  slots: number,
  defaultRunsPerBpcTemplate: number,
  runsPerBpcOverride?: number,
  meTeOverride?: { me?: number; te?: number },
): PlanNode {
  const runs = root.runs
  const runsPerBpc =
    runsPerBpcOverride ?? defaultRunsPerBpc(blueprint, defaultRunsPerBpcTemplate)
  const bpcCount = bpcCountForRuns(runs, runsPerBpc)
  const rootRunsTotal = runs
  const concurrent = activeConcurrentCopies(true, bpcCount, slots, rootRunsTotal)
  const jobTimeSeconds = jobTimeSecondsForRuns(
    blueprint,
    settings,
    runs,
    concurrent,
    meTeOverride,
  )
  const outputQty = runs * blueprint.productQuantity

  return {
    ...merged,
    runs,
    bpcCount,
    concurrentCopies: concurrent,
    jobTimeSeconds,
    outputQty,
    totalDemandQty: outputQty,
    isRoot: true,
    depth: 0,
  }
}

/** One row per root entry; shared sub-builds appear once below all roots. */
export function buildManufactureDisplayRows(
  nodes: PlanNode[],
  roots: PlanRootEntry[],
  getBlueprint: (productTypeId: number) => BlueprintInfo | undefined,
  settings: GlobalSettings,
  slots: number,
  defaultRunsPerBpcTemplate: number,
  nodeOverrides: Record<number, { runsPerBpc?: number; me?: number; te?: number }> = {},
): ManufactureDisplayRow[] {
  const buildNodes = nodes.filter((n) => n.mode === 'build')
  const nonRootBuild = buildNodes.filter((n) => !n.isRoot)
  const subExpandable = flattenPlanNodesExpandable(nonRootBuild, 'manufacture')

  const rootCounts = new Map<number, number>()
  for (const root of roots) {
    rootCounts.set(root.productTypeId, (rootCounts.get(root.productTypeId) ?? 0) + 1)
  }
  const rootSeen = new Map<number, number>()

  const rootRows: Array<{
    kind: 'leaf'
    node: PlanNode
    depth: number
    ancestorCollapseKeys: string[]
    rowKey: string
    rootInstance: number
    rootInstanceTotal: number
  }> = []

  for (const root of roots) {
    const merged = buildNodes.find((n) => n.productTypeId === root.productTypeId && n.isRoot)
    const blueprint = getBlueprint(root.productTypeId)
    if (!merged || !blueprint) continue

    const instance = (rootSeen.get(root.productTypeId) ?? 0) + 1
    rootSeen.set(root.productTypeId, instance)
    const instanceTotal = rootCounts.get(root.productTypeId) ?? 1

    rootRows.push({
      kind: 'leaf',
      node: rootDisplayPlanNode(
        root,
        merged,
        blueprint,
        settings,
        slots,
        defaultRunsPerBpcTemplate,
        nodeOverrides[root.productTypeId]?.runsPerBpc,
        nodeOverrides[root.productTypeId],
      ),
      depth: 0,
      ancestorCollapseKeys: [],
      rowKey: root.id,
      rootInstance: instance,
      rootInstanceTotal: instanceTotal,
    })
  }

  const subRows = subExpandable.map((row, index) => ({
    ...row,
    depth: row.depth + 1,
    rowKey:
      row.kind === 'parent'
        ? row.collapseKey
        : `manufacture/sub-${row.node.productTypeId}-${index}`,
  }))

  return withTreeLineMeta([...rootRows, ...subRows]) as ManufactureDisplayRow[]
}
