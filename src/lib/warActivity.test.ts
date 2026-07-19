import { describe, expect, it } from 'vitest'
import type { ZkillKillRef } from '@/services/market/zkillService'
import type { MapGraph, WarActivityResult } from '@/types/map'
import {
  attachTheatersToWars,
  clusterWarTheaters,
  formatTheaterLastActivity,
  killUrlsForClipboard,
  latestKillTimeMs,
  mergeKillRefs,
  pickWarCandidates,
  scoreWarActivity,
  trimWarKillRefs,
  warIntelGapSeconds,
  topCorpsFromKills,
  zkillKillUrl,
  zkillRelatedUrl,
} from '@/lib/warActivity'

function warRef(value: number, solo = false): ZkillKillRef {
  return {
    killmail_id: value,
    zkb: { hash: `hash-${value}`, solo, totalValue: value },
  }
}

function makeWar(
  systemId: number,
  systemName: string,
  overrides: Partial<WarActivityResult> = {},
): WarActivityResult {
  const kills = [
    {
      killmailId: systemId * 10,
      hash: `h-${systemId}`,
      totalValue: 200_000_000,
      zkillUrl: zkillKillUrl(systemId * 10),
      systemId,
      systemName,
      shipTypeId: 587,
      shipName: 'Rifter',
      killmailTime: '2026-07-19T12:30:00Z',
      attackerCount: 8,
      victimCorpId: null,
    },
  ]
  return {
    systemId,
    systemName,
    security: -0.5,
    isWar: true,
    fleetKills: 3,
    iskDestroyed: 600_000_000,
    haulerShare: 0.1,
    soloShare: 0.1,
    reason: 'Fleet fight scored',
    shipKills24h: 12,
    qualifyingKillValues: [200_000_000, 200_000_000, 200_000_000],
    killmailIds: [1, 2, 3],
    kills,
    zkillUrl: `https://zkillboard.com/system/${systemId}/`,
    nearestHubId: 'jita',
    nearestHubSystemId: 30000142,
    nearestHubJumps: 5,
    theaterId: null,
    theaterSystemIds: [],
    theaterSystemNames: [],
    ...overrides,
  }
}

/** Tiny graph: 1—2—3—4 (linear). */
function linearGraph(): MapGraph {
  const systems = new Map([
    [1, { systemId: 1, name: 'A', regionId: 1, constellationId: 1, security: -0.5, x: 0, z: 0 }],
    [2, { systemId: 2, name: 'B', regionId: 1, constellationId: 1, security: -0.5, x: 1, z: 0 }],
    [3, { systemId: 3, name: 'C', regionId: 1, constellationId: 1, security: -0.5, x: 2, z: 0 }],
    [4, { systemId: 4, name: 'D', regionId: 2, constellationId: 2, security: -0.5, x: 3, z: 0 }],
  ])
  const adjacency = new Map([
    [1, [2]],
    [2, [1, 3]],
    [3, [2, 4]],
    [4, [3]],
  ])
  return {
    systems,
    adjacency,
    hubSystemIds: new Set(),
    hubBySystemId: new Map(),
  }
}

describe('scoreWarActivity', () => {
  it('marks fleet fights as war when kills and ISK thresholds are met', () => {
    const refs = [
      warRef(200_000_000),
      warRef(200_000_000),
      warRef(200_000_000),
    ]
    const result = scoreWarActivity({
      systemId: 1,
      systemName: 'Test',
      security: -0.5,
      refs,
      shipKills24h: 10,
    })
    expect(result.isWar).toBe(true)
    expect(result.fleetKills).toBe(3)
    expect(result.kills).toHaveLength(3)
    expect(result.kills[0]!.zkillUrl).toContain('/kill/')
    expect(result.reason).toContain('Fleet fight')
  })

  it('rejects hauler-dominated activity as war', () => {
    const refs = [warRef(200_000_000), warRef(200_000_000), warRef(200_000_000)]
    const result = scoreWarActivity({
      systemId: 1,
      systemName: 'Niarja',
      security: 0.4,
      refs,
      shipKills24h: 12,
      haulerKillCount: 8,
      campLikely: true,
    })
    expect(result.isWar).toBe(false)
    expect(result.reason).toContain('Gate camp')
  })
})

