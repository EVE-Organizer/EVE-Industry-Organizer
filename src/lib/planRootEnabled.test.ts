import { describe, expect, it } from 'vitest'
import { activePlanRoots, isPlanRootEnabled, templateWithActiveRoots } from '@/lib/planRootEnabled'
import { createDefaultPlanTemplate } from '@/services/sync/types'
import type { PlanRootEntry } from '@/types'

function root(id: string, enabled?: boolean): PlanRootEntry {
  return { id, productTypeId: 1, runs: 1, productionDurationHours: 1, enabled }
}

describe('planRootEnabled', () => {
  it('treats missing enabled as on', () => {
    expect(isPlanRootEnabled(root('a'))).toBe(true)
    expect(isPlanRootEnabled(root('b', false))).toBe(false)
  })

  it('drops disabled roots from the active list', () => {
    expect(activePlanRoots([root('a'), root('b', false), root('c', true)]).map((r) => r.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('returns the same template when every root is on', () => {
    const template = createDefaultPlanTemplate('t')
    template.roots = [root('a')]
    expect(templateWithActiveRoots(template)).toBe(template)
  })
})
