import { useEffect, useMemo, useState } from 'react'
import { hubDisplayName } from '@/lib/hubDisplay'
import type { WarTheater } from '@/types/map'
import { formatIsk } from '@/lib/profit'
import { formatTheaterLastActivity } from '@/lib/warActivity'
import { DraggableWindow } from '@/components/DraggableWindow'
import { EmojiBadge } from '@/components/map/MapLegend'
import { useMapOverlayRoot } from '@/components/map/mapOverlayContext'
import { WarBattleReport } from '@/components/map/WarBattleReport'
import { TheaterCorpIcons } from '@/components/map/WarTheaterCorpIcons'

/** Wider than the stacked search/legend column so BR content has room. */
const WAR_MODAL_WIDTH_PX = 380
/** top-3 + search row + gap (matches DraggableWindow MAP_OVERLAY_TOP_PX). */
const WAR_MODAL_TOP_PX = 56
const WAR_MODAL_MARGIN_PX = 12

interface WarTheaterModalProps {
  theater: WarTheater
  enrichmentSource: WarTheater
  onClose: () => void
  onFocusSystem: (systemId: number) => void
  onFocusTheater?: (theater: WarTheater) => void
  onTheaterEnriched?: (theater: WarTheater) => void
}

export function WarTheaterModal({
  theater,
  enrichmentSource,
  onClose,
  onFocusSystem,
  onFocusTheater,
  onTheaterEnriched,
}: WarTheaterModalProps) {
  const overlayRoot = useMapOverlayRoot()
  const title =
    theater.systemNames.length > 1
      ? `${theater.focalSystemName} +${theater.systemNames.length - 1}`
      : theater.focalSystemName
  const hubName = theater.nearestHubId ? hubDisplayName(theater.nearestHubId) : null

  const defaultHeight = useMemo(() => {
    const hostH = overlayRoot?.clientHeight ?? 0
    if (hostH <= 0) return 560
    return Math.max(360, hostH - WAR_MODAL_TOP_PX - WAR_MODAL_MARGIN_PX)
  }, [overlayRoot])

  return (
    <DraggableWindow
      key={theater.id}
      title={title}
      subtitle="War theater · drag title bar to move"
      icon={<TheaterCorpIcons kills={theater.kills} size={22} />}
      onClose={onClose}
      onFocus={() => {
        if (onFocusTheater) onFocusTheater(theater)
        else onFocusSystem(theater.focalSystemId)
      }}
      focusLabel={`Focus ${theater.focalSystemName} on map`}
      variant="mapOverlay"
      overlayPlacement="topLeftStack"
      portalRoot={overlayRoot}
      translucent
      defaultWidth={WAR_MODAL_WIDTH_PX}
      defaultHeight={defaultHeight}
      minWidth={300}
      minHeight={240}
    >
      <div className="flex flex-col min-h-0 h-full">
        <div className="px-3 py-2.5 space-y-2.5 text-base-content/90 min-h-0 flex-1 overflow-y-auto">
          <div className="rounded-lg border border-eve-border/30 bg-base-200/10 px-2.5 py-2">
          <p className="text-[11px] leading-snug text-base-content/85">{theater.reason}</p>
          {hubName ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[10px] opacity-60">
              <EmojiBadge emoji="🏪" color="#94a3b8" size={16} />
              Nearest hub {hubName}
              {theater.nearestHubJumps !== null ? ` · ${theater.nearestHubJumps}j` : ''}
            </p>
            ) : null}
          </div>

          <WarBattleReport
            theater={theater}
            enrichmentSource={enrichmentSource}
            onSelectSystem={onFocusSystem}
            onTheaterEnriched={onTheaterEnriched}
          />
        </div>
      </div>
    </DraggableWindow>
  )
}

/** Relative time since the theater's latest enriched kill. */
export function useTheaterLastActivity(theater: WarTheater): string | null {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return formatTheaterLastActivity(theater.kills, nowMs)
}

/** Tiny one-line preview used outside the modal. */
export function WarTheaterMiniSummary({ theater }: { theater: WarTheater }) {
  return (
    <p className="text-[10px] opacity-70 tabular-nums truncate">
      {theater.fleetKills} kills · {formatIsk(theater.iskDestroyed)}
      {theater.systemNames.length > 1 ? ` · ${theater.systemNames.length} systems` : ''}
    </p>
  )
}
