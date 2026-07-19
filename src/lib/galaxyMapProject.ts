import type { MapSystem } from '@/types/map'

export interface MapCamera {
  offsetX: number
  offsetY: number
  scale: number
  /** Radians; 0 = default north-up orientation. */
  rotation: number
}

export interface MapBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function computeMapBounds(systems: MapSystem[]): MapBounds {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const s of systems) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.z < minZ) minZ = s.z
    if (s.z > maxZ) maxZ = s.z
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }
  }
  return { minX, maxX, minZ, maxZ }
}

function mapBaseScale(bounds: MapBounds, width: number, height: number): number {
  const rangeX = bounds.maxX - bounds.minX || 1
  const rangeZ = bounds.maxZ - bounds.minZ || 1
  return Math.min(width / rangeX, height / rangeZ)
}

function mapGalaxyCenter(bounds: MapBounds): { cx: number; cz: number } {
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cz: (bounds.minZ + bounds.maxZ) / 2,
  }
}

function worldDeltaToScreen(
  dx: number,
  dz: number,
  scale: number,
  rotation: number,
): { rx: number; ry: number } {
  const sx = dx * scale
  // CCP 2D map: Yimg = -Yeve (position2D.y stored as z); north (+z) points up.
  const sy = -dz * scale
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return {
    rx: sx * cos - sy * sin,
    ry: sx * sin + sy * cos,
  }
}

function screenDeltaToWorld(
  rx: number,
  ry: number,
  scale: number,
  rotation: number,
): { dx: number; dz: number } {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const sx = rx * cos + ry * sin
  const sy = -rx * sin + ry * cos
  return { dx: sx / scale, dz: -sy / scale }
}

export const MAP_ROTATE_STEP_RAD = Math.PI / 12

export function normalizeMapRotation(rotation: number): number {
  const tau = Math.PI * 2
  let r = rotation % tau
  if (r > Math.PI) r -= tau
  if (r < -Math.PI) r += tau
  return r
}

export function rotateMapCamera(
  camera: MapCamera,
  bounds: MapBounds,
  width: number,
  height: number,
  deltaRadians: number,
): MapCamera {
  const pivotSx = width / 2
  const pivotSy = height / 2
  const anchor = screenToWorld(pivotSx, pivotSy, bounds, width, height, camera)
  const rotation = normalizeMapRotation(camera.rotation + deltaRadians)
  const next = { ...camera, rotation }
  const after = worldToScreen(anchor.x, anchor.z, bounds, width, height, next)
  return {
    ...next,
    offsetX: camera.offsetX + pivotSx - after.sx,
    offsetY: camera.offsetY + pivotSy - after.sy,
  }
}

export function worldToScreen(
  x: number,
  z: number,
  bounds: MapBounds,
  width: number,
  height: number,
  camera: MapCamera,
): { sx: number; sy: number } {
  const scale = mapBaseScale(bounds, width, height) * camera.scale
  const { cx, cz } = mapGalaxyCenter(bounds)
  const { rx, ry } = worldDeltaToScreen(x - cx, z - cz, scale, camera.rotation)
  return {
    sx: width / 2 + rx + camera.offsetX,
    sy: height / 2 + ry + camera.offsetY,
  }
}

export function screenToWorld(
  sx: number,
  sy: number,
  bounds: MapBounds,
  width: number,
  height: number,
  camera: MapCamera,
): { x: number; z: number } {
  const scale = mapBaseScale(bounds, width, height) * camera.scale
  const { cx, cz } = mapGalaxyCenter(bounds)
  const { dx, dz } = screenDeltaToWorld(
    sx - width / 2 - camera.offsetX,
    sy - height / 2 - camera.offsetY,
    scale,
    camera.rotation,
  )
  return { x: cx + dx, z: cz + dz }
}

export function securityColor(security: number): string {
  if (security >= 0.5) return '#22c55e'
  if (security > 0) return '#f59e0b'
  return '#ef4444'
}

export function hitTestSystem(
  systems: MapSystem[],
  bounds: MapBounds,
  width: number,
  height: number,
  camera: MapCamera,
  sx: number,
  sy: number,
  radius = 8,
): MapSystem | null {
  let best: { system: MapSystem; dist: number } | null = null
  for (const system of systems) {
    const { sx: px, sy: py } = worldToScreen(system.x, system.z, bounds, width, height, camera)
    const dist = Math.hypot(px - sx, py - sy)
    const hitRadius = radius
    if (dist <= hitRadius && (!best || dist < best.dist)) {
      best = { system, dist }
    }
  }
  return best?.system ?? null
}

// Extend MapSystem with optional hubId for hit test - we'll pass enriched systems
export type MapSystemDraw = MapSystem & { hubId?: string; isHub?: boolean }

