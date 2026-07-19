import { describe, expect, it } from 'vitest'
import { refineryTypeFromTypeId } from '@/lib/refineryTypeFromTypeId'

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
})
