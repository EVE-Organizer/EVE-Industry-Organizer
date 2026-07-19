import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { useAnchorTooltip } from '@/components/Tooltip'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import {
  barProgressFillRatio,
  buildTimelineTicks,
  layoutLaneBarsFromNormalized,
  timelineNormalizedRatioFromVisual,
  timelineTickPositionFromNormalized,
} from '@/lib/ganttLayout'
import { liveJobProgress } from '@/lib/liveTimelineAdapter'
import type { LiveIndustryJob } from '@/types'
import type { GanttBar, GanttBarLayout, GanttLane } from '@/components/gantt/ganttTypes'

const BAR_ICON = 20
const SCRUB_TOOLTIP_CLASS =
  'pointer-events-none fixed z-[9999] max-w-xs rounded-md border border-eve-border bg-base-200 px-3 py-2 text-left text-xs leading-snug text-base-content shadow-lg tabular-nums'

interface ScrubState {
  ratio: number
  visualRatio: number
  clientX: number
  clientY: number
}

interface ScrubBounds {
  top: number
  left: number
  width: number
  height: number
}

export interface SlotGanttChartProps {
  lanes: GanttLane[]
  formatTick: (ratio: number) => string
  formatScrub: (ratio: number) => string
  formatBarRange?: (bar: GanttBar) => string
  formatBarMeta?: (bar: GanttBar) => string
  blueprintTypeIdByProduct?: Map<number, number>
  emptyMessage?: string
  title?: string
  nowRatio?: number | null
  nowMs?: number | null
  focusedLaneId?: string | null
  onFocusedLaneChange?: (laneId: string | null) => void
}

function barProgressRatio(
  bar: GanttBar,
  layout: GanttBarLayout,
  nowMs: number,
  nowRatio: number | null | undefined,
): number {
  if (nowRatio != null) {
    return barProgressFillRatio(bar, nowRatio, layout.leftPct, layout.widthPct)
  }
  const job = bar.meta?.job as LiveIndustryJob | undefined
  if (!job) return 0
  return liveJobProgress(job, nowMs).ratio
}

function LiveBarProgress({
  bar,
  layout,
  fill,
  nowMs,
  nowRatio,
}: {
  bar: GanttBar
  layout: GanttBarLayout
  fill: string
  nowMs: number
  nowRatio: number | null | undefined
}) {
  const ratio = barProgressRatio(bar, layout, nowMs, nowRatio)
  if (ratio <= 0) return null

  return (
    <span
      className="plan-timeline__bar-progress"
      style={{
        width: `${ratio * 100}%`,
        backgroundColor: `${fill}55`,
      }}
      aria-hidden
    />
  )
}

function GanttBarButton({
  bar,
  layout,
  blueprintTypeId,
  formatBarRange,
  formatBarMeta,
  nowMs,
  nowRatio,
}: {
  bar: GanttBar
  layout: GanttBarLayout
  blueprintTypeId?: number
  formatBarRange?: (bar: GanttBar) => string
  formatBarMeta?: (bar: GanttBar) => string
  nowMs?: number | null
  nowRatio?: number | null
}) {
  const fill = bar.color ?? '#4a9eff'
  const { ref, triggerProps, TooltipPortal } = useAnchorTooltip('top')
  const showLabel = layout.visualWidthPct >= 6 || bar.duration >= 2.5
  const job = bar.meta?.job as LiveIndustryJob | undefined
  const isLive = job != null && nowMs != null
  const isAnimating = isLive && job != null && liveJobProgress(job, nowMs).animating

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`plan-timeline__bar${showLabel ? '' : ' plan-timeline__bar--compact'}${isLive ? ' plan-timeline__bar--live' : ''}`}
        style={{
          left: layout.left,
          width: layout.width,
          maxWidth: layout.width,
          ['--bar-row' as string]: layout.row,
          ['--bar-color' as string]: fill,
          backgroundColor: isLive ? `${fill}1a` : `${fill}33`,
          borderColor: `${fill}99`,
        }}
        {...triggerProps}
      >
        {isLive && job ? (
          <LiveBarProgress bar={bar} layout={layout} fill={fill} nowMs={nowMs} nowRatio={nowRatio} />
        ) : null}
        {isAnimating ? <span className="plan-timeline__bar-sweep" style={{ color: fill }} aria-hidden /> : null}
        {bar.productTypeId ? (
          <PlanProductIcon
            productTypeId={bar.productTypeId}
            blueprintTypeId={blueprintTypeId}
            size={BAR_ICON}
            alt=""
            className="plan-timeline__bar-icon"
          />
        ) : null}
        {showLabel ? <span className="plan-timeline__bar-label">{bar.label}</span> : null}
      </button>
      <TooltipPortal
        content={
          <div className="plan-timeline__bar-tip flex flex-col gap-1.5">
            <p className="font-semibold text-base-content leading-snug">{bar.label}</p>
            {formatBarRange ? (
              <p className="tabular-nums text-base-content/75">{formatBarRange(bar)}</p>
            ) : null}
            {formatBarMeta ? (
              <p className="tabular-nums text-base-content/75">{formatBarMeta(bar)}</p>
            ) : null}
          </div>
        }
        className="max-w-sm"
      />
    </>
  )
}