export function hitTestSystemDraw(
  systems: MapSystemDraw[],
  bounds: MapBounds,
  width: number,
  height: number,
  camera: MapCamera,
  sx: number,
  sy: number,
  radius = 8,
): MapSystemDraw | null {
  let best: { system: MapSystemDraw; dist: number } | null = null
  for (const system of systems) {
    const { sx: px, sy: py } = worldToScreen(system.x, system.z, bounds, width, height, camera)
    const dist = Math.hypot(px - sx, py - sy)
    const hitRadius = system.isHub ? radius * 2.5 : radius
    if (dist <= hitRadius && (!best || dist < best.dist)) {
      best = { system, dist }
    }
  }
  return best?.system ?? null
}

export function isInViewport(
  sx: number,
  sy: number,
  width: number,
  height: number,
  margin = 20,
): boolean {
  return sx >= -margin && sy >= -margin && sx <= width + margin && sy <= height + margin
}

export function cameraCenteredOn(
  system: MapSystem,
  bounds: MapBounds,
  width: number,
  height: number,
  scale: number,
  rotation = 0,
): MapCamera {
  return cameraCenteredOnWorld(system.x, system.z, bounds, width, height, scale, rotation)
}

export function cameraCenteredOnWorld(
  x: number,
  z: number,
  bounds: MapBounds,
  width: number,
  height: number,
  scale: number,
  rotation = 0,
): MapCamera {
  const mapScale = mapBaseScale(bounds, width, height) * scale
  const { cx, cz } = mapGalaxyCenter(bounds)
  const { rx, ry } = worldDeltaToScreen(x - cx, z - cz, mapScale, rotation)
  return {
    scale,
    rotation,
    offsetX: -rx,
    offsetY: -ry,
  }
}

/** Camera scale that frames a set of systems with padding. */
export function computeSystemsFrameScale(
  systems: { x: number; z: number }[],
  bounds: MapBounds,
  width: number,
  height: number,
  padding = 0.72,
): number {
  if (systems.length <= 1) return 40

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const s of systems) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.z < minZ) minZ = s.z
    if (s.z > maxZ) maxZ = s.z
  }

  const baseScale = baseMapScale(bounds, width, height)
  const regionW = Math.max(maxX - minX, 1)
  const regionH = Math.max(maxZ - minZ, 1)
  const fitScale = Math.min(width / regionW, height / regionH) / baseScale
  return clampMapScale(fitScale * padding)
}

/** Center and zoom the map to show all given systems. */
export function cameraFramingSystems(
  systems: { x: number; z: number }[],
  bounds: MapBounds,
  width: number,
  height: number,
  padding = 0.72,
  rotation = 0,
): MapCamera {
  if (systems.length === 0) {
    return { scale: 25, rotation: 0, offsetX: 0, offsetY: 0 }
  }

  const cx = systems.reduce((sum, s) => sum + s.x, 0) / systems.length
  const cz = systems.reduce((sum, s) => sum + s.z, 0) / systems.length
  const scale = computeSystemsFrameScale(systems, bounds, width, height, padding)
  return cameraCenteredOnWorld(cx, cz, bounds, width, height, scale, rotation)
}

/** Scale 1 fits the entire galaxy in the viewport. */
export const MAP_MIN_SCALE = 0.5
export const MAP_MAX_SCALE = 400
export const DEFAULT_REGION_JUMP_RADIUS = 12

export function baseMapScale(bounds: MapBounds, width: number, height: number): number {
  return mapBaseScale(bounds, width, height)
}

/** Pick a camera scale that frames a local neighborhood around the center system. */
export function computeRegionalScale(
  centerSystem: MapSystem,
  neighborSystems: MapSystem[],
  bounds: MapBounds,
  width: number,
  height: number,
  padding = 0.85,
): number {
  if (neighborSystems.length <= 1) return 40

  let minX = centerSystem.x
  let maxX = centerSystem.x
  let minZ = centerSystem.z
  let maxZ = centerSystem.z
  for (const s of neighborSystems) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.z < minZ) minZ = s.z
    if (s.z > maxZ) maxZ = s.z
  }

  const baseScale = baseMapScale(bounds, width, height)
  const regionW = Math.max(maxX - minX, 1)
  const regionH = Math.max(maxZ - minZ, 1)
  const fitScale = Math.min(width / regionW, height / regionH) / baseScale
  return Math.min(MAP_MAX_SCALE, Math.max(MAP_MIN_SCALE, fitScale * padding))
}

export function clampMapScale(scale: number): number {
  return Math.min(MAP_MAX_SCALE, Math.max(MAP_MIN_SCALE, scale))
}

