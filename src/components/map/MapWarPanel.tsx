import { useCallback, useMemo, useState } from 'react'
import { HUBS } from '@/types'
import type {
  WarActivityResult,
  WarTheater,
  WarIntelAnchor,
  WarIntelProgress,
  WarIntelRadius,
  WarIntelWindow,
} from '@/types/map'
import {
  WAR_MIN_FLEET_KILLS,
  WAR_MIN_ISK_DESTROYED,
  WAR_MIN_KILL_VALUE,
  enrichTheaterFromKillCache,
  findTheaterForSystem,
  theaterEnrichmentSignature,
} from '@/lib/warActivity'
import { formatIsk } from '@/lib/profit'
import { useSdeData } from '@/hooks/useSdeData'
import { WarIntelSkeletonList, WarIntelLoading } from '@/components/map/WarIntelLoading'
import { WarIntelSettings } from '@/components/map/WarIntelSettings'
import { WarTheaterModal, WarTheaterMiniSummary, useTheaterLastActivity } from '@/components/map/WarTheaterModal'
import { TheaterCorpIcons } from '@/components/map/WarTheaterCorpIcons'

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="2" strokeWidth="1.5" />
      <path
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
      />
    </svg>
  )
}

interface MapWarPanelProps {
  theaters: WarTheater[]
  warResults: WarActivityResult[]
  loading: boolean
  warIntelProgress?: WarIntelProgress | null
  error: string | null
  selectedSystemId: number | null
  onSelectSystem: (systemId: number) => void
  onRefresh: () => void
  intelAge: string | null
  warIntelAnchor: WarIntelAnchor
  onWarIntelAnchorChange: (anchor: WarIntelAnchor) => void
  warIntelRadius: WarIntelRadius
  onWarIntelRadiusChange: (radius: WarIntelRadius) => void
  warIntelWindow: WarIntelWindow
  onWarIntelWindowChange: (window: WarIntelWindow) => void
  factoryName: string | null
  manufacturingSystemId: number
  onFocusWarTheater: (theater: WarTheater) => void
  onClearWarTheaterFocus: () => void
}

