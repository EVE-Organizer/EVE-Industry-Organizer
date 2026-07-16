import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { usePlanTimeline } from '@/contexts/PlanTimelineContext'
import { formatDecimal } from '@/lib/profit'

const CHART_HEIGHT = 160
const BRUSH_HEIGHT = 48

export function PlanTimelineChart({ embedded = false }: { embedded?: boolean }) {
  const {
    windowHours,
    viewportStart,
    viewportEnd,
    playheadHours,
    pairBuckets,
    setViewport,
    setPlayheadHours,
    selectedSupplierId,
    selectedConsumerId,
    nodes,
    setSelectedPair,
  } = usePlanTimeline()

  const brushRef = useRef<SVGSVGElement>(null)
  const [draggingBrush, setDraggingBrush] = useState<'move' | 'left' | 'right' | null>(null)
  const dragOrigin = useRef({ x: 0, start: 0, end: 0 })

  const visibleBuckets = useMemo(
    () => pairBuckets.filter((b) => b.hour >= viewportStart && b.hour <= viewportEnd),
    [pairBuckets, viewportStart, viewportEnd],
  )

  const maxVal = useMemo(() => {
    let m = 1
    for (const b of visibleBuckets) {
      m = Math.max(m, b.supply, b.demand, Math.abs(b.inventory))
    }
    return m
  }, [visibleBuckets])

  const pairs = useMemo(() => {
    const options: { supplierId: number; consumerId: number; label: string }[] = []
    for (const node of nodes) {
      for (const parentId of node.parentProductTypeIds) {
        const parent = nodes.find((n) => n.productTypeId === parentId)
        if (!parent) continue
        options.push({
          supplierId: node.productTypeId,
          consumerId: parentId,
          label: `${node.name} → ${parent.name}`,
        })
      }
    }
    return options
  }, [nodes])

  const onBrushPointerDown = (e: PointerEvent, mode: 'move' | 'left' | 'right') => {
    e.preventDefault()
    setDraggingBrush(mode)
    dragOrigin.current = { x: e.clientX, start: viewportStart, end: viewportEnd }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onBrushPointerMove = (e: PointerEvent) => {
    if (!draggingBrush) return
    const width = brushRef.current?.getBoundingClientRect().width ?? 1
    const deltaHours = ((e.clientX - dragOrigin.current.x) / width) * windowHours
    const { start, end } = dragOrigin.current
    const viewSpan = end - start

    if (draggingBrush === 'move') {
      let newStart = start + deltaHours
      newStart = Math.max(0, Math.min(windowHours - viewSpan, newStart))
      setViewport(newStart, newStart + viewSpan)
    } else if (draggingBrush === 'left') {
      setViewport(Math.max(0, Math.min(start + deltaHours, end - 1)), end)
    } else {
      setViewport(start, Math.min(windowHours, Math.max(end + deltaHours, start + 1)))
    }
  }

  const onBrushPointerUp = () => setDraggingBrush(null)

  const playheadPct =
    ((playheadHours - viewportStart) / Math.max(1, viewportEnd - viewportStart)) * 100

  const shortages = visibleBuckets.filter((b) => b.inventory < 0)

  const body = (
    <>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <label className="text-xs opacity-70">Node pair</label>
        <select
          className="select select-bordered select-sm max-w-md"
          value={
            selectedSupplierId != null && selectedConsumerId != null
              ? `${selectedSupplierId}:${selectedConsumerId}`
              : ''
          }
          onChange={(e) => {
            const [s, c] = e.target.value.split(':').map(Number)
            if (s && c) setSelectedPair(s, c)
          }}
        >
          <option value="" disabled>
            Select supplier → consumer
          </option>
          {pairs.map((p) => (
            <option key={`${p.supplierId}-${p.consumerId}`} value={`${p.supplierId}:${p.consumerId}`}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="text-xs opacity-60 ml-auto tabular-nums">
          Playhead: {formatDecimal(playheadHours, 1)}h
        </span>
      </div>

      <svg
        className="w-full touch-none"
        style={{ height: CHART_HEIGHT }}
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          setPlayheadHours(viewportStart + ratio * (viewportEnd - viewportStart))
        }}
      >
        {visibleBuckets.map((b, i) => {
          const x = visibleBuckets.length > 1 ? (i / (visibleBuckets.length - 1)) * 100 : 50
          const barH = (b.supply / maxVal) * (CHART_HEIGHT - 24)
          return (
            <g key={b.hour}>
              <rect
                x={x - 1}
                y={CHART_HEIGHT - 12 - barH}
                width={2}
                height={barH}
                className="fill-primary/70"
                rx={0.5}
              />
              <circle
                cx={x}
                cy={CHART_HEIGHT - 12 - (Math.max(0, b.inventory) / maxVal) * (CHART_HEIGHT - 24)}
                r={1.5}
                className={b.inventory < 0 ? 'fill-error' : 'fill-secondary'}
              />
            </g>
          )
        })}
        <line x1={playheadPct} x2={playheadPct} y1={0} y2={CHART_HEIGHT} className="stroke-primary" strokeWidth={0.5} />
      </svg>

      {shortages.length > 0 && (
        <p className="text-xs text-error mt-2">
          Short supply in view: {shortages.length} bucket(s). Upstream may not feed downstream in time.
        </p>
      )}

      <svg
        ref={brushRef}
        className="w-full mt-2 touch-none"
        style={{ height: BRUSH_HEIGHT }}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        onPointerMove={onBrushPointerMove}
        onPointerUp={onBrushPointerUp}
        onPointerLeave={onBrushPointerUp}
      >
        <rect width={100} height={40} className="fill-base-300" rx={2} />
        <rect
          x={(viewportStart / windowHours) * 100}
          y={2}
          width={((viewportEnd - viewportStart) / windowHours) * 100}
          height={36}
          className="fill-primary/20 stroke-primary/50"
          strokeWidth={0.3}
          rx={1}
          onPointerDown={(e) => onBrushPointerDown(e, 'move')}
        />
      </svg>
      <div className="flex justify-between text-[10px] opacity-50 tabular-nums mt-1">
        <span>0h</span>
        <span>{formatDecimal(windowHours, 0)}h</span>
      </div>
    </>
  )

  if (embedded) return body

  return (
    <section className="plan-build-card">
      <div className="plan-build-card__header">
        <h2 className="plan-build-card__title">Timeline</h2>
      </div>
      <div className="plan-build-card__body">{body}</div>
    </section>
  )
}
