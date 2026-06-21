import { describe, expect, it } from 'vitest'
import { cacheKey } from '@/services/cache/cacheStore'

describe('cacheKey', () => {
  it('does not collide for Jita routes to Perimeter vs Otomainen', () => {
    const perimeter = cacheKey('esi', 'route', {
      originSystemId: 30000142,
      destinationSystemId: 30000144,
    })
    const otomainen = cacheKey('esi', 'route', {
      originSystemId: 30000142,
      destinationSystemId: 30000172,
    })
    expect(perimeter).not.toBe(otomainen)
  })

  it('is stable regardless of param key order', () => {
    const a = cacheKey('esi', 'route', {
      originSystemId: 30000142,
      destinationSystemId: 30000144,
    })
    const b = cacheKey('esi', 'route', {
      destinationSystemId: 30000144,
      originSystemId: 30000142,
    })
    expect(a).toBe(b)
  })
})
