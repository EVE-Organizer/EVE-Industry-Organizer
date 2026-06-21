import { describe, expect, it } from 'vitest'
import { computeRouteDanger, routeGateJumps } from '@/lib/routeDanger'
import { normalizeGlobalSettings } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'

describe('routeGateJumps', () => {
  it('returns 0 for empty or single-system routes', () => {
    expect(routeGateJumps([])).toBe(0)
    expect(routeGateJumps([30000142])).toBe(0)
  })

  it('returns 1 for adjacent Jita to Perimeter (inclusive ESI route)', () => {
    expect(routeGateJumps([30000142, 30000144])).toBe(1)
  })

  it('returns length minus 1 for longer inclusive routes', () => {
    const route = [30000142, 30000145, 30000156, 30000172]
    expect(route.length).toBe(4)
    expect(routeGateJumps(route)).toBe(3)
  })
})

describe('computeRouteDanger', () => {
  it('includes gateJumps on the result', () => {
    const result = computeRouteDanger(
      [30000142, 30000144],
      new Map([
        [30000142, 'Jita'],
        [30000144, 'Perimeter'],
      ]),
      new Map([
        [30000142, 0.95],
        [30000144, 0.95],
      ]),
      new Map(),
    )
    expect(result.gateJumps).toBe(1)
    expect(result.jumps).toHaveLength(2)
  })
})

describe('normalizeGlobalSettings', () => {
  it('migrates legacy region buildSystemId to hub build system', () => {
    const settings = normalizeGlobalSettings({
      primaryHub: 'jita',
      buildSystemId: 30000172,
      manufacturingRegionId: 10000002,
      manufacturingSystemId: 30000172,
    })
    expect(settings.manufacturingSystemId).toBe(30000144)
  })

  it('defaults manufacturingSystemId to hub build when missing', () => {
    const settings = normalizeGlobalSettings({
      primaryHub: 'jita',
      buildSystemId: 30000172,
    })
    expect(settings.manufacturingSystemId).toBe(30000144)
  })

  it('keeps explicit manufacturingSystemId when no legacy region fields', () => {
    const settings = normalizeGlobalSettings({
      primaryHub: 'jita',
      manufacturingSystemId: 30000172,
    })
    expect(settings.manufacturingSystemId).toBe(30000172)
  })

  it('strips legacy buildSystemId from normalized output', () => {
    const settings = normalizeGlobalSettings({
      primaryHub: 'jita',
      buildSystemId: 30000172,
    }) as Record<string, unknown>
    expect(settings.buildSystemId).toBeUndefined()
    expect(settings.manufacturingRegionId).toBeUndefined()
    expect(settings.manufacturingSystemId).toBe(DEFAULT_SETTINGS.manufacturingSystemId)
  })
})
