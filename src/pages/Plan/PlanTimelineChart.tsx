import { useCallback, useMemo, useState } from 'react'
import { CharacterAvatar } from '@/components/EveImage'
import { Tooltip as UiTooltip } from '@/components/Tooltip'
import { SlotGanttChart } from '@/components/gantt/SlotGanttChart'
import { ManufacturingSlotsRow } from '@/components/plan/ManufacturingSlotRing'
import {
  buildPlanGanttLanes,
  formatPlanGanttTick,
  formatPlanScrubLabel,
  legendForPool,
  type PlanGanttCrewMember,
} from '@/pages/Plan/planGanttAdapter'
import { formatDecimal } from '@/lib/profit'
import { ChevronIcon } from '@/pages/Plan/planJobsTableCells'
import type { PlanNode, ScheduledPlanJob } from '@/types'

type TimelineTab = 'manufacturing' | 'reactions' | 'research'

function jobsForPool(jobs: ScheduledPlanJob[], pool: TimelineTab): ScheduledPlanJob[] {
  if (pool === 'research') {
    return jobs.filter(
      (j) => j.pool === 'science' || j.activity === 'copy' || j.activity === 'invention',
    )
  }
  if (pool === 'reactions') {
    return jobs.filter((j) => j.pool === 'reaction' || j.activity === 'reaction')
  }
  return jobs.filter(
    (j) =>
      (j.pool === 'manufacturing' ||
        (!j.pool &&
          j.activity !== 'reaction' &&
          j.activity !== 'copy' &&
          j.activity !== 'invention')) &&
      j.activity !== 'reaction',
  )
}

