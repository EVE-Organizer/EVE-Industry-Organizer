export interface Point2D {
  x: number
  y: number
}

function cross(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** Andrew's monotone chain convex hull (counter-clockwise). */
export function convexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 1) return [...points]

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  const lower: Point2D[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: Point2D[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

/** Axis-aligned square corners around a node. */
export function bufferPointSquare(point: Point2D, padding: number): Point2D[] {
  return [
    { x: point.x - padding, y: point.y - padding },
    { x: point.x + padding, y: point.y - padding },
    { x: point.x + padding, y: point.y + padding },
    { x: point.x - padding, y: point.y + padding },
  ]
}

/** Rectangle around a segment, offset perpendicular by padding on both sides. */
export function bufferSegment(a: Point2D, b: Point2D, padding: number): Point2D[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * padding
  const ny = (dx / len) * padding
  const points: Point2D[] = [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]
  if (len > padding * 2) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    points.push(
      { x: mid.x + nx, y: mid.y + ny },
      { x: mid.x - nx, y: mid.y - ny },
    )
  }
  return points
}

/**
 * Build a hull that wraps nodes and war connection segments with clearance,
 * so the outline does not hug the interior purple lines.
 */
export function warTheaterOutlinePoints(
  nodes: Point2D[],
  padding: number,
  connections: [Point2D, Point2D][] = [],
): Point2D[] {
  if (nodes.length < 2) return []

  const samples: Point2D[] = []
  for (const node of nodes) {
    samples.push(...bufferPointSquare(node, padding))
  }

  const segments =
    connections.length > 0
      ? connections
      : nodes.length === 2
        ? [[nodes[0]!, nodes[1]!] as [Point2D, Point2D]]
        : []

  for (const [a, b] of segments) {
    samples.push(...bufferSegment(a, b, padding))
  }

  return convexHull(samples)
}

export function tracePolygonPath(ctx: CanvasRenderingContext2D, points: Point2D[]): void {
  if (points.length < 2) return
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y)
  }
  ctx.closePath()
}

export const WAR_THEATER_OUTLINE_COLOR = 'rgba(168, 85, 247, 0.55)'
export const WAR_THEATER_OUTLINE_DASH = [4, 6]
export const WAR_THEATER_OUTLINE_HIGHLIGHT_COLOR = 'rgba(192, 132, 252, 0.95)'
export const WAR_THEATER_OUTLINE_HIGHLIGHT_DASH = [10, 6]
export const WAR_THEATER_OUTLINE_HIGHLIGHT_GLOW = 'rgba(168, 85, 247, 0.22)'

export function drawWarTheaterOutline(
  ctx: CanvasRenderingContext2D,
  nodes: Point2D[],
  options?: {
    padding?: number
    connections?: [Point2D, Point2D][]
    strokeStyle?: string
    lineWidth?: number
    dash?: number[]
    highlight?: boolean
  },
): void {
  if (nodes.length < 2) return
  const padding = options?.padding ?? 28
  const outline = warTheaterOutlinePoints(nodes, padding, options?.connections ?? [])
  if (outline.length < 2) return

  const highlight = options?.highlight ?? false
  const strokeStyle =
    options?.strokeStyle ??
    (highlight ? WAR_THEATER_OUTLINE_HIGHLIGHT_COLOR : WAR_THEATER_OUTLINE_COLOR)
  const lineWidth = options?.lineWidth ?? (highlight ? 2.5 : 1.5)
  const dash =
    options?.dash ?? (highlight ? WAR_THEATER_OUTLINE_HIGHLIGHT_DASH : WAR_THEATER_OUTLINE_DASH)

  ctx.beginPath()
  tracePolygonPath(ctx, outline)

  if (highlight) {
    ctx.strokeStyle = WAR_THEATER_OUTLINE_HIGHLIGHT_GLOW
    ctx.lineWidth = lineWidth + 7
    ctx.setLineDash([])
    ctx.stroke()
    ctx.beginPath()
    tracePolygonPath(ctx, outline)
  }

  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.setLineDash(dash)
  ctx.stroke()
  ctx.setLineDash([])
}