function ScrubTooltip({ clientX, clientY, text }: { clientX: number; clientY: number; text: string }) {
  const style: CSSProperties = {
    top: clientY + 14,
    left: clientX,
    transform: 'translate(-50%, 0)',
  }

  return createPortal(
    <div role="tooltip" className={SCRUB_TOOLTIP_CLASS} style={style}>
      {text}
    </div>,
    document.body,
  )
}

export function SlotGanttChart({
  lanes,
  formatTick,
  formatScrub,
  formatBarRange,
  formatBarMeta,
  blueprintTypeIdByProduct,
  emptyMessage = 'No scheduled jobs yet.',
  title = 'Job schedule',
  nowRatio = null,
  nowMs = null,
  focusedLaneId: focusedLaneIdProp,
  onFocusedLaneChange,
}: SlotGanttChartProps) {
  const isLiveTimeline = nowMs != null
  const ticks = useMemo(() => buildTimelineTicks(1), [])
  const laneLayouts = useMemo(
    () => lanes.map((lane) => layoutLaneBarsFromNormalized(lane.bars)),
    [lanes],
  )
  const [internalFocusedLaneId, setInternalFocusedLaneId] = useState<string | null>(null)
  const [scrub, setScrub] = useState<ScrubState | null>(null)
  const [scrubBounds, setScrubBounds] = useState<ScrubBounds | null>(null)
  const isControlled = focusedLaneIdProp !== undefined
  const focusedLaneId = isControlled ? focusedLaneIdProp : internalFocusedLaneId
  const laneRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const ganttRef = useRef<HTMLDivElement>(null)
  const axisTrackRef = useRef<HTMLDivElement>(null)
  const laneTrackRefs = useRef<HTMLDivElement[]>([])

  const setFocusedLaneId = useCallback(
    (laneId: string | null) => {
      if (isControlled) onFocusedLaneChange?.(laneId)
      else setInternalFocusedLaneId(laneId)
    },
    [isControlled, onFocusedLaneChange],
  )

  const handleLaneRef = useCallback((laneId: string, node: HTMLDivElement | null) => {
    if (node) laneRefs.current.set(laneId, node)
    else laneRefs.current.delete(laneId)
  }, [])

  const updateScrubBounds = useCallback(() => {
    const gantt = ganttRef.current
    const axis = axisTrackRef.current
    const laneTracks = laneTrackRefs.current.filter(Boolean)
    if (!gantt || !axis || laneTracks.length === 0) {
      setScrubBounds(null)
      return
    }

    const ganttRect = gantt.getBoundingClientRect()
    const axisRect = axis.getBoundingClientRect()
    const lastLaneRect = laneTracks[laneTracks.length - 1]!.getBoundingClientRect()

    setScrubBounds({
      top: axisRect.top - ganttRect.top,
      left: axisRect.left - ganttRect.left,
      width: axisRect.width,
      height: lastLaneRect.bottom - axisRect.top,
    })
  }, [])

  useLayoutEffect(() => {
    updateScrubBounds()
    const gantt = ganttRef.current
    if (!gantt) return

    const observer = new ResizeObserver(() => updateScrubBounds())
    observer.observe(gantt)
    for (const track of laneTrackRefs.current) {
      if (track) observer.observe(track)
    }
    if (axisTrackRef.current) observer.observe(axisTrackRef.current)

    return () => observer.disconnect()
  }, [lanes, updateScrubBounds])

  useEffect(() => {
    if (!focusedLaneId) return
    laneRefs.current.get(focusedLaneId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedLaneId, lanes])

  const updateScrubFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!scrubBounds || scrubBounds.width <= 0 || !ganttRef.current) {
        setScrub(null)
        return
      }

      const ganttRect = ganttRef.current.getBoundingClientRect()
      const x = clientX - ganttRect.left
      const y = clientY - ganttRect.top
      const inColumn =
        x >= scrubBounds.left && x <= scrubBounds.left + scrubBounds.width
      const inRows =
        y >= scrubBounds.top && y <= scrubBounds.top + scrubBounds.height

      if (!inColumn || !inRows) {
        setScrub(null)
        return
      }

      const stack = document.elementsFromPoint(clientX, clientY)
      const overBar = stack.some((el) => el.closest('.plan-timeline__bar'))
      const overLaneLabel = stack.some((el) => el.closest('.plan-timeline__lane-label'))
      if (overBar || overLaneLabel) {
        setScrub(null)
        return
      }

      const visualRatio = (clientX - (ganttRect.left + scrubBounds.left)) / scrubBounds.width
      const clampedVisual = Math.max(0, Math.min(visualRatio, 1))
      setScrub({
        ratio: timelineNormalizedRatioFromVisual(clampedVisual),
        visualRatio: clampedVisual,
        clientX,
        clientY,
      })
    },
    [scrubBounds],
  )

  useEffect(() => {
    const gantt = ganttRef.current
    if (!gantt) return

    const onMove = (event: globalThis.MouseEvent) => {
      updateScrubFromPointer(event.clientX, event.clientY)
    }
    const onLeave = () => setScrub(null)

    gantt.addEventListener('mousemove', onMove)
    gantt.addEventListener('mouseleave', onLeave)
    return () => {
      gantt.removeEventListener('mousemove', onMove)
      gantt.removeEventListener('mouseleave', onLeave)
    }
  }, [updateScrubFromPointer, lanes])

  if (lanes.every((lane) => lane.bars.length === 0)) {
    return <p className="text-sm text-base-content/60">{emptyMessage}</p>
  }

  return (
    <div className="plan-timeline__chart-block">
      <h3 className="plan-timeline__chart-title">{title}</h3>
      <div ref={ganttRef} className="plan-timeline__gantt">
        <div className="plan-timeline__gantt-axis">
          <div className="plan-timeline__gantt-axis-spacer" />
          <div
            ref={axisTrackRef}
            className="plan-timeline__gantt-track plan-timeline__gantt-axis-track"
          >
            {ticks.map((ratio) => (
              <span
                key={ratio}
                className="plan-timeline__gantt-tick"
                style={{ left: timelineTickPositionFromNormalized(ratio) }}
              >
                {formatTick(ratio)}
              </span>
            ))}
          </div>
        </div>

        <div className="plan-timeline__lanes">
          {lanes.map((lane, laneIndex) => {
            const { layouts, rowCount } = laneLayouts[laneIndex]!
            const isFocused = focusedLaneId === lane.id
            return (
              <div
                key={lane.id}
                ref={(node) => handleLaneRef(lane.id, node)}
                className={`plan-timeline__lane${isFocused ? ' plan-timeline__lane--focused' : ''}`}
              >
                <button
                  type="button"
                  className="plan-timeline__lane-label text-left"
                  onClick={() => setFocusedLaneId(focusedLaneId === lane.id ? null : lane.id)}
                >
                  <span className="font-medium">{lane.label}</span>
                  {lane.sublabel ? (
                    <span className="plan-timeline__lane-meta tabular-nums">{lane.sublabel}</span>
                  ) : null}
                </button>
                <div
                  ref={(node) => {
                    if (node) laneTrackRefs.current[laneIndex] = node
                    else laneTrackRefs.current.splice(laneIndex, 1)
                  }}
                  className="plan-timeline__lane-track"
                  style={{ ['--lane-rows' as string]: rowCount }}
                >
                  {ticks.map((ratio) => (
                    <span
                      key={ratio}
                      className="plan-timeline__lane-gridline"
                      style={{ left: timelineTickPositionFromNormalized(ratio) }}
                    />
                  ))}
                  {nowRatio != null && nowRatio >= 0 && nowRatio <= 1 ? (
                    <span
                      className={`plan-timeline__now-marker${isLiveTimeline ? ' plan-timeline__now-marker--live' : ''}`}
                      style={{ left: timelineTickPositionFromNormalized(nowRatio) }}
                      aria-hidden
                    />
                  ) : null}
                  {lane.bars.length === 0 ? (
                    <span className="plan-timeline__lane-empty">Idle</span>
                  ) : (
                    lane.bars.map((bar) => {
                      const layout = layouts.get(bar.id)
                      if (!layout) return null
                      return (
                        <GanttBarButton
                          key={bar.id}
                          bar={bar}
                          layout={layout}
                          blueprintTypeId={
                            bar.productTypeId
                              ? blueprintTypeIdByProduct?.get(bar.productTypeId)
                              : undefined
                          }
                          formatBarRange={formatBarRange}
                          formatBarMeta={formatBarMeta}
                          nowMs={nowMs}
                          nowRatio={nowRatio}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {scrubBounds && scrub ? (
          <div
            className="plan-timeline__scrub-layer"
            style={{
              top: scrubBounds.top,
              left: scrubBounds.left,
              width: scrubBounds.width,
              height: scrubBounds.height,
            }}
          >
            <span
              className="plan-timeline__scrub-line"
              style={{ left: `${scrub.visualRatio * 100}%` }}
              aria-hidden
            />
          </div>
        ) : null}

        {scrub ? (
          <ScrubTooltip clientX={scrub.clientX} clientY={scrub.clientY} text={formatScrub(scrub.ratio)} />
        ) : null}
      </div>
    </div>
  )
}
