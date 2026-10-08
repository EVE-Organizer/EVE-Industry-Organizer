import type { PlanNode } from '@/types'

/** Plan node with sane defaults for scheduler and character tests. */
export function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name'>): PlanNode {
  return {
    mode: 'build',
    totalDemandQty: 100,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: 10,
    bpcCount: 1,
    concurrentCopies: 1,
    jobTimeSeconds: 3600,
    outputQty: 10,
    isRoot: false,
    isLeaf: false,
    depth: 1,
    canToggle: false,
    ...partial,
  }
}
