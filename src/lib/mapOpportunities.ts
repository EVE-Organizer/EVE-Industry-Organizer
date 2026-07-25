import type { HubId, ManufacturingSettings, RankedBlueprintRow } from '@/types'
import { DEFAULT_SETTINGS, HUBS } from '@/types'
import type {
  MapGraph,
  MapOpportunityRow,
  OpportunityTag,
  WarActivityResult,
  WarTheater,
} from '@/types/map'
import type { SdeData } from '@/services/data/sdeLoader'
import {
  isNullsecSystem,
  jumpDistance,
  nearestPublicHub,
  nearestRestockPoint,
  type RestockContext,
} from '@/lib/nearestPublicHub'
import { bestSellHubForProduct, getProductSpikeAtHub } from '@/lib/volumeSpike'
import { rankBlueprintsFromMarket } from '@/lib/ranking'
import {
  applyKillDetails,
  attachTheatersToWars,
  clusterWarTheaters,
  scoreWarActivity,
  theaterNearestHub,
  zkillSystemUrl,
} from '@/lib/warActivity'
import type { KillmailDetails, ZkillKillRef } from '@/services/market/zkillService'

const TOP_RANK = 40
const TOP_OPPORTUNITIES = 10

export interface MapOpportunityInput {
  sde: SdeData
  graph: MapGraph
  settings: ManufacturingSettings
  primaryHub: HubId
  sellHubId: HubId
  warResults: WarActivityResult[]
  warTheaters?: WarTheater[]
  haulOutRoute?: number[]
  campSystemIds?: Set<number>
  watchlistTypeIds?: number[]
  planRootTypeIds?: number[]
}

function warBoostForSellHub(
  theaters: WarTheater[],
  sellHubId: HubId,
): number {
  for (const theater of theaters) {
    if (theater.nearestHubId === sellHubId) return 2.0
  }
  return 1.0
}

const NULLSEC_WAR_MAX_JUMPS = 15

function theaterForSellContext(
  theaters: WarTheater[],
  sellHubId: HubId,
  graph: MapGraph,
  factorySystemId: number,
): WarTheater | null {
  if (!isNullsecSystem(graph, factorySystemId)) {
    return theaterNearestHub(theaters, sellHubId)
  }

  let best: { theater: WarTheater; jumps: number } | null = null
  for (const theater of theaters) {
    const jumps = jumpDistance(graph, theater.focalSystemId, factorySystemId)
    if (jumps === null || jumps > NULLSEC_WAR_MAX_JUMPS) continue
    if (!best || jumps < best.jumps) {
      best = { theater, jumps }
    }
  }
  return best?.theater ?? null
}

function warBoostForContext(
  theaters: WarTheater[],
  sellHubId: HubId,
  graph: MapGraph,
  factorySystemId: number,
): number {
  if (!isNullsecSystem(graph, factorySystemId)) {
    return warBoostForSellHub(theaters, sellHubId)
  }
  return theaterForSellContext(theaters, sellHubId, graph, factorySystemId) ? 2.0 : 1.0
}

function haulOutJumpsForFactory(
  graph: MapGraph,
  factorySystemId: number,
  sellHubSystemId: number,
): number | null {
  if (isNullsecSystem(graph, factorySystemId)) {
    const sellInNull = isNullsecSystem(graph, sellHubSystemId)
    if (!sellInNull) return 0
  }
  return jumpDistance(graph, factorySystemId, sellHubSystemId)
}

function distancePenalty(jumps: number | null): number {
  if (jumps === null) return 0.85
  if (jumps <= 5) return 1.1
  if (jumps <= 15) return 1.0
  if (jumps <= 30) return 0.9
  return 0.75
}

function buildTags(warBoost: number, spikeRatio: number | null): OpportunityTag[] {
  const tags: OpportunityTag[] = []
  const hasWar = warBoost > 1
  const hasSpike = spikeRatio !== null && spikeRatio >= 2
  if (hasWar && hasSpike) tags.push('WAR+SPIKE')
  else if (hasWar) tags.push('WAR')
  else if (hasSpike) tags.push('SPIKE')
  else tags.push('IPH')
  return tags
}

export function buildWarActivityResults(
  graph: MapGraph,
  candidates: {
    systemId: number
    refs: ZkillKillRef[]
    shipKills24h: number
    haulerKills?: number
  }[],
  options?: {
    killDetailsById?: Map<number, KillmailDetails>
    typeNames?: Map<number, string>
    killWindowLabel?: string
    restockContext?: RestockContext
  },
): { warResults: WarActivityResult[]; warTheaters: WarTheater[] } {
  const scored: WarActivityResult[] = candidates.map((c) => {
    const sys = graph.systems.get(c.systemId)
    const result = scoreWarActivity({
      systemId: c.systemId,
      systemName: sys?.name ?? `System ${c.systemId}`,
      security: sys?.security ?? 0,
      refs: c.refs,
      shipKills24h: c.shipKills24h,
      haulerKillCount: c.haulerKills,
    })
    const kills =
      options?.killDetailsById && options.killDetailsById.size > 0
        ? applyKillDetails(result.kills, options.killDetailsById, options.typeNames)
        : result.kills
    const nearest = options?.restockContext
      ? nearestRestockPoint(graph, c.systemId, options.restockContext)
      : nearestPublicHub(graph, c.systemId)
    return {
      systemId: result.systemId,
      systemName: result.systemName,
      security: result.security,
      isWar: result.isWar,
      fleetKills: result.fleetKills,
      iskDestroyed: result.iskDestroyed,
      haulerShare: result.haulerShare,
      soloShare: result.soloShare,
      reason: result.reason,
      shipKills24h: result.shipKills24h,
      qualifyingKillValues: result.qualifyingKillValues,
      killmailIds: result.killmailIds,
      kills,
      zkillUrl: zkillSystemUrl(result.systemId),
      nearestHubId: nearest?.hubId ?? null,
      nearestHubSystemId: nearest?.marketSystemId ?? null,
      nearestHubJumps: nearest?.jumps ?? null,
      theaterId: null,
      theaterSystemIds: [],
      theaterSystemNames: [],
    }
  })

  const warTheaters = clusterWarTheaters(graph, scored, options?.killWindowLabel)
  const warResults = attachTheatersToWars(scored, warTheaters)
  return { warResults, warTheaters }
}

