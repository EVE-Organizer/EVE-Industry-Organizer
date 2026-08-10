import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CampLevel } from '@/lib/routeCamp'
import { campLevelBadgeClass, CAMP_COLUMN_TOOLTIP } from '@/lib/routeCamp'
import { gateKillBand, gateKillBandBadgeClass, explainGateIntel } from '@/lib/gateIntel'
import {
  countNotableJumps,
  filterNotableJumps,
  gateCheckUrl,
  haulRiskTriggerSummary,
  jumpRowHighlightClass,
  parseRouteLabel,
  routeHasUrgentCamp,
  worseDangerBand,
  worstJump,
} from '@/lib/haulRiskDisplay'
import type { DangerBand, RouteDangerResult, RouteJumpDanger } from '@/lib/routeDanger'
import { dangerBand, dangerBandBadgeClass } from '@/lib/routeDanger'
import { formatDecimal } from '@/lib/profit'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Tooltip } from '@/components/Tooltip'

type RouteTab = 'in' | 'out'

interface HaulRiskModalProps {
  open: boolean
  onClose: () => void
  haulIn: RouteDangerResult | null
  haulOut: RouteDangerResult | null
  loading: boolean
  gateIntelLoading?: boolean
  haulInLabel: string
  haulOutLabel: string
}

function campLevelLabel(level: CampLevel | undefined): string {
  return level ?? 'None'
}

