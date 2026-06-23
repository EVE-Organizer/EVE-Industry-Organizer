import type { HubConfig, StationRanking, SystemInfo, HubId } from '@/types'
import { formatDecimal } from '@/lib/profit'

const HUB_LIQUIDITY: Record<HubId, number> = {
  jita: 100,
  amarr: 85,
  dodixie: 70,
  rens: 55,
  hek: 55,
  xhq7v: 35,
}

const HUB_HAUL_DISTANCE: Record<HubId, number> = {
  jita: 1,
  amarr: 3,
  dodixie: 3,
  rens: 3,
  hek: 3,
  xhq7v: 5,
}

export function rankStations(
  hubs: HubConfig[],
  systems: SystemInfo[],
  costIndices: Record<number, number>,
): StationRanking[] {
  return hubs.map((hub) => {
    const buildSystem = systems.find((s) => s.systemId === hub.buildSystemId)
    const costIndex = costIndices[hub.buildSystemId] ?? 0.01
    const liquidityScore = HUB_LIQUIDITY[hub.id]
    const haulDistance = HUB_HAUL_DISTANCE[hub.id]
    const securityBonus = (buildSystem?.security ?? 0.5) * 10
    const totalScore = liquidityScore * 0.5 + (1 - costIndex) * 30 + securityBonus - haulDistance * 2

    const explanation =
      hub.id === 'jita'
        ? `Build in ${hub.buildSystemName} (low cost index ~${formatDecimal(costIndex * 100, 1)}%), sell in ${hub.sellStationName}. Best liquidity in New Eden.`
        : hub.id === 'xhq7v'
          ? `Build and sell in ${hub.name} (Providence nullsec). Regional Providence prices; structure market may differ. Cost index ~${formatDecimal(costIndex * 100, 1)}%.`
          : `Build and sell in ${hub.name}. Good regional hub with cost index ~${formatDecimal(costIndex * 100, 1)}%.`

    return {
      hub,
      buildSystem: buildSystem ?? {
        systemId: hub.buildSystemId,
        name: hub.buildSystemName,
        regionId: hub.regionId,
        security: 1,
        hubId: hub.id,
      },
      liquidityScore,
      costIndex,
      haulDistance,
      totalScore,
      explanation,
    }
  }).sort((a, b) => b.totalScore - a.totalScore)
}
