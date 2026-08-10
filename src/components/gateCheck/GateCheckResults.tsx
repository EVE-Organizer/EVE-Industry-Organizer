import { gateKillBand, gateKillBandBadgeClass, explainGateIntel, eveGatecheckUrl, zkillSystemUrl } from '@/lib/gateIntel'
import { formatDecimal } from '@/lib/profit'
import type { RouteDangerResult } from '@/lib/routeDanger'
import { Tooltip } from '@/components/Tooltip'

function GateFlagBadges({ intel }: { intel: RouteDangerResult['jumps'][number]['gateIntel'] }) {
  if (!intel) return <span className="text-xs opacity-40">—</span>
  const badges: { key: string; label: string; className: string }[] = []
  if (intel.smartbombs) badges.push({ key: 'sb', label: 'SB', className: 'badge-error' })
  if (intel.hictors) badges.push({ key: 'hic', label: 'HIC', className: 'badge-error' })
  if (intel.dictors) badges.push({ key: 'dic', label: 'Dic', className: 'badge-warning' })
  if (!badges.length) return <span className="text-xs opacity-40">—</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span key={badge.key} className={`badge badge-xs ${badge.className}`}>
          {badge.label}
        </span>
      ))}
    </span>
  )
}

export function GateCheckResultsTable({
  jumps,
  fromName,
  toName,
}: {
  jumps: RouteDangerResult['jumps']
  fromName: string
  toName: string
}) {
  if (!jumps.length) {
    return <p className="text-sm opacity-50 py-8 text-center">No route data.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-compact w-full">
        <thead className="bg-base-300/95 sticky top-0 z-10">
          <tr className="text-xs">
            <th>System</th>
            <th>Sec</th>
            <th>Kills (24h)</th>
            <th>Gate (1h)</th>
            <th>Flags</th>
            <th className="w-0" />
          </tr>
        </thead>
        <tbody>
          {jumps.map((jump) => {
            const intel = jump.gateIntel
            const band = gateKillBand(intel?.gateKillCount ?? 0)
            const gateTooltip = intel ? explainGateIntel(intel) : 'No gate kills in the last hour.'
            return (
              <tr key={jump.systemId} className="text-sm">
                <td className="max-w-[12rem] truncate font-medium">{jump.systemName}</td>
                <td className="tabular-nums">{formatDecimal(jump.security, 1)}</td>
                <td className="tabular-nums whitespace-nowrap">
                  {jump.shipKills}s / {jump.podKills}p
                </td>
                <td>
                  <Tooltip text={gateTooltip} placement="top">
                    <span className={`badge badge-xs tabular-nums ${gateKillBandBadgeClass(band)}`}>
                      {intel?.gateKillCount ?? 0}
                    </span>
                  </Tooltip>
                </td>
                <td>
                  <Tooltip text={gateTooltip} placement="top">
                    <GateFlagBadges intel={intel} />
                  </Tooltip>
                </td>
                <td className="text-right whitespace-nowrap">
                  <a
                    href={zkillSystemUrl(jump.systemId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-hover text-xs opacity-70"
                  >
                    zKill
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-[11px] opacity-50 mt-3">
        Also compare on{' '}
        <a
          href={eveGatecheckUrl(fromName, toName)}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-hover"
        >
          eve-gatecheck.space
        </a>
        .
      </p>
    </div>
  )
}

export function GateCheckLegend() {
  return (
    <div className="text-xs opacity-70 space-y-2">
      <p className="font-medium opacity-90">Legend (last hour, zKillboard)</p>
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
          Smartbomb kills at a gate
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
  )
}
