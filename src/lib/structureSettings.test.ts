import { describe, expect, it } from 'vitest'
import {
  buildBlueprintRankingSettings,
  buildManufacturingSettings,
  effectiveManufacturingSystemId,
  patchManufacturingSystemIfStale,
  patchScienceFacilityFromLocation,
  securityForSystem,
} from '@/lib/structureSettings'
import { DEFAULT_SETTINGS, defaultScienceFacility } from '@/types'

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

  it('patches security when build system id matches but security is stale highsec default', () => {
    const patch = patchManufacturingSystemIfStale(systems, 30002780, {
      manufacturingSystemId: 30002780,
      buildSystemSecurity: 1,
    })
    expect(patch).toEqual({
      manufacturingSystemId: 30002780,
      buildSystemSecurity: -0.5,
    })
  })

  it('skips patch when id and security already match SDE', () => {
    expect(
      patchManufacturingSystemIfStale(systems, 30002780, {
        manufacturingSystemId: 30002780,
        buildSystemSecurity: -0.5,
      }),
    ).toBeNull()
  })

  it('waits for SDE before patching security', () => {
    expect(
      patchManufacturingSystemIfStale(undefined, 30002780, {
        manufacturingSystemId: 30002780,
        buildSystemSecurity: 1,
      }),
    ).toBeNull()
  })

  it('prefers saved production location system over URL query override', () => {
    expect(
      effectiveManufacturingSystemId(
        { manufacturingSystemId: 30002780, productionLocationId: 'loc-1' },
        30000144,
      ),
    ).toBe(30002780)
    expect(
      effectiveManufacturingSystemId(
        { manufacturingSystemId: 30002780, productionLocationId: null },
        30000144,
      ),
    ).toBe(30000144)
  })

  it('scopes blueprint ranking to location system security', () => {
    const scoped = buildBlueprintRankingSettings(
      {
        ...DEFAULT_SETTINGS,
        productionLocationId: 'loc-1',
        manufacturingSystemId: 30002780,
        buildSystemSecurity: 1,
      },
      systems,
      { mfgSystem: 30000144, rankingTimeHours: 720, priceMethod: 'sell_orders' },
    )
    expect(scoped.manufacturingSystemId).toBe(30002780)
    expect(scoped.buildSystemSecurity).toBe(-0.5)
    expect(scoped.rankingTargetTimeSeconds).toBe(720 * 3600)
  })
})

describe('patchScienceFacilityFromLocation', () => {
  const systems = [{ systemId: 30000144, security: 1, name: 'Perimeter', regionId: 10000002 }]

  it('skips sync when the location system is not known yet', () => {
    expect(
      patchScienceFacilityFromLocation(
        'copyFacility',
        defaultScienceFacility(30000144),
        'sotiyo',
        0,
        systems,
        30000144,
      ),
    ).toBeNull()
  })

  it('returns null when facility already matches the location', () => {
    const facility = {
      ...defaultScienceFacility(30000144),
      structureType: 'sotiyo' as const,
      systemId: 30000144,
      systemSecurity: 1,
    }
    expect(
      patchScienceFacilityFromLocation(
        'copyFacility',
        facility,
        'sotiyo',
        30000144,
        systems,
        30000144,
      ),
    ).toBeNull()
  })

  it('patches structure and system when the saved location differs', () => {
    const patch = patchScienceFacilityFromLocation(
      'inventionFacility',
      { ...defaultScienceFacility(30000144), structureType: 'npc' },
      'azbel',
      30000144,
      systems,
      30000144,
    )
    expect(patch?.inventionFacility?.structureType).toBe('azbel')
    expect(patch?.inventionFacility?.systemId).toBe(30000144)
  })
})
