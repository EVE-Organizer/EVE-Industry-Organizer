import { describe, expect, it } from 'vitest'
import { buyHaulQuantity, nodeHaulInVolumeM3, nodeHaulOutVolumeM3, volumeM3 } from '@/pages/Plan/planHaulVolume'
import type { PlanNode } from '@/types'

function planNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId'>): PlanNode {
  return {
    name: 'Item',
    mode: 'buy',
    totalDemandQty: 10,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: 0,
    bpcCount: 0,
    concurrentCopies: 0,
    jobTimeSeconds: 0,
    outputQty: 0,
    isRoot: false,
    isLeaf: true,
    depth: 0,
    canToggle: false,
    ...partial,
  }
}

describe('planHaulVolume', () => {
  const typeVolumes = new Map<number, number>([
    [34, 0.01],
    [100, 5],
  ])

  it('computes haul-in volume from demand when inventory is off', () => {
    const node = planNode({ productTypeId: 100, totalDemandQty: 20 })
    expect(buyHaulQuantity(node, 5, false)).toBe(20)
    expect(nodeHaulInVolumeM3(node, 5, false, typeVolumes)).toBe(100)
  })

  it('computes haul-in volume from to-buy when inventory is on', () => {
    const node = planNode({ productTypeId: 100, totalDemandQty: 20 })
    expect(buyHaulQuantity(node, 5, true)).toBe(15)
    expect(nodeHaulInVolumeM3(node, 5, true, typeVolumes)).toBe(75)
  })

  it('computes haul-out volume from output qty', () => {
    const node = planNode({ productTypeId: 100, outputQty: 3, isRoot: true })
    expect(nodeHaulOutVolumeM3(node, typeVolumes)).toBe(15)
    expect(volumeM3(34, 1000, typeVolumes)).toBe(10)
  })
})
