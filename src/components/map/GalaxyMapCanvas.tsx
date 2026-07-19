import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HubId } from '@/types'
import { HUBS } from '@/types'
import type { MapData, MapGraph, MapLayers, WarActivityResult, WarTheater } from '@/types/map'
import {
  cameraCenteredOn,
  cameraFramingSystems,
  clampMapScale,
  computeMapBounds,
  computeMapLabelOpacity,
  computeMapMarkerSize,
  computeMapNodeRadius,
  computeMapZoomPercent,
  computeRegionalScale,
  MAP_ROTATE_STEP_RAD,
  rotateMapCamera,
  DEFAULT_REGION_JUMP_RADIUS,
  hitTestSystemDraw,
  isInViewport,
  screenToWorld,
  securityColor,
  worldToScreen,
  type MapCamera,
  type MapSystemDraw,
} from '@/lib/galaxyMapProject'
import { systemsWithinJumps } from '@/lib/nearestPublicHub'
import { drawWarTheaterOutline } from '@/lib/warTheaterOutline'
import { buildMapMarkers, isEmojiMapMarker } from '@/components/map/mapMarkers'
import { MapMarkerOverlay } from '@/components/map/MapMarkerOverlay'
import { MapNodeTooltip } from '@/components/map/MapNodeTooltip'
import { buildMapNodeHoverDetail } from '@/components/map/mapNodeHover'

export interface GalaxyMapCanvasProps {
  mapData: MapData
  graph: MapGraph
  layers: MapLayers
  centerSystemId: number
  manufacturingSystemId: number
  selectedSystemId: number | null
  warResults: WarActivityResult[]
  warTheaters?: WarTheater[]
  haulInRoute: number[]
  haulOutRoute: number[]
  campSystemIds: Set<number>
  spikeHubIds: Set<HubId>
  recenterToken: number
  focusedWarTheaterId?: string | null
  warTheaterFocusToken?: number
  onSelectSystem: (systemId: number) => void
  onRecenter: (systemId: number) => void
  onResetView?: () => void
  className?: string
}

const DEFAULT_SCALE = 25

