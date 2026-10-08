import { describe, expect, it } from 'vitest'
import {
  suggestBlueprintLines,
  suggestLinesForStageHours,
  targetHoursForComponent,
} from '@/lib/blueprintLineSuggestion'
import { durationHoursFromRuns } from '@/lib/rootRunsDuration'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo, PlanNode, PlanRootEntry } from '@/types'

const mockBp = (
  partial: Partial<BlueprintInfo> & Pick<BlueprintInfo, 'productTypeId'>,
): BlueprintInfo =>
  ({
    blueprintTypeId: partial.productTypeId + 1000,
    name: partial.name ?? 'Item',
    productQuantity: 1,
    manufacturingTime: partial.manufacturingTime ?? 3600,
    materials: [],
    tier: partial.tier ?? 't1',
    kind: partial.kind ?? 'manufacturing',
    ...partial,
  }) as BlueprintInfo

const mockNode = (partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId'>): PlanNode =>
  ({
    name: partial.name ?? 'Node',
    mode: 'build',
    totalDemandQty: 1,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: partial.runs ?? 100,
    bpcCount: 10,
    concurrentCopies: 1,
    jobTimeSeconds: partial.jobTimeSeconds ?? 3600,
    outputQty: partial.outputQty ?? 100,
    isRoot: false,
    isLeaf: false,
    depth: 1,
    canToggle: true,
    ...partial,
  }) as PlanNode

describe('suggestLinesForStageHours', () => {
  it('suggests 2 when one line is twice the target', () => {
    expect(suggestLinesForStageHours(36, 18, 10)).toBe(2)
  })

  it('stays at 1 when already fast enough', () => {
    expect(suggestLinesForStageHours(4, 18, 10)).toBe(1)
  })

  it('caps at pool slots', () => {
    expect(suggestLinesForStageHours(100, 10, 3)).toBe(3)
  })
})

describe('targetHoursForComponent', () => {
  it('uses the fastest enabled root that needs the component', () => {
    const shipBp = mockBp({ productTypeId: 1, name: 'Ship', manufacturingTime: 18 * 3600 })
    const partBp = mockBp({ productTypeId: 2, name: 'Part', manufacturingTime: 36 * 3600 })
    const roots: PlanRootEntry[] = [
      { id: 'a', productTypeId: 1, runs: 100, productionDurationHours: 18 },
      { id: 'b', productTypeId: 1, runs: 50, productionDurationHours: 18 },
    ]
    const nodes: PlanNode[] = [
      mockNode({
        productTypeId: 1,
        isRoot: true,
        depth: 0,
        childProductTypeIds: [2],
        runs: 200,
      }),
      mockNode({ productTypeId: 2, parentProductTypeIds: [1], childProductTypeIds: [] }),
    ]
    const target = targetHoursForComponent({
      productTypeId: 2,
      roots,
      nodes,
      blueprints: [shipBp, partBp],
      settings: DEFAULT_SETTINGS,
      nodeOverrides: {},
    })
    const fastRootHours = durationHoursFromRuns(shipBp, DEFAULT_SETTINGS, 50, 1)
    expect(target).toBeCloseTo(fastRootHours, 5)
  })
})

describe('suggestBlueprintLines', () => {
  it('suggests more BPOs for slow sub-builds', () => {
    const shipBp = mockBp({ productTypeId: 1, manufacturingTime: 18 * 3600 })
    const armorBp = mockBp({ productTypeId: 2, manufacturingTime: 36 * 3600 })
    const roots: PlanRootEntry[] = [
      { id: 'r1', productTypeId: 1, runs: 100, productionDurationHours: 18 },
    ]
    const nodes: PlanNode[] = [
      mockNode({
        productTypeId: 1,
        isRoot: true,
        depth: 0,
        childProductTypeIds: [2],
        runs: 100,
        jobTimeSeconds: 18 * 3600,
      }),
      mockNode({
        productTypeId: 2,
        runs: 100,
        jobTimeSeconds: 36 * 3600,
        parentProductTypeIds: [1],
      }),
    ]
    const suggestion = suggestBlueprintLines({
      node: nodes[1]!,
      blueprint: armorBp,
      settings: DEFAULT_SETTINGS,
      roots,
      nodes,
      blueprints: [shipBp, armorBp],
      nodeOverrides: {},
      slots: { manufacturing: 10, reactions: 5, research: 4 },
    })
    expect(suggestion?.copies).toBe(2)
  })
})