function GateIntelCell({ jump }: { jump: RouteDangerResult['jumps'][number] }) {
  const intel = jump.gateIntel
  const gateBand = gateKillBand(intel?.gateKillCount ?? 0)
  const gateTooltip = intel ? explainGateIntel(intel) : 'No gate kills in the last hour.'

  const flags: { key: string; label: string; className: string }[] = []
  if (intel?.smartbombs) flags.push({ key: 'sb', label: 'SB', className: 'badge-error' })
  if (intel?.hictors) flags.push({ key: 'hic', label: 'HIC', className: 'badge-error' })
  if (intel?.dictors) flags.push({ key: 'dic', label: 'Dic', className: 'badge-warning' })

  return (
    <Tooltip text={gateTooltip} placement="top">
      <span className="inline-flex items-center gap-1.5">
        <span className={`badge badge-xs tabular-nums ${gateKillBandBadgeClass(gateBand)}`}>
          {intel?.gateKillCount ?? 0}
        </span>
        {flags.length ? (
          <span className="inline-flex gap-0.5">
            {flags.map((flag) => (
              <span key={flag.key} className={`badge badge-xs ${flag.className}`}>
                {flag.label}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </Tooltip>
  )
}

function RouteJumpTable({
  jumps,
  totalJumps,
  showAll,
  gateIntelLoading,
}: {
  jumps: RouteJumpDanger[]
  totalJumps: number
  showAll: boolean
  gateIntelLoading: boolean
}) {
  if (!jumps.length) {
    return (
      <div className="haul-risk-modal__empty flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
        {showAll ? (
          <p className="text-sm opacity-50">No route data.</p>
        ) : (
          <>
            <p className="text-sm font-medium text-success">No risky systems flagged</p>
            <p className="text-xs opacity-60 max-w-sm">
              Nothing stood out on gate intel, camps, or route danger. Turn on “Show all jumps” to
              review every system.
            </p>
          </>
        )}
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
            <th>Risk</th>
            <th>
              <span className="inline-flex items-center gap-1">
                Gate (1h)
                <InfoTooltip
                  text="Gate kills and smartbomb / bubble ship flags from zKillboard (last hour)."
                  placement="top"
                />
              </span>
            </th>
            <th>
              <span className="inline-flex items-center gap-1">
                Camp
                <InfoTooltip text={CAMP_COLUMN_TOOLTIP} placement="top" />
              </span>
            </th>
            <th className="hidden sm:table-cell">24h kills</th>
          </tr>
        </thead>
        <tbody>
          {jumps.map((jump) => (
            <tr
              key={jump.systemId}
              className={`text-sm ${jumpRowHighlightClass(jump)}`}
            >
              <td className="max-w-[11rem] truncate font-medium">{jump.systemName}</td>
              <td className="tabular-nums">{formatDecimal(jump.security, 1)}</td>
              <td>
                <span className={`badge badge-xs ${dangerBandBadgeClass(dangerBand(jump.danger))}`}>
                  {dangerBand(jump.danger)}
                </span>
              </td>
              <td>
                {gateIntelLoading && !jump.gateIntel ? (
                  <span className="text-xs opacity-40">…</span>
                ) : (
                  <GateIntelCell jump={jump} />
                )}
              </td>
              <td>
                <Tooltip text={jump.campReason ?? 'No camp data for this system.'} placement="left">
                  <span
                    className={`badge badge-xs ${campLevelBadgeClass(jump.campLevel ?? 'None')}`}
                    aria-label={jump.campReason}
                    tabIndex={0}
                  >
                    {campLevelLabel(jump.campLevel)}
                  </span>
                </Tooltip>
              </td>
              <td className="tabular-nums whitespace-nowrap hidden sm:table-cell opacity-70">
                {jump.shipKills}s / {jump.podKills}p
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showAll && totalJumps > jumps.length ? (
        <p className="text-[11px] opacity-50 px-3 py-2 border-t border-eve-border">
          Showing {jumps.length} of {totalJumps} systems with elevated risk or gate activity.
        </p>
      ) : null}
    </div>
  )
}

function RouteSummaryStrip({
  direction,
  label,
  route,
  active,
  onSelect,
}: {
  direction: 'in' | 'out'
  label: string
  route: RouteDangerResult
  active: boolean
  onSelect: () => void
}) {
  const notable = countNotableJumps(route.jumps)
  const worst = worstJump(route.jumps)
  const urgent = routeHasUrgentCamp(route)

  return (
    <button
      type="button"
      className={`haul-risk-modal__route-tab ${active ? 'haul-risk-modal__route-tab--active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="haul-risk-modal__route-tab-head">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {direction === 'in' ? 'Haul in' : 'Haul out'}
        </span>
        <span className={`badge badge-sm ${dangerBandBadgeClass(route.band)}`}>{route.band}</span>
      </span>
      <span className="haul-risk-modal__route-tab-label">{label}</span>
      <span className="haul-risk-modal__route-tab-meta">
        {route.gateJumps} jump{route.gateJumps === 1 ? '' : 's'}
        {notable ? ` · ${notable} to watch` : ' · clear'}
        {urgent ? ' · camp likely' : ''}
        {worst && (route.band === 'High' || route.band === 'Critical')
          ? ` · worst: ${worst.systemName}`
          : ''}
      </span>
    </button>
  )
}

export function HaulRiskModal({
  open,
  onClose,
  haulIn,
  haulOut,
  loading,
  gateIntelLoading = false,
  haulInLabel,
  haulOutLabel,
}: HaulRiskModalProps) {
  const [activeTab, setActiveTab] = useState<RouteTab>('in')
  const [showAllJumps, setShowAllJumps] = useState(false)

  const defaultTab = useMemo<RouteTab>(() => {
    if (!haulIn || !haulOut) return 'in'
    if (haulOut.band !== haulIn.band) {
      return worseDangerBand(haulOut.band, haulIn.band) === haulOut.band ? 'out' : 'in'
    }
    const outNotable = countNotableJumps(haulOut.jumps)
    const inNotable = countNotableJumps(haulIn.jumps)
    return outNotable > inNotable ? 'out' : 'in'
  }, [haulIn, haulOut])

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      setShowAllJumps(false)
    }
  }, [open, defaultTab, haulInLabel, haulOutLabel])

  const activeRoute = activeTab === 'in' ? haulIn : haulOut
  const activeLabel = activeTab === 'in' ? haulInLabel : haulOutLabel
  const displayedJumps = useMemo(() => {
    if (!activeRoute) return []
    return showAllJumps ? activeRoute.jumps : filterNotableJumps(activeRoute.jumps)
  }, [activeRoute, showAllJumps])

  const gateCheckLink = useMemo(() => {
    const parsed = parseRouteLabel(activeLabel)
    if (!parsed) return null
    return gateCheckUrl(parsed.from, parsed.to)
  }, [activeLabel])

  if (!open) return null

  const overallBand =
    haulIn && haulOut ? worseDangerBand(haulIn.band, haulOut.band) : haulIn?.band ?? haulOut?.band

  return (
    <dialog className="modal modal-open">
      <div className="modal-box haul-risk-modal__box w-full p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-eve-border">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-lg">Haul route risk</h3>
              {overallBand && !loading ? (
                <span className={`badge ${dangerBandBadgeClass(overallBand)}`}>{overallBand}</span>
              ) : null}
              {gateIntelLoading ? (
                <span className="text-xs opacity-60 inline-flex items-center gap-1.5">
                  <span className="loading loading-spinner loading-xs" />
                  Gate intel…
                </span>
              ) : null}
            </div>
            <p className="text-xs opacity-60 mt-1 max-w-xl">
              Same secure routes for every blueprint with your current buy hub, build system, and sell
              hub. Materials in from market; finished goods back out.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm opacity-60">
              <span className="loading loading-spinner loading-sm mr-2" />
              Loading routes…
            </div>
          )}

          {!loading && (!haulIn || !haulOut) && (
            <div className="flex items-center justify-center py-16 text-sm opacity-60">
              Route data unavailable for this hub and manufacturing system.
            </div>
          )}

          {!loading && haulIn && haulOut && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <RouteSummaryStrip
                  direction="in"
                  label={haulInLabel}
                  route={haulIn}
                  active={activeTab === 'in'}
                  onSelect={() => setActiveTab('in')}
                />
                <RouteSummaryStrip
                  direction="out"
                  label={haulOutLabel}
                  route={haulOut}
                  active={activeTab === 'out'}
                  onSelect={() => setActiveTab('out')}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="label cursor-pointer gap-2 py-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs checkbox-primary"
                    checked={showAllJumps}
                    onChange={(e) => setShowAllJumps(e.target.checked)}
                  />
                  <span className="label-text text-xs">Show all jumps</span>
                </label>
                {gateCheckLink ? (
                  <Link to={gateCheckLink} className="link link-hover text-xs" onClick={onClose}>
                    Open in Gate check →
                  </Link>
                ) : null}
              </div>

              <RouteJumpTable
                jumps={displayedJumps}
                totalJumps={activeRoute?.jumps.length ?? 0}
                showAll={showAllJumps}
                gateIntelLoading={gateIntelLoading}
              />
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 text-[11px] opacity-50">
          Risk uses security and ESI 24h kills. Gate and camp hints use zKillboard (1h gates, 2h
          haulers). Not local intel.
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
  error?: string | null
  loading: boolean
  gateIntelLoading?: boolean
  haulInLabel?: string
  haulOutLabel?: string
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

function HaulFailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm.75 3.5a.75.75 0 0 0-1.5 0v4.25a.75.75 0 0 0 1.5 0V5Zm-.75 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  )
}

function RiskIcon({
  direction,
  band,
  urgent,
}: {
  direction: 'in' | 'out'
  band: DangerBand
  urgent?: boolean
}) {
  const Icon = direction === 'in' ? HaulInIcon : HaulOutIcon
  const dirLabel = direction === 'in' ? 'Haul in' : 'Haul out'

  return (
    <span
      className={`relative inline-flex items-center justify-center w-5 h-5 rounded ${dangerBandBadgeClass(band)}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {urgent ? (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-error ring-1 ring-base-100"
          aria-hidden
        />
      ) : null}
      <span className="sr-only">
        {dirLabel}: {band}
        {urgent ? ', camp likely' : ''}
      </span>
    </span>
  )
}

export function HaulRiskTrigger({
  haulIn,
  haulOut,
  error,
  loading,
  gateIntelLoading,
  haulInLabel,
  haulOutLabel,
  onOpen,
}: HaulRiskTriggerProps) {
  if (loading) {
    return (
      <Tooltip text="Loading haul routes…" placement="left">
        <span className="inline-flex items-center justify-center w-[2.625rem] text-xs opacity-40">
          <span className="loading loading-spinner loading-xs" />
        </span>
      </Tooltip>
    )
  }

  if (error) {
    return (
      <Tooltip text={error} placement="left">
        <span
          className="inline-flex items-center gap-0.5 text-warning opacity-90"
          aria-label={error}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-warning/20">
            <HaulFailIcon className="w-3.5 h-3.5" />
          </span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-warning/20">
            <HaulFailIcon className="w-3.5 h-3.5" />
          </span>
        </span>
      </Tooltip>
    )
  }

  if (!haulIn || !haulOut) {
    return <span className="text-xs opacity-50">—</span>
  }

  const tooltip =
    haulInLabel && haulOutLabel
      ? haulRiskTriggerSummary(haulIn, haulOut, haulInLabel, haulOutLabel)
      : `Haul in: ${haulIn.band}. Haul out: ${haulOut.band}. Click for details.`

  const inUrgent = routeHasUrgentCamp(haulIn)
  const outUrgent = routeHasUrgentCamp(haulOut)

  return (
    <Tooltip text={gateIntelLoading ? `${tooltip}\n(Gate intel still loading.)` : tooltip} placement="left">
      <button
        type="button"
        className="inline-flex items-center gap-0.5 hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        aria-label={`Haul risk: in ${haulIn.band}, out ${haulOut.band}. Open details.`}
      >
        <RiskIcon direction="in" band={haulIn.band} urgent={inUrgent} />
        <RiskIcon direction="out" band={haulOut.band} urgent={outUrgent} />
      </button>
    </Tooltip>
  )
}
