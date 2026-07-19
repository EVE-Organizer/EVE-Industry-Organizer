import { useEffect, useState } from 'react'
import { EveImage } from '@/components/EveImage'
import { EmojiBadge } from '@/components/map/MapLegend'
import { WarIntelLoading } from '@/components/map/WarIntelLoading'
import { useTheaterKillDetails } from '@/hooks/useTheaterKillDetails'
import { useZkillRelated } from '@/hooks/useZkillRelated'
import type {
  ZkillRelatedKillRow,
  ZkillRelatedReport,
  ZkillRelatedTeam,
} from '@/services/market/zkillService'
import type { WarKillEvidence, WarTheater } from '@/types/map'
import { formatLocalTime, formatZkillRelatedTime, killUrlsForClipboard } from '@/lib/warActivity'
import { formatIsk } from '@/lib/profit'

const RELATED_KILLS_INITIAL = 30

interface WarBattleReportProps {
  theater: WarTheater
  enrichmentSource?: WarTheater
  compact?: boolean
  onSelectSystem?: (systemId: number) => void
  onTheaterEnriched?: (theater: WarTheater) => void
}

export function WarBattleReport({
  theater,
  enrichmentSource,
  compact = false,
  onSelectSystem,
  onTheaterEnriched,
}: WarBattleReportProps) {
  const source = enrichmentSource ?? theater
  const [enableRestEnrich, setEnableRestEnrich] = useState(false)
  const detailsQuery = useTheaterKillDetails(compact ? null : source, onTheaterEnriched, {
    enableRest: enableRestEnrich,
  })
  const enrichedTheater = detailsQuery.data ?? detailsQuery.anchorTheater ?? theater
  const relatedQuery = useZkillRelated(
    compact || !detailsQuery.isAnchorReady ? null : detailsQuery.anchorTheater,
  )

  useEffect(() => {
    if (relatedQuery.isSuccess || relatedQuery.isError) {
      setEnableRestEnrich(true)
    }
  }, [relatedQuery.isSuccess, relatedQuery.isError])

  if (compact) {
    return <CompactTheaterSummary theater={theater} onSelectSystem={onSelectSystem} />
  }

  if (detailsQuery.isLoading || relatedQuery.isLoading) {
    return (
      <div className="space-y-3">
        <TheaterHeader theater={theater} onSelectSystem={onSelectSystem} />
        <WarIntelLoading
          active
          compact
          label="Loading battle report…"
          progress={
            detailsQuery.isLoading
              ? (detailsQuery.enrichProgress ?? {
                  phase: 'enrich',
                  current: 0,
                  total: 1,
                })
              : null
          }
        />
      </div>
    )
  }

  if (relatedQuery.data) {
    return (
      <ZkillRelatedView
        theater={enrichedTheater}
        report={relatedQuery.data}
        onSelectSystem={onSelectSystem}
      />
    )
  }

  return (
    <FallbackTheaterView
      theater={enrichedTheater}
      onSelectSystem={onSelectSystem}
      error={relatedQuery.isError || detailsQuery.isError}
    />
  )
}

