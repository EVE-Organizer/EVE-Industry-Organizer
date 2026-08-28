import { describe, expect, it } from 'vitest'
import { duplicatePlanRootAfter, movePlanRootById } from '@/lib/planRootOrder'
import type { PlanRootEntry } from '@/types'

function root(id: string, productTypeId = 1): PlanRootEntry {
  return { id, productTypeId, runs: 1, productionDurationHours: 1 }
}

describe('moveItemById', () => {
  it('moves a root to the drop target index', () => {
    const roots = [root('a'), root('b'), root('c')]
    expect(movePlanRootById(roots, 'a', 'c').map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('returns the same array when ids are missing or equal', () => {
    const roots = [root('a'), root('b')]
    expect(movePlanRootById(roots, 'a', 'a')).toBe(roots)
    expect(movePlanRootById(roots, 'z', 'a')).toBe(roots)
  })
})

describe('duplicatePlanRootAfter', () => {
  it('inserts a copy with a new id after the source', () => {
    const roots = [root('a', 10), root('b', 20)]
    const next = duplicatePlanRootAfter(roots, 'a', 'a-copy')
    expect(next.map((r) => r.id)).toEqual(['a', 'a-copy', 'b'])
    expect(next[1]).toEqual({ ...roots[0], id: 'a-copy' })
  })
})
