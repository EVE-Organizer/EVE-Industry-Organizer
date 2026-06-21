import type { CampLevel } from '@/lib/routeCamp'

export interface SystemKillStats {
  systemId: number
  shipKills: number
  podKills: number
}

export interface JumpDangerInput {
  security: number
  shipKills: number
  podKills: number
}

export function jumpDanger(system: JumpDangerInput): number {
  const secFactor =
    system.security >= 0.45
      ? 10
      : system.security > 0
        ? 40 + (0.45 - system.security) * 100
        : 70
  const killFactor = Math.min(30, system.shipKills * 5 + system.podKills * 15)
  return Math.min(100, Math.round(secFactor + killFactor))
}

export type DangerBand = 'Low' | 'Medium' | 'High' | 'Critical'

export function dangerBand(score: number): DangerBand {
  if (score >= 75) return 'Critical'
  if (score >= 50) return 'High'
  if (score >= 25) return 'Medium'
  return 'Low'
}

export function dangerBandBadgeClass(band: DangerBand): string {
  switch (band) {
    case 'Critical':
      return 'badge-error'
    case 'High':
      return 'badge-warning'
    case 'Medium':
      return 'badge-info'
    default:
      return 'badge-success'
  }
}

export function dangerBandTextClass(band: DangerBand): string {
  switch (band) {
    case 'Critical':
      return 'text-error'
    case 'High':
      return 'text-warning'
    case 'Medium':
      return 'text-info'
    default:
      return 'text-success'
  }
}

export interface RouteJumpDanger {
  systemId: number
  systemName: string
  security: number
  shipKills: number
  podKills: number
  danger: number
  campLevel?: CampLevel
  recentHaulerKills?: number
  campReason?: string
}

export interface RouteDangerResult {
  jumps: RouteJumpDanger[]
  /** Stargate transitions (ESI route is inclusive of origin and destination). */
  gateJumps: number
  routeDanger: number
  band: DangerBand
}

/** ESI route arrays include origin and destination; gate jumps are edges between them. */
export function routeGateJumps(routeSystemIds: number[]): number {
  if (routeSystemIds.length <= 1) return 0
  return routeSystemIds.length - 1
}

export function computeRouteDanger(
  routeSystemIds: number[],
  systemNames: Map<number, string>,
  securities: Map<number, number>,
  kills: Map<number, SystemKillStats>,
): RouteDangerResult {
  const gateJumps = routeGateJumps(routeSystemIds)
  const jumps: RouteJumpDanger[] = routeSystemIds.map((systemId) => {
    const kill = kills.get(systemId)
    const security = securities.get(systemId) ?? 0
    const shipKills = kill?.shipKills ?? 0
    const podKills = kill?.podKills ?? 0
    return {
      systemId,
      systemName: systemNames.get(systemId) ?? `System ${systemId}`,
      security,
      shipKills,
      podKills,
      danger: jumpDanger({ security, shipKills, podKills }),
    }
  })

  const routeDanger = jumps.length ? Math.max(...jumps.map((j) => j.danger)) : 0
  return { jumps, gateJumps, routeDanger, band: dangerBand(routeDanger) }
}