describe('pickWarCandidates', () => {
  it('includes every qualifying system in the scan area', () => {
    const kills: Record<number, { shipKills: number; podKills: number }> = {}
    const within = new Set<number>()
    for (let i = 1; i <= 12; i++) {
      kills[i] = { shipKills: i, podKills: 0 }
      within.add(i)
    }
    const picked = pickWarCandidates(kills, within)
    expect(picked).toHaveLength(8)
    expect(picked[0]).toBe(12)
    expect(picked[7]).toBe(5)
  })

  it('keeps inner-radius wars when the scan radius widens', () => {
    const kills: Record<number, { shipKills: number; podKills: number }> = {}
    const inner = new Set<number>()
    const outer = new Set<number>()
    for (let i = 1; i <= 20; i++) {
      kills[i] = { shipKills: i <= 8 ? 20 : 200 - i, podKills: 0 }
      if (i <= 10) inner.add(i)
      outer.add(i)
    }
    const innerPicked = pickWarCandidates(kills, inner)
    const outerPicked = pickWarCandidates(kills, outer)
    for (const id of innerPicked) {
      expect(outerPicked).toContain(id)
    }
  })
})

describe('latestKillTimeMs', () => {
  it('returns the newest killmail time', () => {
    const kills = [
      { killmailTime: '2026-07-19T10:00:00Z' },
      { killmailTime: '2026-07-19T12:00:00Z' },
      { killmailTime: null },
    ] as Parameters<typeof latestKillTimeMs>[0]
    expect(latestKillTimeMs(kills)).toBe(Date.parse('2026-07-19T12:00:00Z'))
  })
})

describe('formatTheaterLastActivity', () => {
  it('formats elapsed time since the latest kill', () => {
    const now = Date.parse('2026-07-19T13:00:00Z')
    const kills = [{ killmailTime: '2026-07-19T12:00:00Z' }] as Parameters<
      typeof formatTheaterLastActivity
    >[0]
    expect(formatTheaterLastActivity(kills, now)).toBe('1h ago')
  })
})

describe('clusterWarTheaters', () => {
  it('groups war systems within two jumps into one theater with BR summary', () => {
    const graph = linearGraph()
    const wars = [makeWar(1, 'A', { iskDestroyed: 800_000_000 }), makeWar(3, 'C')]
    const theaters = clusterWarTheaters(graph, wars)
    expect(theaters).toHaveLength(1)
    expect(theaters[0]!.systemIds.sort()).toEqual([1, 3])
    expect(theaters[0]!.focalSystemName).toBe('A')
    expect(theaters[0]!.summary).toContain('kills')
    expect(theaters[0]!.summary).toContain('ISK')
    expect(theaters[0]!.kills.length).toBeGreaterThan(0)
    expect(theaters[0]!.zkillRelatedUrl).toContain('/related/1/')
    expect(theaters[0]!.brCreateUrl).toContain('br.evetools.org')
  })

  it('keeps distant wars as separate theaters', () => {
    const graph = linearGraph()
    const wars = [makeWar(1, 'A'), makeWar(4, 'D')]
    const theaters = clusterWarTheaters(graph, wars)
    expect(theaters).toHaveLength(2)
  })

  it('attaches theater membership onto war results', () => {
    const graph = linearGraph()
    const wars = [makeWar(1, 'A'), makeWar(2, 'B')]
    const theaters = clusterWarTheaters(graph, wars)
    const attached = attachTheatersToWars(wars, theaters)
    expect(attached[0]!.theaterSystemNames).toEqual(expect.arrayContaining(['A', 'B']))
    expect(attached[0]!.theaterId).toBe(theaters[0]!.id)
  })
})

