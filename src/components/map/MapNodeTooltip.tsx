import type { MapNodeHoverDetail } from '@/components/map/mapNodeHover'

const BADGE_CLASS: Record<MapNodeHoverDetail['badges'][number]['tone'], string> = {
  default: 'bg-slate-500/20 text-slate-200 border-slate-400/30',
  info: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
  warning: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  danger: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30',
  success: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
}

interface MapNodeTooltipProps {
  detail: MapNodeHoverDetail
  x: number
  y: number
  containerWidth: number
  containerHeight: number
}

export function MapNodeTooltip({ detail, x, y, containerWidth, containerHeight }: MapNodeTooltipProps) {
  const width = 220
  const height = 96
  let left = x + 14
  let top = y - height - 10

  if (left + width > containerWidth - 8) left = x - width - 14
  if (left < 8) left = 8
  if (top < 8) top = y + 14
  if (top + height > containerHeight - 8) top = containerHeight - height - 8

  return (
    <div
      className="pointer-events-none absolute z-20 w-[13.75rem] rounded-lg border border-eve-border/80 bg-base-200/95 px-2.5 py-2 shadow-lg backdrop-blur map-node-tooltip-enter"
      style={{ left, top }}
      role="tooltip"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold truncate">{detail.name}</p>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] opacity-80">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: detail.securityColor }}
          />
          {detail.security.toFixed(2)}
        </span>
      </div>

      {detail.badges.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {detail.badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${BADGE_CLASS[badge.tone]}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {detail.lines.map((line) => (
        <p key={line} className="mt-1 text-[10px] opacity-75 leading-snug">
          {line}
        </p>
      ))}

      <p className="mt-1.5 text-[9px] opacity-45">Click to pin · double-click to recenter</p>
    </div>
  )
}