export function GalaxyMapCanvas({
  mapData,
  graph,
  layers,
  centerSystemId,
  manufacturingSystemId,
  selectedSystemId,
  warResults,
  warTheaters = [],
  haulInRoute,
  haulOutRoute,
  campSystemIds,
  spikeHubIds,
  recenterToken,
  focusedWarTheaterId = null,
  warTheaterFocusToken = 0,
  onSelectSystem,
  onRecenter,
  onResetView,
  className,
}: GalaxyMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 480 })
  const [camera, setCamera] = useState<MapCamera>({
    offsetX: 0,
    offsetY: 0,
    scale: DEFAULT_SCALE,
    rotation: 0,
  })
  const [hoveredSystemId, setHoveredSystemId] = useState<number | null>(null)
  const [hoverPos, setHoverPos] = useState<{ sx: number; sy: number } | null>(null)
  const [hoverPulse, setHoverPulse] = useState(0)
  const [isRotating, setIsRotating] = useState(false)
  const dragRef = useRef<{ active: boolean; moved: boolean; lastX: number; lastY: number }>({
    active: false,
    moved: false,
    lastX: 0,
    lastY: 0,
  })
  const rotateDragRef = useRef<{ active: boolean; moved: boolean; lastAngle: number }>({
    active: false,
    moved: false,
    lastAngle: 0,
  })
  const lastCenterRef = useRef<number | null>(null)
  const lastRecenterTokenRef = useRef(recenterToken)
  const lastWarTheaterFocusTokenRef = useRef(warTheaterFocusToken)

  const bounds = useMemo(() => computeMapBounds(mapData.systems), [mapData.systems])

  const regionalScale = useMemo(() => {
    const sys = graph.systems.get(centerSystemId)
    if (!sys) return DEFAULT_SCALE
    const neighborIds = systemsWithinJumps(graph, centerSystemId, DEFAULT_REGION_JUMP_RADIUS)
    const neighbors = [...neighborIds]
      .map((id) => graph.systems.get(id))
      .filter((s): s is NonNullable<typeof s> => s != null)
    return computeRegionalScale(sys, neighbors, bounds, size.width, size.height)
  }, [graph, centerSystemId, bounds, size.width, size.height])

  const drawSystems = useMemo((): MapSystemDraw[] => {
    const hubIds = new Set(HUBS.map((h) => h.marketSystemId))
    return mapData.systems.map((s) => ({
      ...s,
      isHub: hubIds.has(s.systemId),
    }))
  }, [mapData.systems])

  const warSystemIds = useMemo(
    () => new Set(warResults.filter((w) => w.isWar).map((w) => w.systemId)),
    [warResults],
  )

  const warHubLinks = useMemo(() => {
    const links: { warId: number; hubId: number }[] = []
    for (const theater of warTheaters) {
      if (!theater.nearestHubSystemId) continue
      links.push({ warId: theater.focalSystemId, hubId: theater.nearestHubSystemId })
    }
    return links
  }, [warTheaters])

  const warTheaterLinks = useMemo(() => {
    const links: { a: number; b: number }[] = []
    for (const theater of warTheaters) {
      const ids = theater.systemIds
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          links.push({ a: ids[i]!, b: ids[j]! })
        }
      }
    }
    return links
  }, [warTheaters])

  const visibleSystemIds = useMemo(() => {
    const ids = new Set<number>()
    ids.add(centerSystemId)
    ids.add(manufacturingSystemId)
    if (selectedSystemId) ids.add(selectedSystemId)
    for (const hub of HUBS) ids.add(hub.marketSystemId)
    for (const id of haulInRoute) ids.add(id)
    for (const id of haulOutRoute) ids.add(id)
    for (const theater of warTheaters) {
      for (const id of theater.systemIds) ids.add(id)
      if (theater.nearestHubSystemId) ids.add(theater.nearestHubSystemId)
    }
    for (const id of campSystemIds) ids.add(id)
    return ids
  }, [
    centerSystemId,
    manufacturingSystemId,
    selectedSystemId,
    haulInRoute,
    haulOutRoute,
    warTheaters,
    campSystemIds,
  ])

  const visibleDrawState = useMemo(() => {
    const showAllSystems = camera.scale >= regionalScale * 0.4
    const drawnSystemIds = new Set<number>()
    const drawnPositions = new Map<number, { sx: number; sy: number }>()

    for (const system of drawSystems) {
      const pinned = visibleSystemIds.has(system.systemId)
      if (!pinned && !showAllSystems) continue
      const { sx, sy } = worldToScreen(system.x, system.z, bounds, size.width, size.height, camera)
      if (!isInViewport(sx, sy, size.width, size.height) && !pinned) continue
      drawnSystemIds.add(system.systemId)
      drawnPositions.set(system.systemId, { sx, sy })
    }

    return {
      drawnSystemIds,
      drawnPositions,
      nodeRadius: computeMapNodeRadius(camera.scale, regionalScale),
      labelOpacity: computeMapLabelOpacity(
        camera.scale,
        regionalScale,
        graph.adjacency,
        drawnSystemIds,
        drawnPositions,
      ),
    }
  }, [drawSystems, visibleSystemIds, bounds, size.width, size.height, camera, regionalScale, graph.adjacency])

  const mapMarkers = useMemo(
    () =>
      buildMapMarkers({
        systems: drawSystems,
        drawnSystemIds: visibleDrawState.drawnSystemIds,
        bounds,
        width: size.width,
        height: size.height,
        camera,
        layers,
        manufacturingSystemId,
        selectedSystemId,
        warSystemIds,
        campSystemIds,
        spikeHubIds,
        labelOpacity: visibleDrawState.labelOpacity,
        referenceScale: regionalScale,
      }),
    [
      drawSystems,
      visibleDrawState,
      bounds,
      size.width,
      size.height,
      camera,
      layers,
      manufacturingSystemId,
      selectedSystemId,
      warSystemIds,
      campSystemIds,
      spikeHubIds,
      regionalScale,
    ],
  )

  useEffect(() => {
    if (hoveredSystemId == null) return
    let frame = 0
    const tick = () => {
      setHoverPulse(performance.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [hoveredSystemId])

  const hoveredSystem = useMemo(
    () => (hoveredSystemId != null ? drawSystems.find((s) => s.systemId === hoveredSystemId) ?? null : null),
    [drawSystems, hoveredSystemId],
  )

  const hoverDetail = useMemo(() => {
    if (!hoveredSystem) return null
    return buildMapNodeHoverDetail({
      system: hoveredSystem,
      graph,
      layers,
      manufacturingSystemId,
      warResults,
      campSystemIds,
      haulInRoute,
      haulOutRoute,
      spikeHubIds,
    })
  }, [
    hoveredSystem,
    graph,
    layers,
    manufacturingSystemId,
    warResults,
    campSystemIds,
    haulInRoute,
    haulOutRoute,
    spikeHubIds,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(320, entry.contentRect.height),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const sys = graph.systems.get(centerSystemId)
    if (!sys) return
    const isInitial = lastCenterRef.current === null
    const forcedRecenter = lastRecenterTokenRef.current !== recenterToken
    lastCenterRef.current = centerSystemId
    lastRecenterTokenRef.current = recenterToken

    setCamera((c) => {
      const scale = isInitial || forcedRecenter ? regionalScale : c.scale || regionalScale
      return cameraCenteredOn(sys, bounds, size.width, size.height, scale, c.rotation ?? 0)
    })
  }, [centerSystemId, bounds, size.width, size.height, graph.systems, regionalScale, recenterToken])

  useEffect(() => {
    if (!focusedWarTheaterId || warTheaterFocusToken === 0) return
    if (lastWarTheaterFocusTokenRef.current === warTheaterFocusToken) return
    lastWarTheaterFocusTokenRef.current = warTheaterFocusToken

    const theater = warTheaters.find((t) => t.id === focusedWarTheaterId)
    if (!theater) return
    const systems = theater.systemIds
      .map((id) => graph.systems.get(id))
      .filter((s): s is NonNullable<typeof s> => s != null)
    if (systems.length === 0) return

    setCamera((c) =>
      cameraFramingSystems(systems, bounds, size.width, size.height, 0.68, c.rotation ?? 0),
    )
  }, [
    focusedWarTheaterId,
    warTheaterFocusToken,
    warTheaters,
    graph.systems,
    bounds,
    size.width,
    size.height,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      setCamera((c) => {
        const nextScale = clampMapScale(c.scale * factor)
        const world = screenToWorld(sx, sy, bounds, size.width, size.height, c)
        const after = worldToScreen(world.x, world.z, bounds, size.width, size.height, {
          ...c,
          scale: nextScale,
        })
        return {
          ...c,
          scale: nextScale,
          offsetX: c.offsetX + (sx - after.sx),
          offsetY: c.offsetY + (sy - after.sy),
        }
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [bounds, size.width, size.height])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const bg = ctx.createLinearGradient(0, 0, size.width, size.height)
    bg.addColorStop(0, '#0b1016')
    bg.addColorStop(1, '#111827')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size.width, size.height)

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.18)'
    ctx.lineWidth = 1
    const gridStep = 48
    for (let x = 0; x < size.width; x += gridStep) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size.height)
      ctx.stroke()
    }
    for (let y = 0; y < size.height; y += gridStep) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size.width, y)
      ctx.stroke()
    }

    const drawDirectedEdge = (
      from: number,
      to: number,
      color: string,
      width: number,
      dash: number[] = [],
      glow = false,
    ) => {
      const a = graph.systems.get(from)
      const b = graph.systems.get(to)
      if (!a || !b) return
      const p1 = worldToScreen(a.x, a.z, bounds, size.width, size.height, camera)
      const p2 = worldToScreen(b.x, b.z, bounds, size.width, size.height, camera)
      if (!isInViewport(p1.sx, p1.sy, size.width, size.height) &&
          !isInViewport(p2.sx, p2.sy, size.width, size.height)) {
        return
      }
      if (glow) {
        ctx.beginPath()
        ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.25)')
        ctx.lineWidth = width + 4
        ctx.setLineDash(dash)
        ctx.moveTo(p1.sx, p1.sy)
        ctx.lineTo(p2.sx, p2.sy)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.setLineDash(dash)
      ctx.moveTo(p1.sx, p1.sy)
      ctx.lineTo(p2.sx, p2.sy)
      ctx.stroke()
      ctx.setLineDash([])

      const angle = Math.atan2(p2.sy - p1.sy, p2.sx - p1.sx)
      const head = 7
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.moveTo(p2.sx, p2.sy)
      ctx.lineTo(
        p2.sx - head * Math.cos(angle - Math.PI / 6),
        p2.sy - head * Math.sin(angle - Math.PI / 6),
      )
      ctx.lineTo(
        p2.sx - head * Math.cos(angle + Math.PI / 6),
        p2.sy - head * Math.sin(angle + Math.PI / 6),
      )
      ctx.closePath()
      ctx.fill()
    }

    const drawEdge = (from: number, to: number, color: string, width: number, dash: number[] = []) => {
      const a = graph.systems.get(from)
      const b = graph.systems.get(to)
      if (!a || !b) return
      const p1 = worldToScreen(a.x, a.z, bounds, size.width, size.height, camera)
      const p2 = worldToScreen(b.x, b.z, bounds, size.width, size.height, camera)
      if (!isInViewport(p1.sx, p1.sy, size.width, size.height) &&
          !isInViewport(p2.sx, p2.sy, size.width, size.height)) {
        return
      }
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.setLineDash(dash)
      ctx.moveTo(p1.sx, p1.sy)
      ctx.lineTo(p2.sx, p2.sy)
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (layers.haulCorridor) {
      for (let i = 0; i < haulInRoute.length - 1; i++) {
        drawDirectedEdge(haulInRoute[i]!, haulInRoute[i + 1]!, 'rgba(96, 165, 250, 0.85)', 2.5, [], true)
      }
      for (let i = 0; i < haulOutRoute.length - 1; i++) {
        drawDirectedEdge(haulOutRoute[i]!, haulOutRoute[i + 1]!, 'rgba(250, 204, 21, 0.95)', 3.5, [], true)
      }
    }

    if (layers.war) {
      const markerPad = computeMapMarkerSize(camera.scale, regionalScale) / 2 + 22
      for (const theater of warTheaters) {
        if (theater.systemIds.length < 2) continue
        const pointById = new Map<number, { x: number; y: number }>()
        for (const systemId of theater.systemIds) {
          const sys = graph.systems.get(systemId)
          if (!sys) continue
          const { sx, sy } = worldToScreen(sys.x, sys.z, bounds, size.width, size.height, camera)
          pointById.set(systemId, { x: sx, y: sy })
        }
        const points = [...pointById.values()]
        if (points.length < 2) continue

        const connections: [{ x: number; y: number }, { x: number; y: number }][] = []
        const ids = theater.systemIds.filter((id) => pointById.has(id))
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const a = pointById.get(ids[i]!)
            const b = pointById.get(ids[j]!)
            if (a && b) connections.push([a, b])
          }
        }

        drawWarTheaterOutline(ctx, points, {
          padding: markerPad,
          connections,
          highlight: theater.id === focusedWarTheaterId,
        })
      }

      for (const link of warTheaterLinks) {
        drawEdge(link.a, link.b, 'rgba(168, 85, 247, 0.45)', 1.5)
      }
      for (const link of warHubLinks) {
        drawEdge(link.warId, link.hubId, 'rgba(168, 85, 247, 0.35)', 1, [4, 6])
      }
    }

    if (layers.security || layers.tradeHubs) {
      const { drawnSystemIds, drawnPositions, labelOpacity, nodeRadius } = visibleDrawState

      if (drawnSystemIds.size > 0) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)'
        ctx.lineWidth = 1
        for (const systemId of drawnSystemIds) {
          const p1 = drawnPositions.get(systemId)
          if (!p1) continue
          for (const neighborId of graph.adjacency.get(systemId) ?? []) {
            if (!drawnSystemIds.has(neighborId) || neighborId <= systemId) continue
            const p2 = drawnPositions.get(neighborId)
            if (!p2) continue
            ctx.moveTo(p1.sx, p1.sy)
            ctx.lineTo(p2.sx, p2.sy)
          }
        }
        ctx.stroke()
      }

      for (const system of drawSystems) {
        if (!drawnSystemIds.has(system.systemId)) continue
        const pos = drawnPositions.get(system.systemId)
        if (!pos) continue
        if (!isEmojiMapMarker(
          system,
          layers,
          manufacturingSystemId,
          warSystemIds,
          campSystemIds,
        )) {
          continue
        }
        const markerSize = computeMapMarkerSize(camera.scale, regionalScale)
        const maskRadius = markerSize / 2 + 5
        ctx.beginPath()
        ctx.fillStyle = '#0c1119'
        ctx.arc(pos.sx, pos.sy, maskRadius, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const system of drawSystems) {
        if (!drawnSystemIds.has(system.systemId)) continue
        const pos = drawnPositions.get(system.systemId)
        if (!pos) continue
        const { sx, sy } = pos
        const isSelected = system.systemId === selectedSystemId
        const isHovered = system.systemId === hoveredSystemId
        const isEmojiMarker = isEmojiMapMarker(
          system,
          layers,
          manufacturingSystemId,
          warSystemIds,
          campSystemIds,
        )

        if (isEmojiMarker) {
          const markerSize = computeMapMarkerSize(camera.scale, regionalScale)
          const markerRadius = markerSize / 2 + 3

          if (isHovered && !isSelected) {
            const phase = (hoverPulse % 1100) / 1100
            const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
            ctx.beginPath()
            ctx.strokeStyle = `rgba(248, 250, 252, ${0.35 + pulse * 0.45})`
            ctx.lineWidth = 1.5
            ctx.arc(sx, sy, markerRadius + 2 + pulse * 2.5, 0, Math.PI * 2)
            ctx.stroke()
          }

          if (isSelected) {
            ctx.strokeStyle = '#f8fafc'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(sx, sy, markerRadius + 4, 0, Math.PI * 2)
            ctx.stroke()
          }
          continue
        }

        const radius =
          isSelected || isHovered ? computeMapNodeRadius(camera.scale, regionalScale, 1.2) : nodeRadius
        const labelOffset = radius + 4
        const labelSize = Math.min(12, Math.max(9, Math.round(radius + 4)))

        ctx.beginPath()
        ctx.fillStyle = layers.security ? securityColor(system.security) : '#64748b'
        ctx.arc(sx, sy, radius, 0, Math.PI * 2)
        ctx.fill()

        if (isHovered && !isSelected) {
          const phase = (hoverPulse % 1100) / 1100
          const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
          ctx.beginPath()
          ctx.strokeStyle = `rgba(248, 250, 252, ${0.35 + pulse * 0.45})`
          ctx.lineWidth = 1.5
          ctx.arc(sx, sy, radius + 3 + pulse * 2.5, 0, Math.PI * 2)
          ctx.stroke()
        }

        if (isSelected) {
          ctx.strokeStyle = '#f8fafc'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(sx, sy, radius + 3, 0, Math.PI * 2)
          ctx.stroke()
        }

        if (labelOpacity > 0 || isSelected || isHovered) {
          const textOpacity = isSelected || isHovered ? 1 : labelOpacity
          ctx.save()
          ctx.globalAlpha = textOpacity
          ctx.font = `${labelSize}px sans-serif`
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)'
          ctx.strokeText(system.name, sx + labelOffset, sy - 3)
          ctx.fillStyle = '#e2e8f0'
          ctx.fillText(system.name, sx + labelOffset, sy - 3)
          ctx.restore()
        }
      }
    }
  }, [
    size,
    bounds,
    camera,
    graph,
    drawSystems,
    layers,
    haulInRoute,
    haulOutRoute,
    warTheaters,
    warHubLinks,
    warTheaterLinks,
    focusedWarTheaterId,
    visibleDrawState,
    manufacturingSystemId,
    selectedSystemId,
    warSystemIds,
    campSystemIds,
    hoveredSystemId,
    hoverPulse,
    regionalScale,
  ])

  useEffect(() => {
    draw()
  }, [draw])

  const angleFromCenter = (sx: number, sy: number) =>
    Math.atan2(sy - size.height / 2, sx - size.width / 2)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.shiftKey) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      rotateDragRef.current = {
        active: true,
        moved: false,
        lastAngle: angleFromCenter(e.clientX - rect.left, e.clientY - rect.top),
      }
      setIsRotating(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    dragRef.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY }
    setHoveredSystemId(null)
    setHoverPos(null)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (rotateDragRef.current.active) {
      const angle = angleFromCenter(sx, sy)
      const delta = angle - rotateDragRef.current.lastAngle
      rotateDragRef.current.lastAngle = angle
      if (Math.abs(delta) > 0.0001) {
        rotateDragRef.current.moved = true
        setCamera((c) => rotateMapCamera(c, bounds, size.width, size.height, delta))
      }
      return
    }

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX
      const dy = e.clientY - dragRef.current.lastY
      if (Math.abs(dx) + Math.abs(dy) > 2) dragRef.current.moved = true
      dragRef.current.lastX = e.clientX
      dragRef.current.lastY = e.clientY
      setCamera((c) => ({ ...c, offsetX: c.offsetX + dx, offsetY: c.offsetY + dy }))
      return
    }

    const hit = hitTestAt(sx, sy)
    setHoveredSystemId(hit?.systemId ?? null)
    setHoverPos(hit ? { sx, sy } : null)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false
    rotateDragRef.current.active = false
    setIsRotating(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const onPointerLeave = (e: React.PointerEvent) => {
    dragRef.current.active = false
    rotateDragRef.current.active = false
    setIsRotating(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    setHoveredSystemId(null)
    setHoverPos(null)
  }

  const hitTestAt = (sx: number, sy: number) =>
    hitTestSystemDraw(
      drawSystems.filter(
        (s) => visibleSystemIds.has(s.systemId) || camera.scale >= regionalScale * 0.4,
      ),
      bounds,
      size.width,
      size.height,
      camera,
      sx,
      sy,
      Math.max(12, visibleDrawState.nodeRadius * 2.5),
    )

  const onClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved || rotateDragRef.current.moved) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const hit = hitTestAt(e.clientX - rect.left, e.clientY - rect.top)
    if (hit) onSelectSystem(hit.systemId)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const hit = hitTestAt(e.clientX - rect.left, e.clientY - rect.top)
    if (hit) onRecenter(hit.systemId)
  }

  const zoomBy = (factor: number) => {
    setCamera((current) => {
      const nextScale = clampMapScale(current.scale * factor)
      const sx = size.width / 2
      const sy = size.height / 2
      const world = screenToWorld(sx, sy, bounds, size.width, size.height, current)
      const after = worldToScreen(world.x, world.z, bounds, size.width, size.height, {
        ...current,
        scale: nextScale,
      })
      return {
        ...current,
        scale: nextScale,
        offsetX: current.offsetX + sx - after.sx,
        offsetY: current.offsetY + sy - after.sy,
      }
    })
  }

  const rotateBy = (deltaRadians: number) => {
    setCamera((current) => rotateMapCamera(current, bounds, size.width, size.height, deltaRadians))
  }

  const rotationDegrees = Math.round((camera.rotation * 180) / Math.PI)

  const zoomPercent = Math.round(computeMapZoomPercent(camera.scale, regionalScale))

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-base-300 ${
        className ?? 'min-h-[min(60vh,520px)] h-[min(60vh,520px)] rounded-lg border border-eve-border'
      }`}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 block w-full h-full touch-none ${
          isRotating
            ? 'cursor-grabbing'
            : hoveredSystemId
              ? 'cursor-pointer'
              : 'cursor-grab active:cursor-grabbing'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        aria-label="New Eden galaxy map"
      />
      <MapMarkerOverlay markers={mapMarkers} hoveredSystemId={hoveredSystemId} />
      {hoverDetail && hoverPos ? (
        <MapNodeTooltip
          detail={hoverDetail}
          x={hoverPos.sx}
          y={hoverPos.sy}
          containerWidth={size.width}
          containerHeight={size.height}
        />
      ) : null}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-eve-border bg-base-200/90 backdrop-blur shadow-sm">
          {onResetView ? (
            <button
              type="button"
              className="btn btn-sm btn-square min-h-8 h-8 w-8 rounded-none border-0 border-r border-eve-border bg-transparent hover:bg-base-300"
              onClick={onResetView}
              aria-label="Center map"
              title="Center on factory"
            >
              <CenterIcon />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sm btn-square min-h-8 h-8 w-8 rounded-none border-0 border-r border-eve-border bg-transparent hover:bg-base-300"
            onClick={() => rotateBy(-MAP_ROTATE_STEP_RAD)}
            aria-label="Rotate left"
            title="Rotate left (Shift+drag on map)"
          >
            ↺
          </button>
          <button
            type="button"
            className="btn btn-sm btn-square min-h-8 h-8 w-8 rounded-none border-0 border-r border-eve-border bg-transparent hover:bg-base-300"
            onClick={() => zoomBy(0.8)}
            aria-label="Zoom out"
          >
            -
          </button>
          <span
            className="inline-flex min-w-[3.25rem] flex-col items-center justify-center px-1.5 py-0.5 text-[11px] font-medium tabular-nums opacity-80 leading-tight"
            aria-live="polite"
            aria-label={`Zoom ${zoomPercent} percent, rotation ${rotationDegrees} degrees`}
          >
            <span>{zoomPercent}%</span>
            {rotationDegrees !== 0 ? (
              <span className="text-[9px] opacity-60">{rotationDegrees}°</span>
            ) : null}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-square min-h-8 h-8 w-8 rounded-none border-0 border-l border-eve-border bg-transparent hover:bg-base-300"
            onClick={() => zoomBy(1.25)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-sm btn-square min-h-8 h-8 w-8 rounded-none border-0 border-l border-eve-border bg-transparent hover:bg-base-300"
            onClick={() => rotateBy(MAP_ROTATE_STEP_RAD)}
            aria-label="Rotate right"
            title="Rotate right (Shift+drag on map)"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  )
}

function CenterIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 opacity-80" aria-hidden>
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <path
        d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
