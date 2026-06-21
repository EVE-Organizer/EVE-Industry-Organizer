import type { HubConfig, StationRanking, SystemInfo } from '@/types'
import { formatDecimal } from '@/lib/profit'

export function rankStations(
  hubs: HubConfig[],
  systems: SystemInfo[],
  costIndices: Record<number, number>,
): StationRanking[] {
  return hubs.map((hub) => {
    const buildSystem = systems.find((s) => s.systemId === hub.buildSystemId)
    const costIndex = costIndices[hub.buildSystemId] ?? 0.01
    const liquidityScore = hub.id === 'jita' ? 100 : hub.id === 'amarr' ? 85 : hub.id === 'dodixie' ? 70 : 55
    const haulDistance = hub.id === 'jita' ? 1 : 3
    const securityBonus = (buildSystem?.security ?? 0.5) * 10
    const totalScore = liquidityScore * 0.5 + (1 - costIndex) * 30 + securityBonus - haulDistance * 2

    const explanation =
      hub.id === 'jita'
        ? `Build in ${hub.buildSystemName} (low cost index ~${formatDecimal(costIndex * 100, 1)}%), sell in ${hub.sellStationName}. Best liquidity in New Eden.`
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