export function PlanTimelinePanel({
  windowHours,
  researchWindowHours,
  nodes,
  jobs,
  productionJobs,
  slots,
  scienceSlots = 1,
  reactionSlots = 1,
  blueprintTypeIdByProduct,
  embedded = false,
  onAddSlot,
  onRemoveSlot,
  slotBonuses = { manufacturing: 0, reactions: 0, research: 0 },
  planCrew = [],
}: {
  windowHours: number
  researchWindowHours?: number
  nodes: PlanNode[]
  jobs: ScheduledPlanJob[]
  productionJobs?: ScheduledPlanJob[]
  slots: number
  scienceSlots?: number
  reactionSlots?: number
  blueprintTypeIdByProduct: Map<number, number>
  embedded?: boolean
  onAddSlot?: (pool: TimelineTab) => void
  onRemoveSlot?: (pool: TimelineTab) => void
  slotBonuses?: { manufacturing: number; reactions: number; research: number }
  planCrew?: PlanGanttCrewMember[]
}) {
  const [tab, setTab] = useState<TimelineTab>('manufacturing')
  /** Idle slot rows in the Gantt (lanes with no jobs). Default off — only busy slot rows show. */
  const [showIdleTimelineSlots, setShowIdleTimelineSlots] = useState(false)
  const [focusedLaneId, setFocusedLaneId] = useState<string | null>(null)
  /** Collapsed character slot rows; default empty = all expanded. */
  const [collapsedSlotGroups, setCollapsedSlotGroups] = useState<Set<string>>(() => new Set())
  const scienceWindowHours = researchWindowHours ?? windowHours
  const timelineAxisHours = Math.max(windowHours, scienceWindowHours)
  const allProduction = productionJobs ?? jobs
  const mfgJobs = useMemo(() => jobsForPool(allProduction, 'manufacturing'), [allProduction])
  const rxnJobs = useMemo(() => jobsForPool(allProduction, 'reactions'), [allProduction])
  const sciJobs = useMemo(() => jobsForPool(jobs, 'research'), [jobs])

  const mfgLanes = useMemo(
    () => buildPlanGanttLanes(mfgJobs, nodes, slots, timelineAxisHours, 'manufacturing', planCrew),
    [mfgJobs, nodes, slots, timelineAxisHours, planCrew],
  )
  const reactionLanes = useMemo(
    () =>
      buildPlanGanttLanes(rxnJobs, nodes, reactionSlots, timelineAxisHours, 'reaction', planCrew),
    [rxnJobs, nodes, reactionSlots, timelineAxisHours, planCrew],
  )
  const scienceLanes = useMemo(
    () => buildPlanGanttLanes(sciJobs, nodes, scienceSlots, timelineAxisHours, 'science', planCrew),
    [sciJobs, nodes, scienceSlots, timelineAxisHours, planCrew],
  )

  const activePool =
    tab === 'research' ? 'science' : tab === 'reactions' ? 'reaction' : 'manufacturing'

  const activeLanes =
    tab === 'research' ? scienceLanes : tab === 'reactions' ? reactionLanes : mfgLanes

  const scheduleLanes = useMemo(
    () => (showIdleTimelineSlots ? activeLanes : activeLanes.filter((lane) => lane.jobCount > 0)),
    [activeLanes, showIdleTimelineSlots],
  )

  const handleSelectSlot = useCallback((_slotIndex: number, laneId?: string) => {
    if (!laneId) return
    setFocusedLaneId((prev) => (prev === laneId ? null : laneId))
  }, [])

  const toggleSlotGroup = useCallback((groupKey: string) => {
    setCollapsedSlotGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }, [])

  const handleFocusedLaneChange = useCallback((laneId: string | null) => {
    setFocusedLaneId(laneId)
  }, [])

  const handleTabChange = useCallback((next: TimelineTab) => {
    setTab(next)
    setFocusedLaneId(null)
  }, [])

  const formatTick = useCallback(
    (ratio: number) => formatPlanGanttTick(ratio, timelineAxisHours),
    [timelineAxisHours],
  )

  const formatScrub = useCallback(
    (ratio: number) => formatPlanScrubLabel(ratio, timelineAxisHours),
    [timelineAxisHours],
  )

  const formatBarRange = useCallback(
    (bar: { start: number; end: number; duration: number }) => {
      const startHour = bar.start * timelineAxisHours
      const endHour = bar.end * timelineAxisHours
      return `${formatPlanGanttTick(startHour / timelineAxisHours, timelineAxisHours)} – ${formatPlanGanttTick(endHour / timelineAxisHours, timelineAxisHours)} · ${formatDecimal(bar.duration, 1)}h`
    },
    [timelineAxisHours],
  )

  const formatBarMeta = useCallback((bar: { meta?: Record<string, unknown> }) => {
    const runs = bar.meta?.runs
    const outputQty = bar.meta?.outputQty
    const activity = bar.meta?.activity
    const count = bar.meta?.count
    const parts: string[] = []
    if (typeof activity === 'string') parts.push(activity)
    if (typeof count === 'number' && count > 1) {
      parts.push(`${formatDecimal(count, 0)} jobs`)
    }
    if (typeof runs === 'number' && typeof outputQty === 'number') {
      parts.push(`${formatDecimal(runs, 0)} runs · ${formatDecimal(outputQty, 0)} output`)
    } else if (typeof runs === 'number') {
      parts.push(`${formatDecimal(runs, 0)} runs`)
    }
    return parts.join(' · ')
  }, [])

  const slotRingPropsFor = useCallback(
    (lanes: typeof mfgLanes, idleMessage: string, utilizationWindowHours: number) =>
      lanes.map((lane) => {
        const slotMatch = /-(\d+)$/.exec(lane.id)
        const slotIndex = slotMatch ? Number(slotMatch[1]) : 0
        return {
          slotIndex,
          laneId: lane.id,
          active: lane.jobCount > 0,
          utilization: utilizationWindowHours > 0 ? lane.busyHours / utilizationWindowHours : 0,
          productTypeId: lane.bars[0]?.productTypeId,
          blueprintTypeId: lane.bars[0]?.productTypeId
            ? blueprintTypeIdByProduct.get(lane.bars[0].productTypeId)
            : undefined,
          productName: lane.bars[0]?.label,
          idleMessage,
        }
      }),
    [blueprintTypeIdByProduct],
  )

  const mfgSlotRingProps = useMemo(
    () => slotRingPropsFor(mfgLanes, 'Please install blueprint', windowHours),
    [mfgLanes, slotRingPropsFor, windowHours],
  )
  const reactionSlotRingProps = useMemo(
    () => slotRingPropsFor(reactionLanes, 'Idle reaction slot', windowHours),
    [reactionLanes, slotRingPropsFor, windowHours],
  )
  const scienceSlotRingProps = useMemo(
    () => slotRingPropsFor(scienceLanes, 'Idle research slot', scienceWindowHours),
    [scienceLanes, slotRingPropsFor, scienceWindowHours],
  )

  const activeSlotRingProps =
    tab === 'research'
      ? scienceSlotRingProps
      : tab === 'reactions'
        ? reactionSlotRingProps
        : mfgSlotRingProps

  const activeBonus =
    tab === 'research'
      ? slotBonuses.research
      : tab === 'reactions'
        ? slotBonuses.reactions
        : slotBonuses.manufacturing

  const legend = legendForPool(activePool)
  const hasCrew = planCrew.length > 0
  const slotRingGroups = useMemo(() => {
    if (!hasCrew) {
      return [
        {
          key: 'plan',
          label: null as string | null,
          characterId: undefined,
          slots: activeSlotRingProps,
        },
      ]
    }
    const byGroup = new Map<
      string,
      { key: string; label: string; characterId?: number; slots: typeof activeSlotRingProps }
    >()
    for (const lane of activeLanes) {
      const groupKey = lane.groupId ?? lane.id
      const existing = byGroup.get(groupKey)
      const ring = activeSlotRingProps.find((slot) => slot.laneId === lane.id)
      if (!ring) continue
      if (existing) {
        existing.slots.push(ring)
        continue
      }
      byGroup.set(groupKey, {
        key: groupKey,
        label: lane.groupLabel ?? lane.characterName ?? 'Slots',
        characterId: lane.characterId,
        slots: [ring],
      })
    }
    return [...byGroup.values()]
  }, [hasCrew, activeLanes, activeSlotRingProps])

  const slotTooltip =
    tab === 'research'
      ? `${scienceSlots} research slots${hasCrew ? ' across this plan’s characters' : ''}${activeBonus > 0 ? ` (${scienceSlots - activeBonus} from skills + ${activeBonus} bonus)` : hasCrew ? '' : ' from Laboratory Operation skills (copy and invention)'}. Click a slot to highlight its row.`
      : tab === 'reactions'
        ? `${reactionSlots} reaction slots${hasCrew ? ' across this plan’s characters' : ''}${activeBonus > 0 ? ` (${reactionSlots - activeBonus} from skills + ${activeBonus} bonus)` : hasCrew ? '' : ' from Mass Reactions skills'}. Click a slot to highlight its row.`
        : `${slots} manufacturing slots${hasCrew ? ' across this plan’s characters' : ''}${activeBonus > 0 ? ` (${slots - activeBonus} from skills + ${activeBonus} bonus)` : hasCrew ? '' : ' from Mass Production skills'}. Click a slot to highlight its row.`

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
        id="plan-timeline-tab-reactions"
        aria-selected={tab === 'reactions'}
        aria-controls="plan-timeline-panel-reactions"
        className={`plan-timeline__tab${tab === 'reactions' ? ' plan-timeline__tab--active' : ''}`}
        onClick={() => handleTabChange('reactions')}
      >
        Reactions
        <span className="plan-timeline__tab-count">{reactionSlots}</span>
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
            text="Hour when the last scheduled job finishes (manufacturing, reactions, copy, and invention)."
            placement="bottom"
          >
            <p className="plan-timeline__finish">
              Finishes in{' '}
              <span className="plan-timeline__finish-value">
                {formatDecimal(timelineAxisHours, 1)}h
              </span>
            </p>
          </UiTooltip>
          {embedded ? tabs : null}
        </div>

        <UiTooltip
          text={slotTooltip}
          placement="bottom"
          className="flex w-full min-w-0 self-stretch"
        >
          <div
            className="plan-timeline__slots-panel"
            role="tabpanel"
            id={`plan-timeline-panel-${tab}`}
            aria-labelledby={`plan-timeline-tab-${tab}`}
          >
            <div className="plan-timeline__slot-groups">
              {slotRingGroups.map((group, groupIndex) => {
                const slotsExpanded = !group.label || !collapsedSlotGroups.has(group.key)
                return (
                  <div key={group.key} className="plan-timeline__slot-group">
                    {group.label ? (
                      <button
                        type="button"
                        className="plan-timeline__slot-group-head"
                        aria-expanded={slotsExpanded}
                        onClick={() => toggleSlotGroup(group.key)}
                      >
                        <ChevronIcon open={slotsExpanded} />
                        <CharacterAvatar
                          characterId={group.characterId}
                          name={group.label}
                          size={24}
                        />
                        <span className="truncate text-xs font-medium">{group.label}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-[10px] opacity-50">
                          {group.slots.filter((slot) => slot.active).length}/{group.slots.length}{' '}
                          busy
                        </span>
                      </button>
                    ) : null}
                    {slotsExpanded ? (
                      <ManufacturingSlotsRow
                        slots={group.slots}
                        selectedLaneId={focusedLaneId}
                        onSelectSlot={handleSelectSlot}
                        onAddSlot={
                          groupIndex === slotRingGroups.length - 1 && onAddSlot
                            ? () => onAddSlot(tab)
                            : undefined
                        }
                        onRemoveSlot={
                          groupIndex === slotRingGroups.length - 1 && onRemoveSlot
                            ? () => onRemoveSlot(tab)
                            : undefined
                        }
                        canRemoveSlot={activeBonus > 0}
                        addSlotLabel={
                          tab === 'research'
                            ? 'Add research slot'
                            : tab === 'reactions'
                              ? 'Add reaction slot'
                              : 'Add manufacturing slot'
                        }
                        removeSlotLabel={
                          tab === 'research'
                            ? 'Remove research slot'
                            : tab === 'reactions'
                              ? 'Remove reaction slot'
                              : 'Remove manufacturing slot'
                        }
                        emptyHint={
                          tab === 'research'
                            ? 'Idle research slot'
                            : tab === 'reactions'
                              ? 'Idle reaction slot'
                              : 'Please install blueprint'
                        }
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </UiTooltip>
      </div>

      <SlotGanttChart
        lanes={scheduleLanes}
        formatTick={formatTick}
        formatScrub={formatScrub}
        formatBarRange={formatBarRange}
        formatBarMeta={formatBarMeta}
        blueprintTypeIdByProduct={blueprintTypeIdByProduct}
        focusedLaneId={focusedLaneId}
        onFocusedLaneChange={handleFocusedLaneChange}
        title={
          tab === 'research'
            ? 'Research schedule'
            : tab === 'reactions'
              ? 'Reaction schedule'
              : 'Manufacturing schedule'
        }
        titleAside={
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <ul className="plan-timeline__legend" aria-label="Job colors">
              {legend.map((item) => (
                <li key={item.activity} className="plan-timeline__legend-item">
                  <span
                    className="plan-timeline__legend-swatch"
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  {item.label}
                </li>
              ))}
            </ul>
            <label className="label cursor-pointer shrink-0 gap-2 py-0">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={showIdleTimelineSlots}
                onChange={(event) => setShowIdleTimelineSlots(event.target.checked)}
              />
              <span className="label-text text-sm font-normal">Show idle slots</span>
            </label>
          </div>
        }
        emptyMessage={
          (tab === 'research' ? sciJobs : tab === 'reactions' ? rxnJobs : mfgJobs).length > 0
            ? undefined
            : tab === 'research'
              ? 'No copy or invention jobs on this plan.'
              : tab === 'reactions'
                ? 'No reaction jobs on this plan.'
                : 'No manufacturing jobs on this plan yet. Add blueprints and assign owners to see who runs which slot.'
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
