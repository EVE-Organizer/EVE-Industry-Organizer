import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip as UiTooltip, useAnchorTooltip } from '@/components/Tooltip'
import { ManufacturingSlotsRow } from '@/components/plan/ManufacturingSlotRing'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import {
  buildSlotLanes,
  buildTimelineTicks,
  formatHourTick,
  ganttBarColor,
  layoutLaneBars,
  timelineTickPosition,
  type PlanSlotBarLayout,
  type PlanSlotJobBar,
  type PlanSlotLane,
} from '@/lib/planTimelineChartData'
import { formatDecimal } from '@/lib/profit'
import type { PlanNode, ScheduledPlanJob } from '@/types'

const BAR_ICON = 20

function SlotJobBarDetails({
  bar,
  blueprintTypeId,
}: {
  bar: PlanSlotJobBar
  blueprintTypeId?: number
}) {
  return (
    <div className="plan-timeline__bar-tip flex flex-col gap-1.5">
      <div className="flex items-start gap-2.5">
        <PlanProductIcon
          productTypeId={bar.productTypeId}
          blueprintTypeId={blueprintTypeId}
          size={32}
          alt=""
          className="plan-timeline__bar-tip-icon shrink-0"
        />
        <div className="min-w-0 flex flex-col gap-1">
          <p className="font-semibold text-base-content leading-snug">{bar.name}</p>
          <p className="tabular-nums text-base-content/75">
            {formatHourTick(bar.startHour)} – {formatHourTick(bar.endHour)}
            <span className="text-base-content/50"> · </span>
            {formatDecimal(bar.durationHours, 1)}h job
          </p>
          <p className="tabular-nums text-base-content/75">
            {formatDecimal(bar.runs, 0)} runs · {formatDecimal(bar.outputQty, 0)} output
          </p>
          {bar.isRoot ? (
            <p className="text-[10px] uppercase tracking-wide text-primary/80">Root build</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SlotJobBar({
  bar,
  layout,
  blueprintTypeId,
}: {
  bar: PlanSlotJobBar
  layout: PlanSlotBarLayout
  blueprintTypeId?: number
}) {
  const fill = ganttBarColor(bar.depth, bar.isRoot)
  const { ref, triggerProps, TooltipPortal } = useAnchorTooltip('top')
  const showLabel = layout.visualWidthPct >= 6 || bar.durationHours >= 2.5

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`plan-timeline__bar${showLabel ? '' : ' plan-timeline__bar--compact'}`}
        style={{
          left: layout.left,
          width: layout.width,
          maxWidth: layout.width,
          ['--bar-row' as string]: layout.row,
          backgroundColor: `${fill}33`,
          borderColor: `${fill}99`,
        }}
        {...triggerProps}
      >
        <PlanProductIcon
          productTypeId={bar.productTypeId}
          blueprintTypeId={blueprintTypeId}
          size={BAR_ICON}
          alt=""
          className="plan-timeline__bar-icon"
        />
        {showLabel ? <span className="plan-timeline__bar-label">{bar.name}</span> : null}
      </button>
      <TooltipPortal
        content={<SlotJobBarDetails bar={bar} blueprintTypeId={blueprintTypeId} />}
        className="max-w-sm"
      />
    </>
  )
}

function PlanSlotSchedule({
  lanes,
  windowHours,
  blueprintTypeIdByProduct,
  focusedSlotIndex,
  onLaneRef,
}: {
  lanes: PlanSlotLane[]
  windowHours: number
  blueprintTypeIdByProduct: Map<number, number>
  focusedSlotIndex: number | null
  onLaneRef: (slotIndex: number, node: HTMLDivElement | null) => void
}) {
  const ticks = useMemo(() => buildTimelineTicks(windowHours), [windowHours])
  const laneLayouts = useMemo(
    () => lanes.map((lane) => layoutLaneBars(lane.jobs, windowHours)),
    [lanes, windowHours],
  )

  if (lanes.every((l) => l.jobs.length === 0)) {
    return <p className="text-sm text-base-content/60">No scheduled jobs yet.</p>
  }

  return (
    <div className="plan-timeline__chart-block">
      <UiTooltip
        text="Each row is one industry slot. Labels show real hours (0 to finish). Short jobs use a minimum bar width; overlapping bars stack within the lane. Hover a bar for exact timing."
        placement="right"
      >
        <h3 className="plan-timeline__chart-title cursor-help">Job schedule</h3>
      </UiTooltip>

      <div className="plan-timeline__gantt">
        <div className="plan-timeline__gantt-axis" aria-hidden>
          <div className="plan-timeline__gantt-axis-spacer" />
          <div className="plan-timeline__gantt-axis-track">
            {ticks.map((hour) => (
              <span
                key={hour}
                className="plan-timeline__gantt-tick"
                style={{ left: timelineTickPosition(hour, windowHours) }}
              >
                {formatHourTick(hour)}
              </span>
            ))}
          </div>
        </div>

        <div className="plan-timeline__lanes">
          {lanes.map((lane, laneIndex) => {
            const { layouts, rowCount } = laneLayouts[laneIndex]!
            const isFocused = focusedSlotIndex === lane.slot
            return (
              <div
                key={lane.slot}
                ref={(node) => onLaneRef(lane.slot, node)}
                className={`plan-timeline__lane${isFocused ? ' plan-timeline__lane--focused' : ''}`}
                id={`plan-timeline-lane-${lane.slot}`}
              >
                <div className="plan-timeline__lane-label">
                  <span className="font-medium">{lane.label}</span>
                  <span className="plan-timeline__lane-meta tabular-nums">
                    {lane.jobCount} job{lane.jobCount === 1 ? '' : 's'} · ends {formatHourTick(lane.endHour)}
                  </span>
                </div>
                <div
                  className="plan-timeline__lane-track"
                  style={{ ['--lane-rows' as string]: rowCount }}
                >
                  {ticks.map((hour) => (
                    <span
                      key={hour}
                      className="plan-timeline__lane-gridline"
                      style={{ left: timelineTickPosition(hour, windowHours) }}
                    />
                  ))}
                  {lane.jobs.length === 0 ? (
                    <span className="plan-timeline__lane-empty">Idle</span>
                  ) : (
                    lane.jobs.map((bar) => {
                      const layout = layouts.get(bar.id)
                      if (!layout) return null
                      return (
                        <SlotJobBar
                          key={bar.id}
                          bar={bar}
                          layout={layout}
                          blueprintTypeId={blueprintTypeIdByProduct.get(bar.productTypeId)}
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

export function PlanTimelinePanel({
  windowHours,
  nodes,
  jobs,
  slots,
  blueprintTypeIdByProduct,
  embedded = false,
}: {
  windowHours: number
  nodes: PlanNode[]
  jobs: ScheduledPlanJob[]
  slots: number
  blueprintTypeIdByProduct: Map<number, number>
  embedded?: boolean
}) {
  const lanes = useMemo(() => buildSlotLanes(jobs, nodes, slots), [jobs, nodes, slots])
  const [focusedSlotIndex, setFocusedSlotIndex] = useState<number | null>(null)
  const laneRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const handleLaneRef = useCallback((slotIndex: number, node: HTMLDivElement | null) => {
    if (node) laneRefs.current.set(slotIndex, node)
    else laneRefs.current.delete(slotIndex)
  }, [])

  const handleSelectSlot = useCallback((slotIndex: number) => {
    setFocusedSlotIndex((prev) => (prev === slotIndex ? null : slotIndex))
  }, [])

  useEffect(() => {
    if (focusedSlotIndex == null) return
    const lane = laneRefs.current.get(focusedSlotIndex)
    if (!lane) return
    lane.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [focusedSlotIndex, lanes])

  const slotRingProps = useMemo(
    () =>
      lanes.map((lane) => ({
        slotIndex: lane.slot,
        active: lane.jobs.length > 0,
        utilization: windowHours > 0 ? lane.busyHours / windowHours : 0,
        productTypeId: lane.jobs[0]?.productTypeId,
        blueprintTypeId: lane.jobs[0]
          ? blueprintTypeIdByProduct.get(lane.jobs[0].productTypeId)
          : undefined,
        productName: lane.jobs[0]?.name,
        idleMessage: 'Please install blueprint',
      })),
    [lanes, windowHours, blueprintTypeIdByProduct],
  )

  const body = (
    <>
      <div className="plan-timeline__hero">
        <div className="plan-timeline__hero-top">
          <UiTooltip
            text="Hour when the last scheduled job on this plan finishes, after packing work onto your industry slots. Not the ideal single-root job time."
            placement="bottom"
          >
            <p className="plan-timeline__finish">
              Finishes in{' '}
              <span className="plan-timeline__finish-value">{formatDecimal(windowHours, 1)}h</span>
            </p>
          </UiTooltip>
        </div>

        <UiTooltip
          text={`${slots} concurrent industry ${slots === 1 ? 'slot' : 'slots'} from Mass Production and related skills. Click a slot to highlight its row in the job schedule below.`}
          placement="bottom"
          className="flex w-full min-w-0 self-stretch"
        >
          <div className="plan-timeline__slots-panel">
            <ManufacturingSlotsRow
              slots={slotRingProps}
              selectedSlotIndex={focusedSlotIndex}
              onSelectSlot={handleSelectSlot}
              emptyHint="Please install blueprint"
            />
          </div>
        </UiTooltip>
      </div>

      <PlanSlotSchedule
        lanes={lanes}
        windowHours={windowHours}
        blueprintTypeIdByProduct={blueprintTypeIdByProduct}
        focusedSlotIndex={focusedSlotIndex}
        onLaneRef={handleLaneRef}
      />
    </>
  )

  if (embedded) return body

  return (
    <section className="plan-build-card plan-timeline">
      <div className="plan-build-card__header">
        <h2 className="plan-build-card__title">Plan timeline</h2>
      </div>
      <div className="plan-build-card__body plan-timeline__body">{body}</div>
    </section>
  )
}

/** @deprecated Use PlanTimelinePanel */
export const PlanTimelineChart = PlanTimelinePanel
