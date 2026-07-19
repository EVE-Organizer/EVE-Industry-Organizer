import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAnchorTooltip } from '@/components/Tooltip'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import {
  barProgressFillRatio,
  buildTimelineTicks,
  layoutLaneBarsFromNormalized,
  timelineTickPositionFromNormalized,
} from '@/lib/ganttLayout'
import { liveJobProgress } from '@/lib/liveTimelineAdapter'
import type { LiveIndustryJob } from '@/types'
import type { GanttBar, GanttBarLayout, GanttLane } from '@/components/gantt/ganttTypes'

const BAR_ICON = 20

export interface SlotGanttChartProps {
  lanes: GanttLane[]
  formatTick: (ratio: number) => string
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

export function SlotGanttChart({
  lanes,
  formatTick,
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
  const isControlled = focusedLaneIdProp !== undefined
  const focusedLaneId = isControlled ? focusedLaneIdProp : internalFocusedLaneId
  const laneRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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

  useEffect(() => {
    if (!focusedLaneId) return
    laneRefs.current.get(focusedLaneId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedLaneId, lanes])

  if (lanes.every((lane) => lane.bars.length === 0)) {
    return <p className="text-sm text-base-content/60">{emptyMessage}</p>
  }

  return (
    <div className="plan-timeline__chart-block">
      <h3 className="plan-timeline__chart-title">{title}</h3>
      <div className="plan-timeline__gantt">
        <div className="plan-timeline__gantt-axis" aria-hidden>
          <div className="plan-timeline__gantt-axis-spacer" />
          <div className="plan-timeline__gantt-track plan-timeline__gantt-axis-track">
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
      </div>
    </div>
  )
}