export function buildMapOpportunities(input: MapOpportunityInput): MapOpportunityRow[] {
  const {
    sde,
    graph,
    settings,
    primaryHub,
    warResults,
    haulOutRoute = [],
    campSystemIds,
  } = input
  const warTheaters =
    input.warTheaters ??
    clusterWarTheaters(graph, warResults)
  const haulOutHasCamp =
    campSystemIds !== undefined &&
    haulOutRoute.some((systemId) => campSystemIds.has(systemId))
  const manufacturingSystemId = settings.manufacturingSystemId

  const ranked = rankBlueprintsFromMarket(
    sde.registry,
    sde.market,
    sde.regions,
    new Map(sde.types.map((t) => [t.typeId, t])),
    primaryHub,
    settings.priceWindow ?? DEFAULT_SETTINGS.priceWindow,
    settings,
    {
      tiers: ['t1', 't2'],
      sortBy: 'iph',
      limit: TOP_RANK,
      minSetupCost: 0,
      maxSetupCost: Number.MAX_SAFE_INTEGER,
      buildableOnly: false,
    },
    sde.systems,
  )

  const rows: MapOpportunityRow[] = []

  for (const row of ranked) {
    const typeId = row.product.typeId
    let sellHubId = input.sellHubId
    let sellPrice = sde.market.hubs[sellHubId]?.prices[String(typeId)] ?? 0

    const bestHub = bestSellHubForProduct(sde.market, typeId, primaryHub)
    if (bestHub) {
      sellHubId = bestHub.hubId
      sellPrice = bestHub.sellPrice
    }

    const warForHub = theaterForSellContext(warTheaters, sellHubId, graph, manufacturingSystemId)
    const warBoost = warBoostForContext(warTheaters, sellHubId, graph, manufacturingSystemId)
    const spike = getProductSpikeAtHub(sde.market, sellHubId, typeId)
    const spikeRatio = spike?.spikeRatio ?? null

    const hubConfig = HUBS.find((h) => h.id === sellHubId)
    const sellHubSystemId = hubConfig?.marketSystemId ?? 0
    const haulOutJumps = haulOutJumpsForFactory(graph, manufacturingSystemId, sellHubSystemId)

    const iphWeight = Math.log10(Math.max(row.iph, 1)) / 6
    const marginWeight = Math.min(row.margin / 100, 1) + 0.5
    const spikeWeight = spikeRatio && spikeRatio >= 2 ? Math.min(spikeRatio / 2, 2) : 1
    const score =
      warBoost * spikeWeight * iphWeight * marginWeight * distancePenalty(haulOutJumps)

    const primaryPrice = sde.market.hubs[primaryHub]?.prices[String(typeId)] ?? 0
    const priceVsPrimaryPct =
      primaryPrice > 0 ? ((sellPrice - primaryPrice) / primaryPrice) * 100 : 0

    rows.push({
      productTypeId: typeId,
      productName: row.product.name,
      blueprintTypeId: row.blueprint.blueprintTypeId,
      tags: buildTags(warBoost, spikeRatio),
      iph: row.iph,
      margin: row.margin,
      sellHubId,
      sellHubName: hubConfig?.name ?? sellHubId,
      sellPrice,
      priceVsPrimaryPct,
      spikeRatio,
      warSystemId: warForHub?.focalSystemId ?? null,
      warSystemName: warForHub?.focalSystemName ?? null,
      warTheaterId: warForHub?.id ?? null,
      warTheaterSystemNames: warForHub?.systemNames ?? [],
      warIskDestroyed: warForHub?.iskDestroyed ?? null,
      warFleetKills: warForHub?.fleetKills ?? null,
      restockHubJumps: warForHub?.nearestHubJumps ?? null,
      haulOutJumps,
      campOnHaulOut: haulOutHasCamp,
      opportunityScore: score,
      netProfit: row.netProfit,
      upfrontCapital: row.upfrontCapital,
    })
  }

  return rows.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, TOP_OPPORTUNITIES)
}

export function findRankedRow(
  ranked: RankedBlueprintRow[],
  productTypeId: number,
): RankedBlueprintRow | undefined {
  return ranked.find((r) => r.product.typeId === productTypeId)
}
