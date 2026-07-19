import type { HubId } from '@/types'
import { HUBS } from '@/types'
import type { MapLayers } from '@/types/map'
import { worldToScreen, computeMapMarkerSize, type MapBounds, type MapCamera, type MapSystemDraw } from '@/lib/galaxyMapProject'

/** Text-presentation symbols read cleaner at small marker sizes on the map canvas. */
export const MAP_SYMBOL = {
  factory: '🏭',
  hub: '🏪',
  spike: '📈',
  war: '\u2694\uFE0E',
  danger: '\u26A0\uFE0E',
} as const

/** Gap between icon bottom and the system junction point. */
export const MAP_MARKER_ICON_GAP = 2
/** Gap between junction point and label top. */
export const MAP_MARKER_LABEL_GAP = 6

export function markerIconCenterY(sy: number, markerSize: number): number {
  return sy - markerSize / 2 - MAP_MARKER_ICON_GAP
}

export interface MapMarker {
  systemId: number
  sx: number
  sy: number
  emoji: string
  color: string
  size: number
  label?: string
  labelOpacity?: number
  selected: boolean
}

interface BuildMapMarkersInput {
  systems: MapSystemDraw[]
  drawnSystemIds: Set<number>
  bounds: MapBounds
  width: number
  height: number
  camera: MapCamera
  layers: MapLayers
  manufacturingSystemId: number
  selectedSystemId: number | null
  warSystemIds: Set<number>
  campSystemIds: Set<number>
  spikeHubIds: Set<HubId>
  labelOpacity: number
  referenceScale: number
}

export function isEmojiMapMarker(
  system: MapSystemDraw,
  layers: MapLayers,
  manufacturingSystemId: number,
  warSystemIds: Set<number>,
  campSystemIds: Set<number>,
): boolean {
  const isYou = system.systemId === manufacturingSystemId
  const isHub = layers.tradeHubs && system.isHub
  const isWar = layers.war && warSystemIds.has(system.systemId)
  const isCamp = layers.gateCamp && campSystemIds.has(system.systemId)
  return isYou || isHub || isWar || isCamp
}

export function buildMapMarkers(input: BuildMapMarkersInput): MapMarker[] {
  const {
    systems,
    drawnSystemIds,
    bounds,
    width,
    height,
    camera,
    layers,
    manufacturingSystemId,
    selectedSystemId,
    warSystemIds,
    campSystemIds,
    spikeHubIds,
    labelOpacity,
    referenceScale,
  } = input

  const markers: MapMarker[] = []

  for (const system of systems) {
    if (!drawnSystemIds.has(system.systemId)) continue
    if (!isEmojiMapMarker(system, layers, manufacturingSystemId, warSystemIds, campSystemIds)) {
      continue
    }

    const { sx, sy } = worldToScreen(system.x, system.z, bounds, width, height, camera)
    const isYou = system.systemId === manufacturingSystemId
    const isSelected = system.systemId === selectedSystemId
    const isHub = layers.tradeHubs && system.isHub
    const isWar = layers.war && warSystemIds.has(system.systemId)
    const isCamp = layers.gateCamp && campSystemIds.has(system.systemId)
    const hub = HUBS.find((h) => h.marketSystemId === system.systemId)
    const hasSpike = hub && layers.volumeSpike && spikeHubIds.has(hub.id)

    let emoji: string = MAP_SYMBOL.hub
    let color = '#64748b'
    let size = 22
    let label: string | undefined

    if (isYou) {
      emoji = MAP_SYMBOL.factory
      color = '#38bdf8'
      size = computeMapMarkerSize(camera.scale, referenceScale, 24)
      label = system.name
    } else if (isWar) {
      emoji = MAP_SYMBOL.war
      color = '#a855f7'
      size = computeMapMarkerSize(camera.scale, referenceScale)
      label = system.name
    } else if (isCamp) {
      emoji = MAP_SYMBOL.danger
      color = '#f97316'
      size = computeMapMarkerSize(camera.scale, referenceScale)
      label = system.name
    } else if (isHub) {
      emoji = hasSpike ? MAP_SYMBOL.spike : MAP_SYMBOL.hub
      color = hasSpike ? '#fbbf24' : '#e2e8f0'
      size = computeMapMarkerSize(camera.scale, referenceScale)
      label = hub?.name ?? system.name
    }

    markers.push({
      systemId: system.systemId,
      sx,
      sy,
      emoji,
      color,
      size,
      label: label && (labelOpacity > 0 || isSelected) ? label : undefined,
      labelOpacity: isSelected ? 1 : labelOpacity,
      selected: isSelected,
    })
  }

  return markers
}
