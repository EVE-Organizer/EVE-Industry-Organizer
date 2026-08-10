import type { CampLevel } from '@/lib/routeCamp'
import type { DangerBand, RouteDangerResult, RouteJumpDanger } from '@/lib/routeDanger'
import { dangerBand } from '@/lib/routeDanger'

const BAND_RANK: Record<DangerBand, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
}

export function worseDangerBand(a: DangerBand, b: DangerBand): DangerBand {
  return BAND_RANK[a] >= BAND_RANK[b] ? a : b
}

export function isNotableHaulJump(jump: RouteJumpDanger): boolean {
  const band = dangerBand(jump.danger)
  if (band === 'High' || band === 'Critical') return true
  if (jump.campLevel === 'Likely' || jump.campLevel === 'Possible') return true
  const intel = jump.gateIntel
  if (!intel) return false
  if (intel.gateKillCount >= 1 || intel.smartbombs || intel.hictors || intel.dictors) return true
  return false
}

export function filterNotableJumps(jumps: RouteJumpDanger[]): RouteJumpDanger[] {
  return jumps.filter(isNotableHaulJump)
}

export function countNotableJumps(jumps: RouteJumpDanger[]): number {
  return jumps.filter(isNotableHaulJump).length
}

export function worstJump(jumps: RouteJumpDanger[]): RouteJumpDanger | null {
  if (!jumps.length) return null
  return jumps.reduce((worst, jump) => (jump.danger > worst.danger ? jump : worst))
}

export function campLevelRank(level: CampLevel | undefined): number {
  switch (level) {
    case 'Likely':
      return 3
    case 'Possible':
      return 2
    case 'None':
      return 1
    default:
      return 0
  }
}

export function routeHasUrgentCamp(route: RouteDangerResult): boolean {
  return route.jumps.some((j) => j.campLevel === 'Likely')
}

export function haulRiskTriggerSummary(
  haulIn: RouteDangerResult,
  haulOut: RouteDangerResult,
  haulInLabel: string,
  haulOutLabel: string,
): string {
  const lines = [
    `Materials in: ${haulIn.band} (${haulInLabel})`,
    `Goods out: ${haulOut.band} (${haulOutLabel})`,
  ]
  const inHot = countNotableJumps(haulIn.jumps)
  const outHot = countNotableJumps(haulOut.jumps)
  if (inHot || outHot) {
    lines.push(`${inHot + outHot} risky system${inHot + outHot === 1 ? '' : 's'} on these routes.`)
  }
  lines.push('Click for jump details.')
  return lines.join(' ')
}

export function parseRouteLabel(label: string): { from: string; to: string } | null {
  const parts = label.split('→').map((part) => part.trim())
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return { from: parts[0], to: parts[1] }
}

export function routeRiskToolUrl(fromLabel: string, toLabel: string, flag = 'secure'): string {
  const params = new URLSearchParams({ from: fromLabel, to: toLabel })
  if (flag !== 'secure') params.set('flag', flag)
  return `/tools/route-risk?${params.toString()}`
}

/** @deprecated Use routeRiskToolUrl */
export function gateCheckUrl(fromLabel: string, toLabel: string): string {
  return routeRiskToolUrl(fromLabel, toLabel)
}

export function jumpRowHighlightClass(jump: RouteJumpDanger): string {
  const band = dangerBand(jump.danger)
  if (band === 'Critical' || jump.campLevel === 'Likely') {
    return 'bg-error/10'
  }
  if (band === 'High' || jump.campLevel === 'Possible') {
    return 'bg-warning/10'
  }
  const intel = jump.gateIntel
  if (intel && (intel.gateKillCount >= 3 || intel.smartbombs)) {
    return 'bg-warning/10'
  }
  return ''
}
