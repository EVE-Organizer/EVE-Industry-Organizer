import { useCallback, useMemo, useState } from 'react'
import { Tooltip as UiTooltip } from '@/components/Tooltip'
import { SlotGanttChart } from '@/components/gantt/SlotGanttChart'
import { ManufacturingSlotsRow } from '@/components/plan/ManufacturingSlotRing'
import { buildPlanGanttLanes, formatPlanGanttTick, formatPlanScrubLabel } from '@/lib/planGanttAdapter'
import { formatDecimal } from '@/lib/profit'
import type { PlanNode, ScheduledPlanJob } from '@/types'

type TimelineTab = 'manufacturing' | 'research'

export function PlanTimelinePanel({
  windowHours,
  nodes,
  jobs,
  slots,
  scienceSlots = 1,
  blueprintTypeIdByProduct,
  embedded = false,
}: {
  windowHours: number
  nodes: PlanNode[]
  jobs: ScheduledPlanJob[]
  slots: number
  scienceSlots?: number
  blueprintTypeIdByProduct: Map<number, number>
  embedded?: boolean
}) {
  const [tab, setTab] = useState<TimelineTab>('manufacturing')
  const [focusedSlotIndex, setFocusedSlotIndex] = useState<number | null>(null)

  const mfgLanes = useMemo(
    () => buildPlanGanttLanes(jobs, nodes, slots, windowHours, 'manufacturing'),
    [jobs, nodes, slots, windowHours],
  )
  const scienceLanes = useMemo(
    () => buildPlanGanttLanes(jobs, nodes, scienceSlots, windowHours, 'science'),
    [jobs, nodes, scienceSlots, windowHours],
  )

  const activePool = tab === 'research' ? 'science' : 'manufacturing'
  const activeLanes = tab === 'research' ? scienceLanes : mfgLanes

  const focusedLaneId =
    focusedSlotIndex != null ? `${activePool}-slot-${focusedSlotIndex}` : null

  const handleSelectSlot = useCallback((slotIndex: number) => {
    setFocusedSlotIndex((prev) => (prev === slotIndex ? null : slotIndex))
  }, [])

  const handleFocusedLaneChange = useCallback(
    (laneId: string | null) => {
      if (laneId == null) {
        setFocusedSlotIndex(null)
        return
      }
      const match = /^(manufacturing|science)-slot-(\d+)$/.exec(laneId)
      if (match && match[1] === activePool) {
        setFocusedSlotIndex(Number(match[2]))
      }
    },
    [activePool],
  )

  const handleTabChange = useCallback((next: TimelineTab) => {
    setTab(next)
    setFocusedSlotIndex(null)
  }, [])

  const formatTick = useCallback(
    (ratio: number) => formatPlanGanttTick(ratio, windowHours),
    [windowHours],
  )

  const formatScrub = useCallback(
    (ratio: number) => formatPlanScrubLabel(ratio, windowHours),
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
    const activity = bar.meta?.activity
    const parts: string[] = []
    if (typeof activity === 'string') parts.push(activity)
    if (typeof runs === 'number' && typeof outputQty === 'number') {
      parts.push(`${formatDecimal(runs, 0)} runs · ${formatDecimal(outputQty, 0)} output`)
    } else if (typeof runs === 'number') {
      parts.push(`${formatDecimal(runs, 0)} runs`)
    }
    return parts.join(' · ')
  }, [])

  const mfgSlotRingProps = useMemo(
    () =>
      mfgLanes.map((lane, index) => ({
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
    [mfgLanes, windowHours, blueprintTypeIdByProduct],
  )

  const scienceSlotRingProps = useMemo(
    () =>
      scienceLanes.map((lane, index) => ({
        slotIndex: index,
        active: lane.jobCount > 0,
        utilization: windowHours > 0 ? lane.busyHours / windowHours : 0,
        productTypeId: lane.bars[0]?.productTypeId,
        blueprintTypeId: lane.bars[0]?.productTypeId
          ? blueprintTypeIdByProduct.get(lane.bars[0].productTypeId)
          : undefined,
        productName: lane.bars[0]?.label,
        idleMessage: 'Idle research slot',
      })),
    [scienceLanes, windowHours, blueprintTypeIdByProduct],
  )

  const tabs = (
    <div className="plan-timeline__tabs" role="tablist" aria-label="Timeline pool">
      <button
        type="button"
        role="tab"
        id="plan-timeline-tab-manufacturing"
        aria-selected={tab === 'manufacturing'}
        aria-controls="plan-timeline-panel-manufacturing"
        className={`plan-timeline__tab${tab === 'manufacturing' ? ' plan-timeline__tab--active' : ''}`}
        onClick={() => handleTabChange('manufacturing')}
      >
        Manufacturing
        <span className="plan-timeline__tab-count">{slots}</span>
      </button>
      <button
        type="button"
        role="tab"
        id="plan-timeline-tab-research"
        aria-selected={tab === 'research'}
        aria-controls="plan-timeline-panel-research"
        className={`plan-timeline__tab${tab === 'research' ? ' plan-timeline__tab--active' : ''}`}
        onClick={() => handleTabChange('research')}
      >
        Research
        <span className="plan-timeline__tab-count">{scienceSlots}</span>
      </button>
    </div>
  )

  const body = (
    <>
      <div className="plan-timeline__hero">
        <div className="plan-timeline__hero-top">
          <UiTooltip
            text="Hour when the last scheduled job on this plan finishes, after packing work onto manufacturing and research slots."
            placement="bottom"
          >
            <p className="plan-timeline__finish">
              Finishes in{' '}
              <span className="plan-timeline__finish-value">{formatDecimal(windowHours, 1)}h</span>
            </p>
          </UiTooltip>
          {embedded ? tabs : null}
        </div>

        <UiTooltip
          text={
            tab === 'research'
              ? `${scienceSlots} research slots from Laboratory Operation skills (copy and invention). Click a slot to highlight its row.`
              : `${slots} manufacturing slots from Mass Production skills. Click a slot to highlight its row.`
          }
          placement="bottom"
          className="flex w-full min-w-0 self-stretch"
        >
          <div
            className="plan-timeline__slots-panel"
            role="tabpanel"
            id={`plan-timeline-panel-${tab}`}
            aria-labelledby={`plan-timeline-tab-${tab}`}
          >
            <ManufacturingSlotsRow
              slots={tab === 'research' ? scienceSlotRingProps : mfgSlotRingProps}
              selectedSlotIndex={focusedSlotIndex}
              onSelectSlot={handleSelectSlot}
              emptyHint={tab === 'research' ? 'Idle research slot' : 'Please install blueprint'}
            />
          </div>
        </UiTooltip>
      </div>

      <SlotGanttChart
        lanes={activeLanes}
        formatTick={formatTick}
        formatScrub={formatScrub}
        formatBarRange={formatBarRange}
        formatBarMeta={formatBarMeta}
        blueprintTypeIdByProduct={blueprintTypeIdByProduct}
        focusedLaneId={focusedLaneId}
        onFocusedLaneChange={handleFocusedLaneChange}
        title={tab === 'research' ? 'Research schedule' : 'Manufacturing schedule'}
        emptyMessage={
          tab === 'research'
            ? 'No copy or invention jobs on this plan yet. Build a T2 root to schedule research.'
            : undefined
        }
      />
    </>
  )

  if (embedded) return body

  return (
    <section className="plan-build-card plan-timeline">
      <div className="plan-build-card__header plan-timeline__header">
        <h2 className="plan-build-card__title">Plan timeline</h2>
        {tabs}
      </div>
      <div className="plan-build-card__body plan-timeline__body">{body}</div>
    </section>
  )
}

/** @deprecated Use PlanTimelinePanel */
export const PlanTimelineChart = PlanTimelinePanel