export const MAP_NODE_BASE_RADIUS = 2.5
export const MAP_NODE_MIN_RADIUS = 2
export const MAP_NODE_MAX_RADIUS = 8
export const MAP_MARKER_BASE_SIZE = 22
export const MAP_MARKER_MIN_SIZE = 18
export const MAP_MARKER_MAX_SIZE = 26
/** Label opacity reaches 1 at this zoom level (1000% = 10× regional view). */
export const MAP_LABEL_FULL_ZOOM_PERCENT = 1000
/** Labels begin fading in above this zoom level. */
export const MAP_LABEL_START_ZOOM_PERCENT = 280

export function computeMapZoomFactor(cameraScale: number, referenceScale: number): number {
  const ref = Math.max(referenceScale, MAP_MIN_SCALE)
  return cameraScale / ref
}

export function computeMapZoomPercent(cameraScale: number, referenceScale: number): number {
  return computeMapZoomFactor(cameraScale, referenceScale) * 100
}

/** Sublinear growth keeps nodes readable without dominating the map at high zoom. */
function computeMapVisualScale(cameraScale: number, referenceScale: number): number {
  return Math.sqrt(computeMapZoomFactor(cameraScale, referenceScale))
}

/** Dot radius in screen pixels; grows gently as the user zooms in. */
export function computeMapNodeRadius(
  cameraScale: number,
  referenceScale: number,
  emphasis = 1,
): number {
  const radius = MAP_NODE_BASE_RADIUS * computeMapVisualScale(cameraScale, referenceScale) * emphasis
  return Math.min(MAP_NODE_MAX_RADIUS, Math.max(MAP_NODE_MIN_RADIUS, radius))
}

/** Emoji marker size in screen pixels; tracks zoom like node dots. */
export function computeMapMarkerSize(
  cameraScale: number,
  referenceScale: number,
  baseSize = MAP_MARKER_BASE_SIZE,
): number {
  const size = baseSize * computeMapVisualScale(cameraScale, referenceScale)
  return Math.min(MAP_MARKER_MAX_SIZE, Math.max(MAP_MARKER_MIN_SIZE, size))
}

export function computeMapLabelOpacityFromZoom(zoomPercent: number): number {
  if (zoomPercent < MAP_LABEL_START_ZOOM_PERCENT) return 0
  if (zoomPercent >= MAP_LABEL_FULL_ZOOM_PERCENT) return 1
  return (
    (zoomPercent - MAP_LABEL_START_ZOOM_PERCENT) /
    (MAP_LABEL_FULL_ZOOM_PERCENT - MAP_LABEL_START_ZOOM_PERCENT)
  )
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

function hasLabelSpacing(
  adjacency: ReadonlyMap<number, number[]>,
  drawnSystemIds: ReadonlySet<number>,
  drawnPositions: ReadonlyMap<number, { sx: number; sy: number }>,
  minNeighborPx: number,
): boolean {
  const neighborSpacings: number[] = []

  for (const systemId of drawnSystemIds) {
    const pos = drawnPositions.get(systemId)
    if (!pos) continue

    let minDist = Infinity
    for (const neighborId of adjacency.get(systemId) ?? []) {
      if (!drawnSystemIds.has(neighborId)) continue
      const neighborPos = drawnPositions.get(neighborId)
      if (!neighborPos) continue
      const dist = Math.hypot(neighborPos.sx - pos.sx, neighborPos.sy - pos.sy)
      if (dist < minDist) minDist = dist
    }

    if (Number.isFinite(minDist)) neighborSpacings.push(minDist)
  }

  const medianSpacing = median(neighborSpacings)
  if (medianSpacing !== null) return medianSpacing >= minNeighborPx

  if (drawnSystemIds.size === 1) return true

  const positions = [...drawnSystemIds]
    .map((id) => drawnPositions.get(id))
    .filter((pos): pos is { sx: number; sy: number } => pos != null)

  if (positions.length < 2) return false

  let minPairDist = Infinity
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dist = Math.hypot(positions[j]!.sx - positions[i]!.sx, positions[j]!.sy - positions[i]!.sy)
      if (dist < minPairDist) minPairDist = dist
    }
  }

  return Number.isFinite(minPairDist) && minPairDist >= minNeighborPx
}

/**
 * Label opacity from 0 to 1 based on zoom, gated by neighbor spacing.
 */
export function computeMapLabelOpacity(
  cameraScale: number,
  referenceScale: number,
  adjacency: ReadonlyMap<number, number[]>,
  drawnSystemIds: ReadonlySet<number>,
  drawnPositions: ReadonlyMap<number, { sx: number; sy: number }>,
): number {
  const zoomOpacity = computeMapLabelOpacityFromZoom(computeMapZoomPercent(cameraScale, referenceScale))
  if (zoomOpacity <= 0) return 0

  const nodeRadius = computeMapNodeRadius(cameraScale, referenceScale)
  const minNeighborPx = nodeRadius * 2 + 14
  if (!hasLabelSpacing(adjacency, drawnSystemIds, drawnPositions, minNeighborPx)) return 0

  return zoomOpacity
}
