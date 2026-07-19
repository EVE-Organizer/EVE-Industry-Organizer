import type { ReactNode } from 'react'
import { EmojiBadge } from '@/components/map/MapLegend'
import { MAP_SYMBOL } from '@/components/map/mapMarkers'
import type { MapLayers } from '@/types/map'

interface MapLayersPanelProps {
  layers: MapLayers
  onChange: (layers: MapLayers) => void
  onClose?: () => void
  compact?: boolean
}

type LayerIconKind = 'emoji' | 'security' | 'haulLine'

const LAYER_ITEMS: {
  key: keyof MapLayers
  label: string
  hint: string
  color: string
  icon: LayerIconKind
  emoji?: string
  locked?: boolean
}[] = [
  {
    key: 'security',
    label: 'Security colors',
    hint: 'System sec coloring and gate lines',
    color: '#22c55e',
    icon: 'security',
    locked: true,
  },
  {
    key: 'war',
    label: 'War zones',
    hint: 'PvP theaters from zKill',
    color: '#a855f7',
    icon: 'emoji',
    emoji: MAP_SYMBOL.war,
  },
  {
    key: 'volumeSpike',
    label: 'Volume spikes',
    hint: 'Hubs with unusual sell volume',
    color: '#fbbf24',
    icon: 'emoji',
    emoji: MAP_SYMBOL.spike,
  },
  {
    key: 'gateCamp',
    label: 'Route danger',
    hint: 'Camps on buy and sell routes',
    color: '#f97316',
    icon: 'emoji',
    emoji: MAP_SYMBOL.danger,
  },
  {
    key: 'haulCorridor',
    label: 'Haul routes',
    hint: 'Factory to buy and sell hubs',
    color: '#60a5fa',
    icon: 'haulLine',
  },
  {
    key: 'tradeHubs',
    label: 'Trade hubs',
    hint: 'Jita, Amarr, Dodixie, Rens, Hek',
    color: '#e2e8f0',
    icon: 'emoji',
    emoji: MAP_SYMBOL.hub,
  },
]

const INACTIVE_COLOR = '#64748b'
const SECURITY_COLORS = ['#22c55e', '#f59e0b', '#ef4444'] as const

function LayerIcon({
  icon,
  emoji,
  color,
  active,
}: {
  icon: LayerIconKind
  emoji?: string
  color: string
  active: boolean
}) {
  if (icon === 'security') {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center gap-0.5 rounded-md"
        style={{
          width: 20,
          height: 20,
          backgroundColor: active ? `${color}22` : `${INACTIVE_COLOR}22`,
          border: `1px solid ${active ? `${color}55` : `${INACTIVE_COLOR}55`}`,
        }}
        aria-hidden
      >
        {SECURITY_COLORS.map((secColor) => (
          <span
            key={secColor}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: active ? secColor : INACTIVE_COLOR }}
          />
        ))}
      </span>
    )
  }

  if (icon === 'haulLine') {
    const buyColor = active ? 'rgba(96, 165, 250, 0.9)' : INACTIVE_COLOR
    const sellColor = active ? 'rgba(250, 204, 21, 0.95)' : INACTIVE_COLOR
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md"
        style={{
          width: 20,
          height: 20,
          backgroundColor: active ? `${color}22` : `${INACTIVE_COLOR}22`,
          border: `1px solid ${active ? `${color}55` : `${INACTIVE_COLOR}55`}`,
        }}
        aria-hidden
      >
        <svg width="14" height="10" viewBox="0 0 14 10">
          <line x1="1" y1="3" x2="11" y2="3" stroke={buyColor} strokeWidth="2" />
          <polygon points="12,3 9,1.5 9,4.5" fill={buyColor} />
          <line x1="1" y1="7" x2="11" y2="7" stroke={sellColor} strokeWidth="2" />
          <polygon points="12,7 9,5.5 9,8.5" fill={sellColor} />
        </svg>
      </span>
    )
  }

  return <EmojiBadge emoji={emoji!} color={active ? color : INACTIVE_COLOR} size={20} />
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="map-settings-section">
      <h3 className="map-settings-section__title">{title}</h3>
      {children}
    </section>
  )
}

export function MapLayersPanel({
  layers,
  onChange,
  onClose,
  compact = false,
}: MapLayersPanelProps) {
  const shellClass = compact
    ? 'map-settings-panel map-settings-panel--compact'
    : 'map-settings-panel'

  return (
    <aside className={shellClass}>
      <header className="map-settings-panel__header">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">Layers</h2>
          <p className="mt-0.5 text-[10px] leading-snug text-base-content/55">
            Map display layers
          </p>
        </div>
        {onClose ? (
          <button type="button" className="btn btn-xs btn-ghost btn-square shrink-0" onClick={onClose}>
            ×
          </button>
        ) : null}
      </header>

      <SettingsSection title="Map display">
        <ul className="map-settings-toggles">
          {LAYER_ITEMS.map(({ key, label, hint, color, icon, emoji, locked }) => {
            const active = layers[key]
            return (
              <li key={key}>
                <label
                  className={`map-settings-toggle${locked ? ' map-settings-toggle--locked' : ''}`}
                  title={hint}
                >
                  <span className="map-settings-toggle__main">
                    <LayerIcon icon={icon} emoji={emoji} color={color} active={active} />
                    <span className="map-settings-toggle__label">{label}</span>
                  </span>
                  {locked ? (
                    <span className="map-settings-toggle__locked">On</span>
                  ) : (
                    <input
                      type="checkbox"
                      className="toggle toggle-xs toggle-primary"
                      checked={active}
                      onChange={() => onChange({ ...layers, [key]: !active })}
                    />
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      </SettingsSection>
    </aside>
  )
}
