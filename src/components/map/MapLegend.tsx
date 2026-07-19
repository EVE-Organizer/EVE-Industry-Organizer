import { useState } from 'react'
import type { MapLayers } from '@/types/map'

interface MapLegendProps {
  layers: MapLayers
  warCount: number
  campCount: number
  haulInJumps: number
  haulOutJumps: number
}

const SECURITY_ITEMS = [
  { label: 'High', color: '#22c55e' },
  { label: 'Low', color: '#f59e0b' },
  { label: 'Null', color: '#ef4444' },
] as const

const LINE_ITEMS = [
  {
    key: 'jumps',
    color: 'rgba(148, 163, 184, 0.7)',
    width: 2,
    dash: [] as number[],
    label: 'Gate jumps',
    layer: 'security' as const,
  },
  {
    key: 'buy',
    color: 'rgba(96, 165, 250, 0.9)',
    width: 3,
    dash: [] as number[],
    label: 'Buy route',
    layer: 'haulCorridor' as const,
    suffix: (j: number) => `${j}j`,
  },
  {
    key: 'sell',
    color: 'rgba(250, 204, 21, 0.95)',
    width: 3.5,
    dash: [] as number[],
    label: 'Sell route',
    layer: 'haulCorridor' as const,
    suffix: (j: number) => `${j}j`,
  },
  {
    key: 'war',
    color: 'rgba(168, 85, 247, 0.7)',
    width: 2,
    dash: [4, 4] as number[],
    label: 'War to restock hub',
    layer: 'war' as const,
  },
] as const

const LEGEND_PANEL_CLASS =
  'rounded-lg border border-eve-border/40 bg-base-200/20 backdrop-blur-lg shadow-lg overflow-hidden'
const LEGEND_COLLAPSED_CLASS =
  'border-eve-border/40 bg-base-200/20 backdrop-blur-lg shadow-lg'

export function MapLegend({
  layers,
  warCount,
  campCount,
  haulInJumps,
  haulOutJumps,
}: MapLegendProps) {
  const [open, setOpen] = useState(true)
  const visibleLines = LINE_ITEMS.filter((item) => layers[item.layer])

  if (!open) {
    return (
      <button
        type="button"
        className={`btn btn-xs btn-outline absolute bottom-3 left-3 z-10 ${LEGEND_COLLAPSED_CLASS}`}
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-label="Show map legend"
      >
        Legend
      </button>
    )
  }

  return (
    <div
      className={`absolute bottom-3 left-3 z-10 max-w-[min(18rem,calc(100%-5rem))] px-2.5 py-2 text-[11px] ${LEGEND_PANEL_CLASS}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-50">Map key</p>
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square min-h-0 h-5 w-5 -mt-0.5 -mr-1 opacity-60 hover:opacity-100"
          onClick={() => setOpen(false)}
          aria-label="Hide map legend"
        >
          ×
        </button>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-50 mb-1.5">Markers</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <LegendRow emoji="🏭" color="#38bdf8" label="Your factory" />
        {layers.tradeHubs ? <LegendRow emoji="🏪" color="#e2e8f0" label="Trade hub" /> : null}
        {layers.war ? (
          <LegendRow emoji="⚔️" color="#a855f7" label={`War zone (${warCount})`} />
        ) : null}
        {layers.gateCamp ? (
          <LegendRow emoji="⚠️" color="#f97316" label={`Route danger (${campCount})`} />
        ) : null}
        {layers.volumeSpike ? (
          <LegendRow emoji="📈" color="#fbbf24" label="Volume spike hub" />
        ) : null}
      </div>

      {visibleLines.length > 0 ? (
        <div className="mt-2 pt-2 border-t border-eve-border/35">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-50 mb-1.5">Lines</p>
          <div className="flex flex-col gap-1.5">
            {visibleLines.map((item) => {
              let label = item.label
              if (item.key === 'buy' && 'suffix' in item) label += ` (${item.suffix(haulInJumps)})`
              if (item.key === 'sell' && 'suffix' in item) label += ` (${item.suffix(haulOutJumps)})`
              return (
                <LegendLine
                  key={item.key}
                  color={item.color}
                  width={item.width}
                  dash={item.dash}
                  label={label}
                  arrow={item.key === 'buy' || item.key === 'sell'}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      {layers.security ? (
        <div className="mt-2 pt-2 border-t border-eve-border/35">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-50 mb-1.5">
            System dots (security)
          </p>
          <div className="flex gap-3">
            {SECURITY_ITEMS.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 text-[10px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LegendRow({
  emoji,
  color,
  label,
}: {
  emoji: string
  color: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <EmojiBadge emoji={emoji} color={color} />
      <span className="truncate opacity-85">{label}</span>
    </span>
  )
}

function LegendLine({
  color,
  width,
  dash,
  label,
  arrow = false,
}: {
  color: string
  width: number
  dash: number[]
  label: string
  arrow?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <svg width="28" height="10" viewBox="0 0 28 10" className="shrink-0" aria-hidden>
        <line
          x1="1"
          y1="5"
          x2={arrow ? 20 : 27}
          y2="5"
          stroke={color}
          strokeWidth={width}
          strokeDasharray={dash.length > 0 ? dash.join(' ') : undefined}
        />
        {arrow ? (
          <polygon points="22,5 18,2 18,8" fill={color} />
        ) : null}
      </svg>
      <span className="truncate opacity-85">{label}</span>
    </span>
  )
}

export function EmojiBadge({
  emoji,
  color,
  size = 20,
}: {
  emoji: string
  color: string
  size?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md leading-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size - 8),
        backgroundColor: `${color}22`,
        border: `1px solid ${color}55`,
      }}
    >
      {emoji}
    </span>
  )
}
