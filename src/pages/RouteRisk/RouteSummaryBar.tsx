import type { RouteDangerResult } from '@/lib/routeDanger'
import {
  countNotableJumps,
  dangerBandBadgeClass,
  routeHasUrgentCamp,
  worstJump,
} from '@/lib/routeDanger'

export function RouteSummaryBar({
  label,
  route,
  meta,
}: {
  label: string
  route: RouteDangerResult
  meta?: string
}) {
  const notable = countNotableJumps(route.jumps)
  const worst = worstJump(route.jumps)
  const urgent = routeHasUrgentCamp(route)

  return (
    <div className="route-risk__summary-bar rounded-xl border border-eve-border bg-base-200/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Route</span>
        <span className={`badge badge-sm ${dangerBandBadgeClass(route.band)}`}>{route.band}</span>
      </div>
      <p className="text-sm font-medium leading-snug truncate">{label}</p>
      <p className="text-[11px] opacity-60 mt-1 leading-snug">
        {route.gateJumps} jump{route.gateJumps === 1 ? '' : 's'}
        {meta ? ` · ${meta}` : ''}
        {notable ? ` · ${notable} to watch` : ' · clear'}
        {urgent ? ' · camp likely' : ''}
        {worst && (route.band === 'High' || route.band === 'Critical')
          ? ` · worst: ${worst.systemName}`
          : ''}
      </p>
    </div>
  )
}
