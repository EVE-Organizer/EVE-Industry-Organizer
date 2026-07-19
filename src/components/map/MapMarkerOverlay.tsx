import { EmojiBadge } from '@/components/map/MapLegend'
import type { MapMarker } from '@/components/map/mapMarkers'

interface MapMarkerOverlayProps {
  markers: MapMarker[]
  hoveredSystemId: number | null
}

export function MapMarkerOverlay({ markers, hoveredSystemId }: MapMarkerOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-visible" aria-hidden>
      {markers.map((marker) => {
        const hovered = marker.systemId === hoveredSystemId
        return (
          <div
            key={marker.systemId}
            className="absolute"
            style={{
              left: marker.sx,
              top: marker.sy,
              ['--marker-color' as string]: marker.color,
            }}
          >
            <div
              className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 ${hovered ? 'map-marker--hovered' : ''}`}
            >
              <span className="map-marker__badge origin-center">
                <EmojiBadge emoji={marker.emoji} color={marker.color} size={marker.size} />
              </span>
            </div>
            {marker.label ? (
              <span
                className="absolute left-0 max-w-[6rem] -translate-x-1/2 truncate rounded px-1 py-0.5 text-[9px] font-medium text-slate-200 bg-black/50"
                style={{
                  top: marker.size / 2 + 4,
                  opacity: marker.labelOpacity ?? 1,
                }}
              >
                {marker.label}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
