import { describe, expect, it } from 'vitest'
import {
  countNotableJumps,
  filterNotableJumps,
  isNotableHaulJump,
  parseRouteLabel,
  worseDangerBand,
} from '@/lib/haulRiskDisplay'
import { computeRouteDanger } from '@/lib/routeDanger'

describe('haulRiskDisplay', () => {
  const route = computeRouteDanger(
    [30000142, 30002768, 30000144],
    new Map([
      [30000142, 'Jita'],
      [30002768, 'Uedama'],
      [30000144, 'Perimeter'],
    ]),
    new Map([
      [30000142, 0.9],
      [30002768, 0.4],
      [30000144, 0.9],
    ]),
    new Map([
      [30000142, { systemId: 30000142, shipKills: 0, podKills: 0 }],
      [30002768, { systemId: 30002768, shipKills: 12, podKills: 1 }],
      [30000144, { systemId: 30000144, shipKills: 0, podKills: 0 }],
    ]),
  )

  it('flags lowsec and high-kill systems as notable', () => {
    expect(isNotableHaulJump(route.jumps[1]!)).toBe(true)
    expect(isNotableHaulJump(route.jumps[0]!)).toBe(false)
  })

  it('filters to notable jumps only', () => {
    expect(filterNotableJumps(route.jumps)).toHaveLength(1)
    expect(countNotableJumps(route.jumps)).toBe(1)
  })

  it('parses route labels for gate check links', () => {
    expect(parseRouteLabel('Jita → Perimeter')).toEqual({ from: 'Jita', to: 'Perimeter' })
  })

  it('picks the worse danger band', () => {
    expect(worseDangerBand('Low', 'High')).toBe('High')
  })
})
