import { describe, expect, it } from 'vitest'
import {
  MAP_LABEL_FULL_ZOOM_PERCENT,
  MAP_LABEL_START_ZOOM_PERCENT,
  MAP_MAX_SCALE,
  MAP_MIN_SCALE,
  MAP_NODE_BASE_RADIUS,
  MAP_NODE_MAX_RADIUS,
  baseMapScale,
  clampMapScale,
  cameraFramingSystems,
  computeMapLabelOpacity,
  computeMapLabelOpacityFromZoom,
  computeMapNodeRadius,
  computeRegionalScale,
  rotateMapCamera,
  screenToWorld,
  worldToScreen,
  type MapBounds,
} from './galaxyMapProject'
import type { MapSystem } from '@/types/map'

const bounds: MapBounds = {
  minX: 0,
  maxX: 1000,
  minZ: 0,
  maxZ: 500,
}

const center: MapSystem = {
  systemId: 1,
  name: 'Center',
  regionId: 1,
  constellationId: 1,
  security: 0.5,
  x: 500,
  z: 250,
}

const referenceScale = 40

describe('computeRegionalScale', () => {
  it('returns a much higher scale than galaxy-fit for a local neighborhood', () => {
    const neighbors: MapSystem[] = [
      center,
      { ...center, systemId: 2, x: 520, z: 260 },
      { ...center, systemId: 3, x: 480, z: 240 },
    ]
    const regional = computeRegionalScale(center, neighbors, bounds, 800, 480)
    expect(regional).toBeGreaterThan(5)
    expect(regional).toBeLessThan(MAP_MAX_SCALE)
  })

  it('clamps to map scale limits', () => {
    expect(clampMapScale(0.1)).toBe(MAP_MIN_SCALE)
    expect(clampMapScale(999)).toBe(MAP_MAX_SCALE)
  })

  it('baseMapScale fits the full bounds box', () => {
    expect(baseMapScale(bounds, 800, 480)).toBeCloseTo(0.8)
  })
})

describe('computeMapNodeRadius', () => {
  it('grows gently with zoom and stays capped', () => {
    const atRegion = computeMapNodeRadius(referenceScale, referenceScale)
    const zoomedIn = computeMapNodeRadius(referenceScale * 10, referenceScale)

    expect(atRegion).toBeCloseTo(MAP_NODE_BASE_RADIUS)
    expect(zoomedIn).toBeGreaterThan(atRegion)
    expect(zoomedIn).toBeLessThanOrEqual(MAP_NODE_MAX_RADIUS)
  })
})

describe('computeMapLabelOpacityFromZoom', () => {
  it('is zero before the start zoom', () => {
    expect(computeMapLabelOpacityFromZoom(MAP_LABEL_START_ZOOM_PERCENT - 1)).toBe(0)
  })

  it('ramps to full opacity at 1000%', () => {
    expect(computeMapLabelOpacityFromZoom(MAP_LABEL_FULL_ZOOM_PERCENT)).toBe(1)
    expect(computeMapLabelOpacityFromZoom(640)).toBeCloseTo(0.5)
  })
})

describe('computeMapLabelOpacity', () => {
  const adjacency = new Map<number, number[]>([
    [1, [2]],
    [2, [1, 3]],
    [3, [2]],
  ])

  it('returns zero when zoom is too low', () => {
    const drawnSystemIds = new Set([1, 2, 3])
    const drawnPositions = new Map([
      [1, { sx: 0, sy: 0 }],
      [2, { sx: 80, sy: 0 }],
      [3, { sx: 160, sy: 0 }],
    ])

    expect(
      computeMapLabelOpacity(referenceScale, referenceScale, adjacency, drawnSystemIds, drawnPositions),
    ).toBe(0)
  })

  it('returns partial opacity between start and full zoom when spaced out', () => {
    const cameraScale = referenceScale * 5
    const drawnSystemIds = new Set([1, 2, 3])
    const drawnPositions = new Map([
      [1, { sx: 0, sy: 0 }],
      [2, { sx: 120, sy: 0 }],
      [3, { sx: 240, sy: 0 }],
    ])

    const opacity = computeMapLabelOpacity(
      cameraScale,
      referenceScale,
      adjacency,
      drawnSystemIds,
      drawnPositions,
    )
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThan(1)
  })

  it('returns full opacity at 1000% zoom for a single system', () => {
    const drawnSystemIds = new Set([1])
    const drawnPositions = new Map([[1, { sx: 100, sy: 100 }]])
    const cameraScale = referenceScale * (MAP_LABEL_FULL_ZOOM_PERCENT / 100)

    expect(
      computeMapLabelOpacity(cameraScale, referenceScale, adjacency, drawnSystemIds, drawnPositions),
    ).toBe(1)
  })
})

describe('map rotation', () => {
  const width = 800
  const height = 480
  const camera = { offsetX: 12, offsetY: -8, scale: 20, rotation: Math.PI / 6 }

  it('round-trips world and screen coordinates', () => {
    const world = { x: 120, z: 45 }
    const screen = worldToScreen(world.x, world.z, bounds, width, height, camera)
    const back = screenToWorld(screen.sx, screen.sy, bounds, width, height, camera)
    expect(back.x).toBeCloseTo(world.x, 4)
    expect(back.z).toBeCloseTo(world.z, 4)
  })

  it('keeps the viewport center anchored when rotating', () => {
    const pivot = { sx: width / 2, sy: height / 2 }
    const before = screenToWorld(pivot.sx, pivot.sy, bounds, width, height, camera)
    const rotated = rotateMapCamera(camera, bounds, width, height, Math.PI / 4)
    const after = screenToWorld(pivot.sx, pivot.sy, bounds, width, height, rotated)
    expect(after.x).toBeCloseTo(before.x, 3)
    expect(after.z).toBeCloseTo(before.z, 3)
  })

  it('places higher z (space north) above center at rotation 0', () => {
    const { cx, cz } = { cx: 500, cz: 250 }
    const north = worldToScreen(cx, cz + 50, bounds, width, height, {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    })
    const center = worldToScreen(cx, cz, bounds, width, height, {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    })
    expect(north.sy).toBeLessThan(center.sy)
  })
})

describe('cameraFramingSystems', () => {
  it('centers on the midpoint and zooms to fit spread systems', () => {
    const systems: MapSystem[] = [
      { ...center, systemId: 1, x: 400, z: 200 },
      { ...center, systemId: 2, x: 600, z: 300 },
    ]
    const camera = cameraFramingSystems(systems, bounds, 800, 480, 0.72, 0)
    expect(camera.scale).toBeGreaterThan(2)
    const mid = worldToScreen(500, 250, bounds, 800, 480, camera)
    expect(mid.sx).toBeCloseTo(400, 0)
    expect(mid.sy).toBeCloseTo(240, 0)
  })
})
