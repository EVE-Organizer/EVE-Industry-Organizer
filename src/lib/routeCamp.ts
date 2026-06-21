import type { TypeInfo } from '@/types'
import type { RouteDangerResult, RouteJumpDanger } from '@/lib/routeDanger'

export type CampLevel = 'None' | 'Possible' | 'Likely'

/** Lowsec pipes where haul camps are common (Jita-Amarr, Jita-Dodixie, etc.). */
export const KNOWN_PIPE_SYSTEM_IDS = new Set([
  30002768, // Uedama
  30003504, // Niarja
  30002765, // Sivala
  30005319, // Raneilles
  30001666, // Pera
  30000122, // Mahtista
  30001388, // Mara
  30002737, // Konola
  30002795, // Oshaima
])

const HAULER_GROUPS = new Set([
  'Hauler',
  'Freighter',
  'Jump Freighter',
  'Blockade Runner',
  'Deep Space Transport',
  'Transport Ship',
  'Industrial Command Ship',
  'Capital Industrial Ship',
])

export function buildHaulerTypeIds(types: TypeInfo[]): Set<number> {
  return new Set(types.filter((t) => t.category === 'Ship' && HAULER_GROUPS.has(t.group)).map((t) => t.typeId))
}

export function classifyCampLevel(
  systemId: number,
  security: number,
  haulerKills2h: number,
  shipKills24h: number,
): CampLevel {
  if (haulerKills2h >= 2) return 'Likely'
  if (haulerKills2h >= 1) {
    if (KNOWN_PIPE_SYSTEM_IDS.has(systemId) || security < 0.45) return 'Likely'
    return 'Possible'
  }
  if (KNOWN_PIPE_SYSTEM_IDS.has(systemId) && security < 0.45 && shipKills24h >= 5) {
    return 'Possible'
  }
  if (security > 0 && security < 0.45 && shipKills24h >= 10) {
    return 'Possible'
  }
  return 'None'
}

export interface CampLevelContext {
  systemId: number
  security: number
  haulerKills2h: number
  shipKills24h: number
}

export const CAMP_COLUMN_TOOLTIP =
  'Gate camps are players parked at stargates to catch haulers. Levels use hauler kills from zKillboard (last 2h), known pipe systems, and 24h kill counts. This is not local intel.'

export function explainCampLevel(ctx: CampLevelContext): string {
  const { systemId, security, haulerKills2h, shipKills24h } = ctx
  const isPipe = KNOWN_PIPE_SYSTEM_IDS.has(systemId)
  const isLowsec = security > 0 && security < 0.45
  const haulerPhrase =
    haulerKills2h === 1
      ? '1 hauler kill in the last 2 hours'
      : `${haulerKills2h} hauler kills in the last 2 hours`

  if (haulerKills2h >= 2) {
    return `${haulerPhrase} on zKillboard. Multiple recent haul losses often mean an active camp.`
  }
  if (haulerKills2h >= 1) {
    if (isPipe && isLowsec) {
      return `${haulerPhrase} in a known haul pipe (${security.toFixed(1)} sec). Recent haul loss on a common gank route.`
    }
    if (isPipe) {
      return `${haulerPhrase} on a known haul pipe. Recent haul loss on a route where camps are common.`
    }
    if (isLowsec) {
      return `${haulerPhrase} in lowsec (${security.toFixed(1)} sec). Haulers are common targets on lowsec gates.`
    }
    return `${haulerPhrase} on zKillboard. Worth watching, but not on a known pipe or lowsec gate.`
  }
  if (isPipe && isLowsec && shipKills24h >= 5) {
    return `Known haul pipe with ${shipKills24h} ship kills in 24h and no hauler kills in the last 2h. Activity may be scouts or non-haul PVP.`
  }
  if (isLowsec && shipKills24h >= 10) {
    return `${shipKills24h} ship kills in 24h in lowsec (${security.toFixed(1)} sec) with no recent hauler kills. Heavy PVP can precede camping.`
  }
  if (security >= 0.45 && !isPipe) {
    return 'Highsec with no recent hauler kills in the last 2h. Gate camps are rare here.'
  }
  return 'No recent hauler kills in the last 2h on zKillboard.'
}

export function campLevelBadgeClass(level: CampLevel): string {
  switch (level) {
    case 'Likely':
      return 'badge-error'
    case 'Possible':
      return 'badge-warning'
    default:
      return 'badge-ghost opacity-60'
  }
}

export function shouldCheckCamp(systemId: number, security: number): boolean {
  return security < 0.45 || KNOWN_PIPE_SYSTEM_IDS.has(systemId)
}

export function enrichJumpsWithCamp(
  jumps: RouteJumpDanger[],
  haulerKillsBySystem: Map<number, number>,
): RouteJumpDanger[] {
  return jumps.map((jump) => {
    const recentHaulerKills = haulerKillsBySystem.get(jump.systemId) ?? 0
    return {
      ...jump,
      recentHaulerKills,
      campLevel: classifyCampLevel(jump.systemId, jump.security, recentHaulerKills, jump.shipKills),
      campReason: explainCampLevel({
        systemId: jump.systemId,
        security: jump.security,
        haulerKills2h: recentHaulerKills,
        shipKills24h: jump.shipKills,
      }),
    }
  })
}

export function enrichRouteJumps(
  route: RouteDangerResult,
  haulerKillsBySystem: Map<number, number>,
): RouteDangerResult {
  return {
    ...route,
    jumps: enrichJumpsWithCamp(route.jumps, haulerKillsBySystem),
  }
}
