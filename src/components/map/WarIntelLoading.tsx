import type { ReactNode } from 'react'
import type { WarIntelProgress } from '@/types/map'

interface WarIntelLoadingProps {
  active: boolean
  label?: string
  progress?: WarIntelProgress | null
  className?: string
  compact?: boolean
}

interface WarIntelLoadingOverlayProps {
  active: boolean
  children: ReactNode
  label?: string
  progress?: WarIntelProgress | null
}

export function warIntelProgressLabel(progress: WarIntelProgress): string {
  switch (progress.phase) {
    case 'kills':
      return 'Loading kill feed…'
    case 'systems':
      return progress.total > 0
        ? `Scanning systems (${progress.current}/${progress.total})`
        : 'Scanning systems…'
    case 'enrich':
      return progress.total > 0
        ? `Enriching kills (${progress.current}/${progress.total})`
        : 'Enriching kills…'
    case 'build':
      return 'Building theaters…'
  }
}

function warIntelPercent(progress: WarIntelProgress): number | null {
  if (progress.total <= 0) return null
  return Math.min(100, Math.round((progress.current / progress.total) * 100))
}

export function WarIntelLoading({
  active,
  label = 'Fetching war intel…',
  progress = null,
  className = '',
  compact = false,
}: WarIntelLoadingProps) {
  const displayLabel = progress ? warIntelProgressLabel(progress) : label
  const percent = progress ? warIntelPercent(progress) : null

  return (
    <div
      className={`war-intel-loading${active ? ' war-intel-loading--visible' : ''}${
        compact ? ' war-intel-loading--compact' : ''
      } ${className}`.trim()}
      aria-hidden={!active}
      aria-live="polite"
      role="status"
    >
      <div className="war-intel-loading__row">
        <span className="loading loading-spinner loading-xs text-fuchsia-400 shrink-0" />
        <span className="war-intel-loading__label">{displayLabel}</span>
        {percent != null ? (
          <span className="war-intel-loading__percent tabular-nums">{percent}%</span>
        ) : null}
      </div>
      <div className="war-intel-loading__track" aria-hidden>
        {percent != null ? (
          <div
            className="war-intel-loading__bar war-intel-loading__bar--determinate"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="war-intel-loading__bar" />
        )}
      </div>
    </div>
  )
}

export function WarIntelLoadingOverlay({
  active,
  children,
  label = 'Updating war intel…',
  progress = null,
}: WarIntelLoadingOverlayProps) {
  return (
    <div
      className={`war-intel-loading-overlay${active ? ' war-intel-loading-overlay--active' : ''}`}
    >
      {children}
      <div className="war-intel-loading-overlay__veil" aria-hidden={!active}>
        <WarIntelLoading active={active} label={label} progress={progress} compact />
      </div>
    </div>
  )
}

export function WarIntelSkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="war-intel-skeleton" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="war-intel-skeleton__row" />
      ))}
    </ul>
  )
}
