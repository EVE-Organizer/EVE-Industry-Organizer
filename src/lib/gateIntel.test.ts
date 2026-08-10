import { describe, expect, it } from 'vitest'
import {
  classifySystemGateIntel,
  emptySystemGateIntel,
  explainGateIntel,
  gateKillBand,
  formatGateIntelFlags,
} from '@/lib/gateIntel'
import { buildGateIntelLookup } from '@/services/data/gateIntelLoader'
import { classifyCampLevel } from '@/lib/routeCamp'

const lookup = buildGateIntelLookup({
  generatedAt: '2026-01-01T00:00:00.000Z',
  smartBombTypeIds: [29774],
  interdictorTypeIds: [22456],
  hicTypeIds: [11978],
  gatesByLocationId: {
    '50001234': { systemId: 30002768, name: 'Uedama IV - Stargate' },
  },
})

describe('classifySystemGateIntel', () => {
  it('counts gate kills only when location matches a stargate in the system', () => {
    const intel = classifySystemGateIntel(
      30002768,
      [
        { locationId: 50001234, attackers: [] },
        { locationId: 99999999, attackers: [] },
      ],
      lookup,
    )
    expect(intel.gateKillCount).toBe(1)
    expect(intel.offGateKillCount).toBe(1)
    expect(intel.hotGates).toEqual([{ name: 'Uedama IV - Stargate', kills: 1 }])
  })

  it('flags smartbombs, dictors, and hictors on gate kills', () => {
    const intel = classifySystemGateIntel(
      30002768,
      [
        {
          locationId: 50001234,
          attackers: [{ weaponTypeId: 29774, shipTypeId: 22456 }],
        },
        {
          locationId: 50001234,
          attackers: [{ shipTypeId: 11978 }],
        },
      ],
      lookup,
    )
    expect(intel.gateKillCount).toBe(2)
    expect(intel.smartbombs).toBe(true)
    expect(intel.dictors).toBe(true)
    expect(intel.hictors).toBe(true)
    expect(formatGateIntelFlags(intel)).toEqual(['Smartbombs', 'HIC', 'Dictor'])
  })

  it('returns empty intel when there are no kills', () => {
    expect(classifySystemGateIntel(30002768, [], lookup)).toEqual(emptySystemGateIntel())
  })
})

describe('gateKillBand', () => {
  it('maps counts to gatecheck-style bands', () => {
    expect(gateKillBand(0)).toBe('none')
    expect(gateKillBand(2)).toBe('low')
    expect(gateKillBand(3)).toBe('high')
  })
})

describe('explainGateIntel', () => {
  it('includes gate names and flags in the tooltip text', () => {
    const text = explainGateIntel({
      gateKillCount: 2,
      offGateKillCount: 0,
      smartbombs: true,
      dictors: false,
      hictors: false,
      hotGates: [{ name: 'Uedama IV - Stargate', kills: 2 }],
    })
    expect(text).toContain('2 gate kills')
    expect(text).toContain('Uedama IV - Stargate')
    expect(text).toContain('Smartbombs')
  })
})

describe('classifyCampLevel with gate intel', () => {
  it('elevates camp level for heavy gate activity and special flags', () => {
    expect(
      classifyCampLevel(30002768, 0.4, 0, 0, {
        gateKillCount: 3,
        offGateKillCount: 0,
        smartbombs: false,
        dictors: false,
        hictors: false,
        hotGates: [],
      }),
    ).toBe('Likely')

    expect(
      classifyCampLevel(30002768, 0.9, 0, 0, {
        gateKillCount: 0,
        offGateKillCount: 0,
        smartbombs: true,
        dictors: false,
        hictors: false,
        hotGates: [],
      }),
    ).toBe('Likely')

    expect(
      classifyCampLevel(30002768, 0.9, 0, 0, {
        gateKillCount: 1,
        offGateKillCount: 0,
        smartbombs: false,
        dictors: false,
        hictors: false,
        hotGates: [],
      }),
    ).toBe('Possible')
  })
})
