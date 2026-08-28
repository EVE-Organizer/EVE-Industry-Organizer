import { describe, expect, it } from 'vitest'
import { planBuildVsBuyFootnote } from '@/pages/Plan/planBuildVsBuy'
import type { PlanNode } from '@/types'

function mockNode(overrides: Partial<PlanNode>): PlanNode {
  return {
    productTypeId: 1,
    name: 'Test',
    depth: 1,
    mode: 'build',
    runs: 1,
    bpcCount: 1,
    outputQty: 1,
    totalDemandQty: 1,
    jobTimeSeconds: 0,
    isRoot: false,
    isLeaf: false,
    canToggle: true,
    parentProductTypeIds: [0],
    demandByParent: [],
    ...overrides,
  }
}

describe('planBuildVsBuyFootnote', () => {
  it('returns null for roots and non-toggleable nodes', () => {
    expect(planBuildVsBuyFootnote(mockNode({ isRoot: true, savings: 1_000_000 }))).toBeNull()
    expect(planBuildVsBuyFootnote(mockNode({ canToggle: false, savings: 1_000_000 }))).toBeNull()
    expect(planBuildVsBuyFootnote(mockNode({ savings: undefined }))).toBeNull()
    expect(planBuildVsBuyFootnote(mockNode({ savings: 0 }))).toBeNull()
  })

  it('shows savings vs buy when building and build is cheaper', () => {
    const footnote = planBuildVsBuyFootnote(
      mockNode({ mode: 'build', savings: 1_770_000 }),
    )
    expect(footnote).toEqual({ text: 'save 1.77M ISK vs buy', accent: 'text-success' })
  })

  it('shows extra cost vs buy when building but buy is cheaper', () => {
    const footnote = planBuildVsBuyFootnote(
      mockNode({ mode: 'build', savings: -500_000 }),
    )
    expect(footnote).toEqual({ text: '+500.0K ISK vs buy', accent: 'text-error' })
  })

  it('shows savings vs build when buying and buy is cheaper', () => {
    const footnote = planBuildVsBuyFootnote(
      mockNode({ mode: 'buy', savings: -1_770_000 }),
    )
    expect(footnote).toEqual({ text: 'save 1.77M ISK vs build', accent: 'text-success' })
  })

  it('shows extra cost vs build when buying but build would be cheaper', () => {
    const footnote = planBuildVsBuyFootnote(
      mockNode({ mode: 'buy', savings: 500_000 }),
    )
    expect(footnote).toEqual({ text: '+500.0K ISK vs build', accent: 'text-error' })
  })
})
