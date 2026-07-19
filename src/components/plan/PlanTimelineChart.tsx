import { useCallback, useMemo, useState } from 'react'
import { Tooltip as UiTooltip } from '@/components/Tooltip'
import { SlotGanttChart } from '@/components/gantt/SlotGanttChart'
import { ManufacturingSlotsRow } from '@/components/plan/ManufacturingSlotRing'
import { buildPlanGanttLanes, formatPlanGanttTick } from '@/lib/planGanttAdapter'
import { formatDecimal } from '@/lib/profit'
import type { PlanNode, ScheduledPlanJob } from '@/types'

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
  const lanes = useMemo(
    () => buildPlanGanttLanes(jobs, nodes, slots, windowHours),
    [jobs, nodes, slots, windowHours],
  )
  const [focusedSlotIndex, setFocusedSlotIndex] = useState<number | null>(null)
  const focusedLaneId = focusedSlotIndex != null ? `slot-${focusedSlotIndex}` : null

  const handleSelectSlot = useCallback((slotIndex: number) => {
    setFocusedSlotIndex((prev) => (prev === slotIndex ? null : slotIndex))
  }, [])

  const handleFocusedLaneChange = useCallback((laneId: string | null) => {
    if (laneId == null) {
      setFocusedSlotIndex(null)
      return
    }
    const match = /^slot-(\d+)$/.exec(laneId)
    if (match) setFocusedSlotIndex(Number(match[1]))
  }, [])

  const formatTick = useCallback(
    (ratio: number) => formatPlanGanttTick(ratio, windowHours),
    [windowHours],
  )

  const formatBarRange = useCallback(
    (bar: { start: number; end: number; duration: number }) => {
      const startHour = bar.start * windowHours
      const endHour = bar.end * windowHours
      return `${formatPlanGanttTick(startHour / windowHours, windowHours)} – ${formatPlanGanttTick(endHour / windowHours, windowHours)} · ${formatDecimal(bar.duration, 1)}h`
    },
    [windowHours],
  )

  const formatBarMeta = useCallback((bar: { meta?: Record<string, unknown> }) => {
    const runs = bar.meta?.runs
    const outputQty = bar.meta?.outputQty
    if (typeof runs !== 'number' || typeof outputQty !== 'number') return ''
    return `${formatDecimal(runs, 0)} runs · ${formatDecimal(outputQty, 0)} output`
  }, [])

  const slotRingProps = useMemo(
    () =>
      lanes.map((lane, index) => ({
        slotIndex: index,
        active: lane.jobCount > 0,
        utilization: windowHours > 0 ? lane.busyHours / windowHours : 0,
        productTypeId: lane.bars[0]?.productTypeId,
        blueprintTypeId: lane.bars[0]?.productTypeId
          ? blueprintTypeIdByProduct.get(lane.bars[0].productTypeId)
          : undefined,
        productName: lane.bars[0]?.label,
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

      <SlotGanttChart
        lanes={lanes}
        formatTick={formatTick}
        formatBarRange={formatBarRange}
        formatBarMeta={formatBarMeta}
        blueprintTypeIdByProduct={blueprintTypeIdByProduct}
        focusedLaneId={focusedLaneId}
        onFocusedLaneChange={handleFocusedLaneChange}
        title="Job schedule"
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
