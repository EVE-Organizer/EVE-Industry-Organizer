import { describe, expect, it } from 'vitest'
import type { BlueprintCostBreakdown } from '@/types'
import { blueprintJitaFallbackNote } from '@/lib/blueprintCostDisplay'

describe('blueprintJitaFallbackNote', () => {
  const base: BlueprintCostBreakdown = {
    mode: 'bpo',
    charged: 0,
    upfront: 1,
    selectedHub: 'amarr',
    sourceHub: 'jita',
    bpoUnitPrice: 1,
  }

  it('returns a note when source is Jita and selected hub is not', () => {
    expect(blueprintJitaFallbackNote(base)).toContain('The Forge (Jita)')
    expect(blueprintJitaFallbackNote(base)).toContain('Domain (Amarr)')
  })

  it('returns null when selected hub is already Jita', () => {
    expect(blueprintJitaFallbackNote({ ...base, selectedHub: 'jita' })).toBeNull()
  })

  it('returns null when source is not Jita', () => {
    expect(blueprintJitaFallbackNote({ ...base, sourceHub: 'amarr' })).toBeNull()
  })
})
