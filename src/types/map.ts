import type { HubId } from '@/types'

export interface MapSystem {
  systemId: number
  name: string
  regionId: number
  constellationId: number
  security: number
  x: number
  z: number
}

export type MapJump = [number, number]

export interface MapData {
  generatedAt: string
  systems: MapSystem[]
  jumps: MapJump[]
}

export interface MapGraph {
  systems: Map<number, MapSystem>
  adjacency: Map<number, number[]>
  hubSystemIds: Set<number>
  hubBySystemId: Map<number, HubId>
}

export interface MapLayers {
  security: boolean
  war: boolean
  volumeSpike: boolean
  gateCamp: boolean
  haulCorridor: boolean
  tradeHubs: boolean
}

export const DEFAULT_MAP_LAYERS: MapLayers = {
  security: true,
  war: true,
  volumeSpike: true,
  gateCamp: true,
  haulCorridor: true,
  tradeHubs: true,
}

/** Where war intel scans from (factory vs panned map center). */
export type WarIntelAnchor = 'factory' | 'mapCenter'

export const WAR_INTEL_RADIUS_OPTIONS = [8, 12, 16, 20] as const
export type WarIntelRadius = (typeof WAR_INTEL_RADIUS_OPTIONS)[number]

export const WAR_INTEL_WINDOW_OPTIONS = ['12h', '1d', '3d', '7d'] as const
export type WarIntelWindow = (typeof WAR_INTEL_WINDOW_OPTIONS)[number]

export const DEFAULT_WAR_INTEL_ANCHOR: WarIntelAnchor = 'factory'
export const DEFAULT_WAR_INTEL_RADIUS: WarIntelRadius = 12
export const DEFAULT_WAR_INTEL_WINDOW: WarIntelWindow = '1d'

export function warIntelWindowSeconds(window: WarIntelWindow): number {
  switch (window) {
    case '12h':
      return 12 * 3600
    case '1d':
      return 86400
    case '3d':
      return 3 * 86400
    case '7d':
      return 7 * 86400
  }
}

/** Max zKill refs per system used for war scoring (zKill returns up to ~200). */
export function warIntelMaxRefsForWindow(window: WarIntelWindow): number {
  switch (window) {
    case '12h':
      return 50
    case '1d':
      return 80
    case '3d':
      return 120
    case '7d':
      return 200
  }
}

export function warIntelWindowLabel(window: WarIntelWindow): string {
  switch (window) {
    case '12h':
      return '12 hours'
    case '1d':
      return '1 day'
    case '3d':
      return '3 days'
    case '7d':
      return '7 days'
  }
}

export type WarIntelProgressPhase = 'kills' | 'systems' | 'enrich' | 'build'

export interface WarIntelProgress {
  phase: WarIntelProgressPhase
  current: number
  total: number
}

export type OpportunityTag = 'WAR+SPIKE' | 'WAR' | 'SPIKE' | 'IPH'

export interface MapOpportunityRow {
  productTypeId: number
  productName: string
  blueprintTypeId: number
  tags: OpportunityTag[]
  iph: number
  margin: number
  sellHubId: HubId
  sellHubName: string
  sellPrice: number
  priceVsPrimaryPct: number
  spikeRatio: number | null
  warSystemId: number | null
  warSystemName: string | null
  warTheaterId: string | null
  warTheaterSystemNames: string[]
  warIskDestroyed: number | null
  warFleetKills: number | null
  restockHubJumps: number | null
  haulOutJumps: number | null
  campOnHaulOut: boolean
  opportunityScore: number
  netProfit: number
  upfrontCapital: number
}

/** One scored system from zKill + ESI kills (may or may not be war). */
export interface WarKillEvidence {
  killmailId: number
  hash: string
  totalValue: number
  zkillUrl: string
  systemId: number
  systemName: string
  shipTypeId: number | null
  shipName: string | null
  killmailTime: string | null
  attackerCount: number | null
  victimCorpId: number | null
}

export interface WarActivityResult {
  systemId: number
  systemName: string
  security: number
  isWar: boolean
  fleetKills: number
  iskDestroyed: number
  haulerShare: number
  soloShare: number
  reason: string
  shipKills24h: number
  qualifyingKillValues: number[]
  killmailIds: number[]
  kills: WarKillEvidence[]
  zkillUrl: string
  nearestHubId: HubId | null
  nearestHubSystemId: number | null
  nearestHubJumps: number | null
  theaterId: string | null
  theaterSystemIds: number[]
  theaterSystemNames: string[]
}

/** Connected war systems (within a few jumps) treated as one fight area. */
export interface WarTheater {
  id: string
  systemIds: number[]
  systemNames: string[]
  focalSystemId: number
  focalSystemName: string
  fleetKills: number
  iskDestroyed: number
  nearestHubId: HubId | null
  nearestHubSystemId: number | null
  nearestHubJumps: number | null
  regionIds: number[]
  reason: string
  summary: string
  kills: WarKillEvidence[]
  zkillSystemUrl: string
  zkillRelatedUrl: string | null
  brCreateUrl: string
  timeWindowLabel: string | null
  killWindowLabel: string
}
