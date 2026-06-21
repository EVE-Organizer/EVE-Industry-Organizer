import type { CampLevel } from '@/lib/routeCamp'
import { campLevelBadgeClass, CAMP_COLUMN_TOOLTIP } from '@/lib/routeCamp'
import type { DangerBand, RouteDangerResult } from '@/lib/routeDanger'
import { dangerBand, dangerBandBadgeClass } from '@/lib/routeDanger'
import { InfoTooltip } from '@/components/InfoTooltip'

interface HaulRiskModalProps {
  open: boolean
  onClose: () => void
  haulIn: RouteDangerResult | null
  haulOut: RouteDangerResult | null
  loading: boolean
  haulInLabel: string
  haulOutLabel: string
}

function campLevelLabel(level: CampLevel | undefined): string {
  return level ?? 'None'
}

function RouteJumpTable({ jumps }: { jumps: RouteDangerResult['jumps'] }) {
  if (!jumps.length) {
    return (
      <div className="haul-risk-modal__table-scroll flex items-center justify-center">
        <p className="text-sm opacity-50">No route data</p>
      </div>
    )
  }

  return (
    <div className="haul-risk-modal__table-scroll overflow-x-auto">
      <table className="table table-compact w-full">
        <thead className="bg-base-300/95 sticky top-0 z-10">
          <tr className="text-xs">
            <th>System</th>
            <th>Sec</th>
            <th>Kills (24h)</th>
            <th>Risk</th>
            <th>
              <span className="inline-flex items-center gap-1">
                Camp
                <InfoTooltip text={CAMP_COLUMN_TOOLTIP} className="tooltip-top" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jumps.map((jump) => (
            <tr key={jump.systemId} className="text-sm">
              <td className="max-w-[10rem] truncate">{jump.systemName}</td>
              <td className="tabular-nums">{jump.security.toFixed(1)}</td>
              <td className="tabular-nums whitespace-nowrap">
                {jump.shipKills}s / {jump.podKills}p
              </td>
              <td>
                <span className={`badge badge-xs ${dangerBandBadgeClass(dangerBand(jump.danger))}`}>
                  {dangerBand(jump.danger)}
                </span>
              </td>
              <td>
                <span
                  className={`tooltip tooltip-left badge badge-xs ${campLevelBadgeClass(jump.campLevel ?? 'None')} before:max-w-xs before:text-left before:whitespace-normal before:content-[attr(data-tip)]`}
                  data-tip={jump.campReason ?? 'No camp data for this system.'}
                >
                  <span aria-label={jump.campReason} tabIndex={0}>
                    {campLevelLabel(jump.campLevel)}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RouteSummaryCard({
  title,
  routeLabel,
  route,
}: {
  title: string
  routeLabel: string
  route: RouteDangerResult
}) {
  return (
    <section className="haul-risk-modal__route card bg-base-200/60 border border-eve-border flex flex-col min-h-0">
      <div className="card-body p-4 gap-3 flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold">{title}</h4>
            <p className="haul-risk-modal__route-label text-xs opacity-60 mt-1">{routeLabel}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`badge ${dangerBandBadgeClass(route.band)} badge-md font-semibold`}>
              {route.band}
            </span>
          </div>
        </div>
        <p className="text-[11px] opacity-50 shrink-0">
          {route.jumps.length} jump{route.jumps.length === 1 ? '' : 's'} · worst jump sets route risk
        </p>
        <RouteJumpTable jumps={route.jumps} />
      </div>
    </section>
  )
}

export function HaulRiskModal({
  open,
  onClose,
  haulIn,
  haulOut,
  loading,
  haulInLabel,
  haulOutLabel,
}: HaulRiskModalProps) {
  if (!open) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box haul-risk-modal__box w-full p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-eve-border">
          <div className="min-w-0">
            <h3 className="font-bold text-lg">Haul route risk</h3>
            <p className="text-xs opacity-60 mt-1">
              Materials from hub market to build system; finished goods back to market.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 shrink-0">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm opacity-60">
              Loading route and kill data…
            </div>
          )}

          {!loading && (!haulIn || !haulOut) && (
            <div className="flex items-center justify-center py-16 text-sm opacity-60">
              Route data unavailable for this hub and manufacturing region.
            </div>
          )}

          {!loading && haulIn && haulOut && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <RouteSummaryCard title="Haul in" routeLabel={haulInLabel} route={haulIn} />
              <RouteSummaryCard title="Haul out" routeLabel={haulOutLabel} route={haulOut} />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 text-[11px] opacity-50 space-y-1">
          <p>Risk scores combine system security and ship/pod kills from the last 24 hours (ESI).</p>
          <p>
            Camp levels use hauler kills from the last 2 hours on zKillboard. They are a hint, not local intel.
          </p>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}

interface HaulRiskTriggerProps {
  haulIn: RouteDangerResult | null
  haulOut: RouteDangerResult | null
  loading: boolean
  onOpen: () => void
}

function HaulInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        d="M2.5 8h7.5M7.5 5l3 3-3 3"
      />
    </svg>
  )
}

function HaulOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        d="M13.5 8H6M9 5l-3 3 3 3"
      />
    </svg>
  )
}

function RiskIcon({ direction, band }: { direction: 'in' | 'out'; band: DangerBand }) {
  const Icon = direction === 'in' ? HaulInIcon : HaulOutIcon
  const dirLabel = direction === 'in' ? 'Haul in' : 'Haul out'

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded ${dangerBandBadgeClass(band)}`}
      title={`${dirLabel}: ${band}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="sr-only">{dirLabel}: {band}</span>
    </span>
  )
}

export function HaulRiskTrigger({ haulIn, haulOut, loading, onOpen }: HaulRiskTriggerProps) {
  if (loading) {
    return <span className="text-xs opacity-40">…</span>
  }

  if (!haulIn || !haulOut) {
    return <span className="text-xs opacity-50">—</span>
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-0.5 hover:opacity-80 transition-opacity"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      aria-label={`Haul risk: in ${haulIn.band}, out ${haulOut.band}. Open details.`}
    >
      <RiskIcon direction="in" band={haulIn.band} />
      <RiskIcon direction="out" band={haulOut.band} />
    </button>
  )
}