export function MapWarPanel({
  theaters,
  warResults,
  loading,
  warIntelProgress = null,
  error,
  selectedSystemId,
  onSelectSystem,
  onRefresh,
  intelAge,
  warIntelAnchor,
  onWarIntelAnchorChange,
  warIntelRadius,
  onWarIntelRadiusChange,
  warIntelWindow,
  onWarIntelWindowChange,
  factoryName,
  manufacturingSystemId,
  onFocusWarTheater,
  onClearWarTheaterFocus,
}: MapWarPanelProps) {
  const { data: sde } = useSdeData()
  const [openTheaterId, setOpenTheaterId] = useState<string | null>(null)
  const [enrichedById, setEnrichedById] = useState<Record<string, WarTheater>>({})

  const typeNames = useMemo(
    () => (sde ? new Map(sde.types.map((t) => [t.typeId, t.name])) : undefined),
    [sde],
  )

  const handleTheaterEnriched = useCallback((enriched: WarTheater) => {
    setEnrichedById((prev) => {
      const sig = theaterEnrichmentSignature(enriched)
      if (prev[enriched.id] && theaterEnrichmentSignature(prev[enriched.id]) === sig) {
        return prev
      }
      return { ...prev, [enriched.id]: enriched }
    })
  }, [])

  const displayTheaters = useMemo(
    () =>
      theaters.map((t) => {
        const session = enrichedById[t.id]
        if (session) return session
        return typeNames ? enrichTheaterFromKillCache(t, typeNames) : t
      }),
    [theaters, enrichedById, typeNames],
  )

  const selectedTheater = selectedSystemId
    ? findTheaterForSystem(displayTheaters, selectedSystemId)
    : null
  const openTheaterBase = openTheaterId
    ? (theaters.find((t) => t.id === openTheaterId) ?? null)
    : null
  const openTheater = openTheaterId
    ? (displayTheaters.find((t) => t.id === openTheaterId) ?? null)
    : null
  const checkedSystems = warResults.filter((w) => !w.isWar)
  const refreshing = warIntelProgress != null
  const coldLoading = loading && theaters.length === 0
  const scanLabel =
    warIntelAnchor === 'factory' && factoryName
      ? `${factoryName} (${warIntelRadius}j)`
      : `map center (${warIntelRadius}j)`

  return (
    <section className="flex flex-col gap-2 min-w-0">
      <div className="rounded-xl border border-eve-border/80 bg-gradient-to-br from-fuchsia-500/10 via-base-300/50 to-base-200/30 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">War intel</h2>
            <p className="text-[10px] opacity-50 mt-0.5">
              {coldLoading
                ? `Fetching within ${warIntelRadius}j of ${scanLabel}…`
                : refreshing
                  ? `Updating within ${warIntelRadius}j of ${scanLabel}…`
                  : `Covers ${warIntelRadius}j from ${scanLabel}`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-outline shrink-0"
            onClick={onRefresh}
            disabled={loading || refreshing}
          >
            {loading || refreshing ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              'Refresh'
            )}
          </button>
        </div>
        {error && !loading && !refreshing ? (
          <p className="mt-1 text-[10px] text-error">{error}</p>
        ) : intelAge ? (
          <p className="mt-1 text-[10px] opacity-50">
            ESI kills as of {intelAge}
            {refreshing ? ' · updating…' : ''}
          </p>
        ) : null}
      </div>

      <details className="rounded-lg border border-eve-border/60 bg-base-300/30">
        <summary className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[10px] opacity-70">
          <SettingsIcon className="size-3 shrink-0 opacity-80" />
          Settings
        </summary>
        <p className="border-t border-eve-border/50 px-2.5 py-2 text-[10px] opacity-70">
          Non-solo kills ≥ {formatIsk(WAR_MIN_KILL_VALUE)} each · need {WAR_MIN_FLEET_KILLS}+ kills
          or {formatIsk(WAR_MIN_ISK_DESTROYED)} ISK · hauler share under 50%
        </p>
        <WarIntelSettings
          warLoading={coldLoading}
          warRefreshing={refreshing}
          warIntelProgress={warIntelProgress}
          warIntelAge={intelAge}
          warError={error}
          warIntelAnchor={warIntelAnchor}
          onWarIntelAnchorChange={onWarIntelAnchorChange}
          warIntelRadius={warIntelRadius}
          onWarIntelRadiusChange={onWarIntelRadiusChange}
          warIntelWindow={warIntelWindow}
          onWarIntelWindowChange={onWarIntelWindowChange}
          factoryName={factoryName}
          onRefreshWar={onRefresh}
        />
      </details>

      {refreshing && theaters.length > 0 ? (
        <WarIntelLoading
          active
          label="Updating war intel…"
          progress={warIntelProgress}
          compact
        />
      ) : null}

      {coldLoading ? (
        <WarIntelSkeletonList rows={3} />
      ) : theaters.length === 0 ? (
        <p className="rounded-lg border border-eve-border/70 bg-base-300/40 px-3 py-4 text-center text-xs opacity-70">
          No war theaters within {warIntelRadius} jumps of {scanLabel}.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {displayTheaters.map((theater) => (
            <TheaterRow
              key={theater.id}
              theater={theater}
              selected={selectedTheater?.id === theater.id}
              onOpen={() => {
                onFocusWarTheater(theater)
                setOpenTheaterId(theater.id)
              }}
              manufacturingSystemId={manufacturingSystemId}
              factoryName={factoryName}
            />
          ))}
        </ul>
      )}

      {checkedSystems.length > 0 ? (
        <details className="rounded-lg border border-eve-border/60 bg-base-300/30">
          <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium opacity-80">
            Checked, not war ({checkedSystems.length})
          </summary>
          <ul className="border-t border-eve-border/50 px-2.5 py-2 space-y-1.5 list-none m-0">
            {checkedSystems.map((w) => (
              <li key={w.systemId} className="text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="font-medium text-left hover:underline"
                    onClick={() => onSelectSystem(w.systemId)}
                  >
                    {w.systemName}
                  </button>
                  <a
                    href={w.zkillUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link link-hover opacity-70"
                  >
                    zKill
                  </a>
                </div>
                <p className="opacity-60">{w.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {openTheater && openTheaterBase ? (
        <WarTheaterModal
          theater={openTheater}
          enrichmentSource={openTheaterBase}
          onTheaterEnriched={handleTheaterEnriched}
          onClose={() => {
            setOpenTheaterId(null)
            onClearWarTheaterFocus()
          }}
          onFocusSystem={onSelectSystem}
          onFocusTheater={onFocusWarTheater}
        />
      ) : null}
    </section>
  )
}

function TheaterRow({
  theater,
  selected,
  onOpen,
  manufacturingSystemId,
  factoryName,
}: {
  theater: WarTheater
  selected: boolean
  onOpen: () => void
  manufacturingSystemId: number
  factoryName: string | null
}) {
  const title =
    theater.systemNames.length > 1
      ? `${theater.focalSystemName} +${theater.systemNames.length - 1}`
      : theater.focalSystemName
  const hubName = theater.nearestHubId
    ? (HUBS.find((h) => h.id === theater.nearestHubId)?.name ?? theater.nearestHubId)
    : null
  const restockLabel =
    theater.nearestHubSystemId === manufacturingSystemId && factoryName
      ? factoryName
      : hubName
  const lastActivity = useTheaterLastActivity(theater)

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
          selected
            ? 'border-fuchsia-400/50 bg-fuchsia-500/10'
            : 'border-eve-border/70 bg-base-300/45 hover:border-eve-border hover:bg-base-300/70'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TheaterCorpIcons kills={theater.kills} size={18} />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{title}</p>
              <WarTheaterMiniSummary theater={theater} />
              {restockLabel ? (
                <p className="text-[10px] opacity-50 truncate mt-0.5">
                  via {restockLabel}
                  {theater.nearestHubJumps !== null ? ` · ${theater.nearestHubJumps}j` : ''}
                </p>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {lastActivity ? (
              <p className="text-[10px] opacity-55 tabular-nums">{lastActivity}</p>
            ) : null}
            <span className="text-[10px] opacity-50">Details</span>
          </div>
        </div>
      </button>
    </li>
  )
}
