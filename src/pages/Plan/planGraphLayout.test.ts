import { describe, expect, it } from 'vitest'
import { planNodeHeight, planNodesToFlow } from '@/pages/Plan/planGraphLayout'
import type { PlanNode } from '@/types'

function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name' | 'depth'>): PlanNode {
  return {
    mode: 'build',
    totalDemandQty: 10,
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
    ...partial,
  }
}

describe('planNodesToFlow', () => {
  it('places roots above materials in a top-to-bottom layout', () => {
    const root = mockNode({
      productTypeId: 1,
      name: 'Ship',
      depth: 0,
      isRoot: true,
      childProductTypeIds: [2],
    })
    const mat = mockNode({
      productTypeId: 2,
      name: 'Trit',
      depth: 1,
      isLeaf: true,
      mode: 'buy',
      parentProductTypeIds: [1],
    })

    const { nodes, edges } = planNodesToFlow([root, mat])
    const rootNode = nodes.find((n) => n.id === '1')
    const matNode = nodes.find((n) => n.id === '2')

    expect(rootNode).toBeDefined()
    expect(matNode).toBeDefined()
    expect(rootNode!.position.y).toBeLessThan(matNode!.position.y)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('1')
    expect(edges[0].target).toBe('2')
  })

  it('uses taller nodes for roots and build items', () => {
    const root = mockNode({ productTypeId: 1, name: 'A', depth: 0, isRoot: true })
    const buy = mockNode({ productTypeId: 2, name: 'B', depth: 1, mode: 'buy', isLeaf: true })
    expect(planNodeHeight(root)).toBeGreaterThan(planNodeHeight(buy))
  })

  it('centers each row within the widest layer', () => {
    const root = mockNode({ productTypeId: 1, name: 'Root', depth: 0, isRoot: true })
    const matA = mockNode({ productTypeId: 2, name: 'Mat A', depth: 1, isLeaf: true, mode: 'buy' })
    const matB = mockNode({ productTypeId: 3, name: 'Mat B', depth: 1, isLeaf: true, mode: 'buy' })

    const { nodes } = planNodesToFlow([root, matA, matB])
    const rootNode = nodes.find((n) => n.id === '1')!
    const matANode = nodes.find((n) => n.id === '2')!
    const matBNode = nodes.find((n) => n.id === '3')!

    const bottomRowCenter =
      (matANode.position.x + matBNode.position.x + (matBNode.width ?? 0)) / 2
    const rootCenter = rootNode.position.x + (rootNode.width ?? 0) / 2
    expect(rootCenter).toBeCloseTo(bottomRowCenter, 0)
    expect(rootNode.position.x).toBeGreaterThan(0)
  })
})