describe('battle report links', () => {
  it('builds zKill related hour buckets', () => {
    expect(zkillRelatedUrl(30000142, '2026-07-19T12:34:00Z')).toBe(
      'https://zkillboard.com/related/30000142/202607191200/',
    )
  })

  it('formats kill URLs for EveTools BR paste', () => {
    const text = killUrlsForClipboard([
      {
        killmailId: 11,
        hash: 'a',
        totalValue: 1,
        zkillUrl: 'https://zkillboard.com/kill/11/',
        systemId: 1,
        systemName: 'A',
        shipTypeId: null,
        shipName: null,
        killmailTime: null,
        attackerCount: null,
        victimCorpId: null,
      },
    ])
    expect(text).toBe('https://zkillboard.com/kill/11/')
  })
})

describe('mergeKillRefs', () => {
  it('dedupes fresh over cached and keeps newest first', () => {
    const cached = [warRef(1), warRef(2)]
    const fresh = [warRef(3), warRef(1)]
    expect(mergeKillRefs(cached, fresh).map((r) => r.killmail_id)).toEqual([3, 1, 2])
  })

  it('ignores null entries from zKill payloads', () => {
    const cached = [warRef(1), null as unknown as ZkillKillRef]
    const fresh = [null as unknown as ZkillKillRef, warRef(2)]
    expect(mergeKillRefs(cached, fresh).map((r) => r.killmail_id)).toEqual([2, 1])
  })

  it('caps merged refs to the newest kills when over limit', () => {
    const cached = Array.from({ length: 20 }, (_, i) => warRef(i + 1))
    const fresh = Array.from({ length: 20 }, (_, i) => warRef(i + 100))
    const merged = mergeKillRefs(cached, fresh, 10)
    expect(merged).toHaveLength(10)
    expect(merged[0]!.killmail_id).toBe(119)
  })
})

describe('trimWarKillRefs', () => {
  it('keeps the newest kills when trimming', () => {
    const refs = [warRef(10), warRef(500_000_000), warRef(20), warRef(300_000_000)]
    const trimmed = trimWarKillRefs(refs, 2)
    expect(trimmed.map((r) => r.killmail_id)).toEqual([500_000_000, 300_000_000])
  })

  it('keeps recent fleet kills over older high-value solo kills', () => {
    const oldSolo = Array.from({ length: 150 }, (_, i) => {
      const ref = warRef(i + 1, true)
      ref.zkb.totalValue = 500_000_000
      return ref
    })
    const recentFleet = [900, 901, 902].map((id) => {
      const ref = warRef(id, false)
      ref.zkb.totalValue = 60_000_000
      return ref
    })
    const trimmed = trimWarKillRefs([...oldSolo, ...recentFleet], 120)
    const fleetIds = trimmed
      .filter((r) => !r.zkb.solo && (r.zkb.totalValue ?? 0) >= 50_000_000)
      .map((r) => r.killmail_id)
    expect(fleetIds).toEqual([902, 901, 900])
  })
})

describe('warIntelGapSeconds', () => {
  it('uses at least the minimum gap', () => {
    const now = Date.now()
    expect(warIntelGapSeconds(now - 30_000, 86_400)).toBe(60)
  })

  it('caps at the lookback window', () => {
    const now = Date.now()
    expect(warIntelGapSeconds(now - 200_000_000, 86_400)).toBe(86_400)
  })
})

describe('topCorpsFromKills', () => {
  it('ranks corps by ISK destroyed', () => {
    const base = {
      killmailId: 1,
      hash: 'h',
      zkillUrl: 'https://zkillboard.com/kill/1/',
      systemId: 1,
      systemName: 'Test',
      shipTypeId: null,
      shipName: null,
      killmailTime: null,
      attackerCount: null,
    }
    const kills = [
      { ...base, killmailId: 1, victimCorpId: 100, totalValue: 500_000_000 },
      { ...base, killmailId: 2, victimCorpId: 200, totalValue: 100_000_000 },
      { ...base, killmailId: 3, victimCorpId: 100, totalValue: 200_000_000 },
      { ...base, killmailId: 4, victimCorpId: null, totalValue: 50_000_000 },
    ]

    expect(topCorpsFromKills(kills, 2)).toEqual([
      { corporationId: 100, killCount: 2, iskDestroyed: 700_000_000 },
      { corporationId: 200, killCount: 1, iskDestroyed: 100_000_000 },
    ])
  })
})