function ZkillRelatedView({
  theater,
  report,
  onSelectSystem,
}: {
  theater: WarTheater
  report: ZkillRelatedReport
  onSelectSystem?: (systemId: number) => void
}) {
  const [copied, setCopied] = useState(false)
  const [showAllKills, setShowAllKills] = useState(false)
  const visibleKills = showAllKills
    ? report.kills
    : report.kills.slice(0, RELATED_KILLS_INITIAL)
  const hiddenKillCount = report.kills.length - visibleKills.length

  const handleCopyKills = async () => {
    const text = report.kills.map((k) => k.zkillUrl).join('\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const totalKills = report.teamA.killCount + report.teamB.killCount
  const totalIsk = report.teamA.iskDestroyed + report.teamB.iskDestroyed
  const totalPoints = report.teamA.points + report.teamB.points

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-eve-border/70 bg-base-300/65 overflow-hidden">
        <div className="border-b border-eve-border/50 bg-base-200/50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-base-content truncate">
                {report.systemName}
                {report.regionName ? (
                  <span className="font-normal text-base-content/55"> · {report.regionName}</span>
                ) : null}
              </p>
              <p className="text-[10px] text-base-content/60 mt-0.5">
                Related {formatZkillRelatedTime(report.relatedTime)}
                {report.windowHours ? ` (±${report.windowHours}h)` : ''}
              </p>
            </div>
            <a
              href={report.relatedUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md border border-eve-border/50 bg-base-300/60 px-2 py-1 text-[10px] hover:bg-base-300 transition-colors"
            >
              zKill ↗
            </a>
          </div>

          {!report.complete ? (
            <p className="mt-1.5 text-[10px] text-amber-400/90">Report still computing on zKill</p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-px bg-eve-border/30 border-b border-eve-border/50">
          <SummaryStat label="Kills" value={String(totalKills || report.kills.length)} />
          <SummaryStat label="ISK" value={formatIsk(totalIsk || theater.iskDestroyed)} />
          <SummaryStat label="Points" value={String(totalPoints)} />
        </div>

        <div className="grid grid-cols-2 gap-px bg-eve-border/30 border-b border-eve-border/50">
          <TeamPanel label="Team A" team={report.teamA} tint="#38bdf8" />
          <TeamPanel label="Team B" team={report.teamB} tint="#f472b6" />
        </div>

        {theater.systemNames.length > 1 ? (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-eve-border/40">
            {theater.systemNames.map((name, i) =>
              onSelectSystem ? (
                <button
                  key={theater.systemIds[i]}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-eve-border/50 bg-base-200/60 px-2 py-0.5 text-[10px] hover:border-sky-400/45 hover:bg-sky-500/10 transition-colors"
                  onClick={() => onSelectSystem(theater.systemIds[i]!)}
                >
                  {name}
                </button>
              ) : (
                <span
                  key={theater.systemIds[i]}
                  className="inline-flex items-center rounded-full border border-eve-border/50 bg-base-200/60 px-2 py-0.5 text-[10px]"
                >
                  {name}
                </span>
              ),
            )}
          </div>
        ) : null}

        <div className="max-h-[min(52vh,420px)] overflow-y-auto">
          {report.kills.length > 0 ? (
            <>
              <ul className="list-none m-0 p-0 divide-y divide-eve-border/35">
                {visibleKills.map((kill) => (
                  <RelatedKillRow key={kill.killmailId} kill={kill} />
                ))}
              </ul>
              {hiddenKillCount > 0 ? (
                <div className="border-t border-eve-border/35 px-3 py-2 text-center">
                  <button
                    type="button"
                    className="text-[10px] text-base-content/70 hover:text-base-content hover:underline"
                    onClick={() => setShowAllKills(true)}
                  >
                    Show {hiddenKillCount} more kills
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="px-3 py-6 text-center text-[11px] text-base-content/50">
              No kills in this related window
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-eve-border/50 px-3 py-2 bg-base-200/30">
          <ExternalLinkButton href={theater.zkillSystemUrl} label="zKill system" />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-eve-border/50 bg-base-200/50 px-2 py-1 text-[10px] hover:bg-base-300/60 transition-colors disabled:opacity-40"
            onClick={() => void handleCopyKills()}
            disabled={report.kills.length === 0}
          >
            <CopyIcon />
            {copied ? 'Copied' : 'Copy kill URLs'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RelatedKillRow({ kill }: { kill: ZkillRelatedKillRow }) {
  const timeLabel = formatLocalTime(kill.killmailTime)

  const corpLabel = kill.victimCorpTicker
    ? `[${kill.victimCorpTicker}]`
    : kill.victimCorpName

  return (
    <li className="group flex items-center gap-2 px-2.5 py-1.5 text-[10px] hover:bg-base-200/40 transition-colors">
      <span className="shrink-0 w-9 text-right tabular-nums text-base-content/50">{timeLabel}</span>
      <div className="shrink-0 rounded border border-eve-border/40 bg-base-200/80 overflow-hidden">
        <EveImage id={kill.shipTypeId} variant="icon" size={26} alt={kill.shipName} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate leading-snug">
          {kill.victimCharacterName}
          <span className="font-normal text-base-content/50"> · {kill.shipName}</span>
        </p>
        <p className="truncate text-base-content/55 leading-snug">
          {corpLabel}
          {kill.victimAllianceTicker ? ` · [${kill.victimAllianceTicker}]` : ''}
          {kill.systemName ? ` · ${kill.systemName}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="font-medium">{formatIsk(kill.totalValue)}</p>
        <p className="text-base-content/50">
          {kill.points} pt{kill.points === 1 ? '' : 's'}
          {kill.attackerCount > 0 ? ` · ${kill.attackerCount}` : ''}
          {kill.solo ? ' · solo' : ''}
        </p>
      </div>
      <a
        href={kill.zkillUrl}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded px-1 py-0.5 opacity-50 hover:opacity-100 hover:bg-base-200/80 transition-colors"
        aria-label="Open on zKillboard"
      >
        ↗
      </a>
    </li>
  )
}

function TeamPanel({
  label,
  team,
  tint,
}: {
  label: string
  team: ZkillRelatedTeam
  tint: string
}) {
  const topPilots = team.pilots.slice(0, 4)
  return (
    <div className="bg-base-300/55 px-2.5 py-2 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: tint }}>
        {label}
      </p>
      <p className="text-[10px] tabular-nums text-base-content/80">
        {team.killCount} kill{team.killCount === 1 ? '' : 's'} · {formatIsk(team.iskDestroyed)} ·{' '}
        {team.points} pt{team.points === 1 ? '' : 's'}
      </p>
      {topPilots.length > 0 ? (
        <ul className="mt-1 space-y-0.5 list-none m-0 p-0">
          {topPilots.map((p) => (
            <li key={`${p.characterId}-${p.shipTypeId}`} className="flex items-center gap-1 truncate">
              <EveImage id={p.shipTypeId} variant="icon" size={14} alt={p.shipName} />
              <span className="truncate text-[9px] text-base-content/65">{p.characterName}</span>
            </li>
          ))}
          {team.pilots.length > topPilots.length ? (
            <li className="text-[9px] text-base-content/45 pl-4">
              +{team.pilots.length - topPilots.length} pilots
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-[9px] text-base-content/45 mt-1">{team.pilots.length} pilots fielded</p>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base-300/55 px-2 py-1.5 text-center">
      <p className="text-[8px] uppercase tracking-wide text-base-content/45">{label}</p>
      <p className="text-[11px] font-semibold tabular-nums truncate">{value}</p>
    </div>
  )
}

function TheaterHeader({
  theater,
  onSelectSystem,
}: {
  theater: WarTheater
  onSelectSystem?: (systemId: number) => void
}) {
  return (
    <div className="rounded-lg border border-eve-border/60 px-2.5 py-2">
      <p className="text-[11px] leading-snug text-base-content/75">{theater.reason}</p>
      {theater.systemNames.length > 1 && onSelectSystem ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {theater.systemNames.map((name, i) => (
            <button
              key={theater.systemIds[i]}
              type="button"
              className="text-[10px] opacity-70 hover:opacity-100 hover:underline"
              onClick={() => onSelectSystem(theater.systemIds[i]!)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CompactTheaterSummary({
  theater,
  onSelectSystem,
}: {
  theater: WarTheater
  onSelectSystem?: (systemId: number) => void
}) {
  const topKills = theater.kills.slice(0, 5)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <StatTile label="Kills" value={String(theater.fleetKills)} tint="#d946ef" />
        <StatTile label="ISK" value={formatIsk(theater.iskDestroyed)} tint="#fbbf24" />
        <StatTile label="Systems" value={String(theater.systemIds.length)} tint="#38bdf8" />
      </div>
      {topKills.length > 0 ? (
        <ul className="list-none m-0 p-0 space-y-1">
          {topKills.map((kill) => (
            <FallbackKillRow key={kill.killmailId} kill={kill} />
          ))}
        </ul>
      ) : null}
      {onSelectSystem && theater.systemNames.length > 1 ? (
        <p className="text-[10px] opacity-50">{theater.systemNames.join(' · ')}</p>
      ) : null}
    </div>
  )
}

function FallbackTheaterView({
  theater,
  onSelectSystem,
  error,
}: {
  theater: WarTheater
  onSelectSystem?: (systemId: number) => void
  error: boolean
}) {
  const [copied, setCopied] = useState(false)
  const topKills = theater.kills.slice(0, 8)

  const handleCopyKills = async () => {
    const text = killUrlsForClipboard(theater.kills)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-eve-border/70 bg-base-300/65 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <EmojiBadge emoji="⚔️" color="#d946ef" size={28} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300/90">
              Battle report
            </p>
            <p className="text-[11px] font-medium leading-snug text-base-content/90 mt-0.5">
              {theater.summary}
            </p>
          </div>
        </div>

        {error ? (
          <p className="text-[10px] text-amber-400/90">
            Could not load zKill related report. Showing cached intel.
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-1.5">
          <StatTile label="Kills" value={String(theater.fleetKills)} tint="#d946ef" />
          <StatTile label="ISK" value={formatIsk(theater.iskDestroyed)} tint="#fbbf24" />
          <StatTile label="Systems" value={String(theater.systemIds.length)} tint="#38bdf8" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ExternalLinkButton href={theater.zkillSystemUrl} label="zKill system" />
          {theater.zkillRelatedUrl ? (
            <ExternalLinkButton href={theater.zkillRelatedUrl} label="zKill related" />
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-eve-border/50 bg-base-200/50 px-2 py-1 text-[10px] hover:bg-base-300/60 transition-colors disabled:opacity-40"
            onClick={() => void handleCopyKills()}
            disabled={theater.kills.length === 0}
          >
            <CopyIcon />
            {copied ? 'Copied' : 'Copy kill URLs'}
          </button>
        </div>
      </div>

      {topKills.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest opacity-50">Top losses</p>
          <ul className="list-none m-0 p-0 space-y-1">
            {topKills.map((kill) => (
              <FallbackKillRow key={kill.killmailId} kill={kill} />
            ))}
          </ul>
        </div>
      ) : null}

      {onSelectSystem && theater.systemNames.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {theater.systemNames.map((name, i) => (
            <button
              key={theater.systemIds[i]}
              type="button"
              className="text-[10px] rounded-full border border-eve-border/50 px-2 py-0.5 hover:bg-base-200/60"
              onClick={() => onSelectSystem(theater.systemIds[i]!)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FallbackKillRow({ kill }: { kill: WarKillEvidence }) {
  const timeLabel = kill.killmailTime
    ? new Date(kill.killmailTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : null

  return (
    <li className="flex items-center gap-2 rounded-lg border border-eve-border/45 bg-base-300/55 px-2 py-1.5 text-[10px]">
      <div className="shrink-0 rounded-md border border-eve-border/40 bg-base-200/80 overflow-hidden">
        {kill.shipTypeId ? (
          <EveImage id={kill.shipTypeId} variant="icon" size={28} alt={kill.shipName ?? 'Ship'} />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center text-sm opacity-50">🚀</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {kill.shipName ?? 'Unknown ship'}
          <span className="opacity-45 font-normal"> · {kill.systemName}</span>
        </p>
        <p className="opacity-55 tabular-nums truncate">
          {formatIsk(kill.totalValue)}
          {kill.attackerCount != null && kill.attackerCount > 0
            ? ` · ${kill.attackerCount} attackers`
            : ''}
          {timeLabel ? ` · ${timeLabel} UTC` : ''}
        </p>
      </div>
      <a
        href={kill.zkillUrl}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        zKill
      </a>
    </li>
  )
}

function StatTile({
  label,
  value,
  tint,
}: {
  label: string
  value: string
  tint: string
}) {
  return (
    <div
      className="rounded-lg border border-eve-border/45 bg-base-200/75 px-2 py-1.5 text-center"
      style={{ borderColor: `${tint}33` }}
    >
      <p className="text-[8px] uppercase tracking-wide opacity-50">{label}</p>
      <p className="text-[11px] font-semibold tabular-nums truncate" style={{ color: tint }}>
        {value}
      </p>
    </div>
  )
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-eve-border/50 bg-base-200/50 px-2 py-1 text-[10px] hover:bg-base-300/60 transition-colors"
    >
      {label}
    </a>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M4 2h7l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 2v10h8V6H9V4H5Zm2-3h5v2H7V1Z" />
    </svg>
  )
}
