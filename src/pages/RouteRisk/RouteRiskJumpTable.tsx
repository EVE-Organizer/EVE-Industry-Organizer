import type { CampLevel } from '@/lib/routeCamp'
import { campLevelBadgeClass, CAMP_COLUMN_TOOLTIP } from '@/lib/routeCamp'
import {
  gateKillBand,
  gateKillBandBadgeClass,
  explainGateIntel,
  zkillSystemUrl,
} from '@/lib/gateIntel'
import type { RouteJumpDanger } from '@/lib/routeDanger'
import { dangerBand, dangerBandBadgeClass, jumpRowHighlightClass } from '@/lib/routeDanger'
import { formatDecimal } from '@/lib/profit'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Tooltip } from '@/components/Tooltip'

function campLevelLabel(level: CampLevel | undefined): string {
  return level ?? 'None'
}

function GateIntelCell({ jump }: { jump: RouteJumpDanger }) {
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

export function RouteRiskJumpTable({
  jumps,
  totalJumps,
  showAll,
  gateIntelLoading,
  scrollClassName = 'route-risk__table-scroll',
  emptyClassName = 'route-risk__empty',
}: {
  jumps: RouteJumpDanger[]
  totalJumps: number
  showAll: boolean
  gateIntelLoading?: boolean
  scrollClassName?: string
  emptyClassName?: string
}) {
  if (!jumps.length) {
    return (
      <div
        className={`${emptyClassName} flex flex-col items-center justify-center gap-2 py-10 px-4 text-center`}
      >
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
    <div className={`${scrollClassName} overflow-x-auto`}>
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
            <th className="w-0" />
          </tr>
        </thead>
        <tbody>
          {jumps.map((jump) => (
            <tr key={jump.systemId} className={`text-sm ${jumpRowHighlightClass(jump)}`}>
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
              <td className="text-right whitespace-nowrap">
                <a
                  href={zkillSystemUrl(jump.systemId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-hover text-xs opacity-70"
                  onClick={(e) => e.stopPropagation()}
                >
                  zKill
                </a>
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

export function RouteRiskLegend() {
  return (
    <div className="text-xs opacity-70 space-y-3">
      <div>
        <p className="font-medium opacity-90 mb-2">Route risk (ESI 24h)</p>
        <p>
          Security status plus ship and pod kills in the last 24 hours set each jump’s risk band.
        </p>
      </div>
      <div>
        <p className="font-medium opacity-90 mb-2">Gate intel (zKillboard, last hour)</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          <li className="flex items-center gap-2">
            <span className="badge badge-xs badge-success tabular-nums">0</span>
            No gate kills
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-xs badge-warning tabular-nums">1–2</span>
            Some gate activity
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-xs badge-error tabular-nums">3+</span>
            Heavy gate activity
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-xs badge-error">SB</span>
            Smartbombs at a gate
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-xs badge-error">HIC</span>
            Heavy interdictors at a gate
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-xs badge-warning">Dic</span>
            Interdictors at a gate
          </li>
        </ul>
      </div>
    </div>
  )
}
