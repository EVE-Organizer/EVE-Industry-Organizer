import { describe, expect, it } from 'vitest'
import {
  isRefineryStructureTypeId,
  REFINERY_TYPE_IDS,
  refineryTypeFromTypeId,
} from '@/lib/refinerySettings'

describe('refineryTypeFromTypeId', () => {
  it('maps stations to none', () => {
    expect(refineryTypeFromTypeId(undefined, 'station')).toBe('none')
  })

  it('maps Athanor and Tatara type IDs', () => {
    expect(refineryTypeFromTypeId(35835, 'structure')).toBe('athanor')
    expect(refineryTypeFromTypeId(35836, 'structure')).toBe('tatara')
  })

  it('maps unknown structures to custom', () => {
    expect(refineryTypeFromTypeId(35826, 'structure')).toBe('custom')
  })

  it('detects refinery hull type ids from the shared table', () => {
    expect(isRefineryStructureTypeId(REFINERY_TYPE_IDS.athanor)).toBe(true)
    expect(isRefineryStructureTypeId(REFINERY_TYPE_IDS.tatara)).toBe(true)
    expect(isRefineryStructureTypeId(undefined)).toBe(false)
  })
})
