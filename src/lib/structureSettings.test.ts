import { describe, expect, it } from 'vitest'
import { buildManufacturingSettings, securityForSystem } from '@/lib/structureSettings'
import { DEFAULT_SETTINGS } from '@/types'

describe('structureSettings manufacturing scope', () => {
  const systems = [
    { systemId: 30000144, security: 1, name: 'Perimeter', regionId: 10000002 },
    { systemId: 30002780, security: -0.5, name: 'Null example', regionId: 10000001 },
  ]

  it('looks up security for a build system', () => {
    expect(securityForSystem(systems, 30002780, 1)).toBe(-0.5)
    expect(securityForSystem(systems, 999999, 1)).toBe(1)
  })

  it('scopes ranking settings to query mfg system security', () => {
    const scoped = buildManufacturingSettings(DEFAULT_SETTINGS, systems, {
      manufacturingSystemId: 30002780,
      batchSize: 100,
    })
    expect(scoped.manufacturingSystemId).toBe(30002780)
    expect(scoped.buildSystemSecurity).toBe(-0.5)
    expect(scoped.batchSize).toBe(100)
  })
})
