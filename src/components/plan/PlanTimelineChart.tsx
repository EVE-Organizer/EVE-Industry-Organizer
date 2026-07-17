import { useMemo } from 'react'
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Tooltip as UiTooltip, useAnchorTooltip } from '@/components/Tooltip'
import { PlanProductIcon } from '@/components/plan/PlanProductIcon'
import { collectPlanShortages } from '@/lib/planSimulator'
import {
  buildNodesForStockCharts,
  buildSlotLanes,
  buildStockSeries,
  buildTimelineTicks,
  downsampleStockSeries,
  formatHourTick,
  ganttBarColor,
  layoutLaneBars,
  timelineTickPosition,
  type PlanSlotBarLayout,
  type PlanSlotJobBar,
  type PlanSlotLane,
  type PlanStockPoint,
} from '@/lib/planTimelineChartData'
import { formatDecimal } from '@/lib/profit'
import type { PlanNode, PlanNodeSimulation, ScheduledPlanJob } from '@/types'

const GRID_STROKE = 'rgba(48, 54, 61, 0.9)'
const AXIS_TICK = { fill: 'rgba(230, 237, 243, 0.55)', fontSize: 11 }
const SUPPLY_FILL = 'rgba(74, 158, 255, 0.75)' // eve blue
const DEMAND_FILL = 'rgba(245, 166, 35, 0.75)' // eve orange
const STOCK_STROKE = '#3fb950' // success
const STOCK_STROKE_SHORT = '#f85149' // error
const BAR_ICON = 20

function StockTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ name?: string; value?: number }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const hour = typeof label === 'number' ? label : Number(label)

  return (
    <div className="rounded-lg border border-eve-border bg-base-200 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-base-content tabular-nums">{formatHourTick(hour)}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-base-content/70 tabular-nums">
          {entry.name}: {formatDecimal(Number(entry.value), 1)}
        </p>
      ))}
    </div>
  )
}

function shortageAreas(points: PlanStockPoint[]): { start: number; end: number }[] {
  const areas: { start: number; end: number }[] = []
  let start: number | null = null
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const nextHour = points[i + 1]?.hour ?? p.hour + 1
    if (p.inventory < 0 && start == null) start = p.hour
    if (p.inventory >= 0 && start != null) {
      areas.push({ start, end: p.hour })
      start = null
    }
    if (i === points.length - 1 && start != null) {
      areas.push({ start, end: nextHour })
    }
  }
  return areas
}

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
}: {
  lanes: PlanSlotLane[]
  windowHours: number
  blueprintTypeIdByProduct: Map<number, number>
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
            return (
            <div key={lane.slot} className="plan-timeline__lane">
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

function PlanStockChart({
  node,
  points,
  windowHours,
}: {
  node: PlanNode
  points: PlanStockPoint[]
  windowHours: number
}) {
  const areas = useMemo(() => shortageAreas(points), [points])
  const hasShortage = areas.length > 0
  const yMax = useMemo(() => {
    let m = 1
    for (const p of points) {
      m = Math.max(m, p.supply, p.demand, Math.abs(p.inventory))
    }
    return m * 1.1
  }, [points])

  if (points.length === 0) return null

  return (
    <div className="plan-timeline__stock-chart">
      <p className="plan-timeline__stock-title">
        {node.name}
        {hasShortage ? <span className="plan-timeline__stock-warn"> · short</span> : null}
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, Math.max(windowHours, 1)]}
            tick={AXIS_TICK}
            tickFormatter={(v) => formatHourTick(Number(v))}
          />
          <YAxis tick={AXIS_TICK} domain={[-yMax, yMax]} width={44} />
          <Tooltip content={<StockTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {areas.map((a) => (
            <ReferenceArea
              key={`${a.start}-${a.end}`}
              x1={a.start}
              x2={a.end}
              fill="rgba(248, 81, 73, 0.14)"
              strokeOpacity={0}
            />
          ))}
          <Bar dataKey="supply" name="Supply" fill={SUPPLY_FILL} barSize={6} />
          <Bar dataKey="demand" name="Demand" fill={DEMAND_FILL} barSize={6} />
          <Line
            type="monotone"
            dataKey="inventory"
            name="Stock"
            stroke={hasShortage ? STOCK_STROKE_SHORT : STOCK_STROKE}
            strokeWidth={2}
            dot={false}
          />
          <Brush
            dataKey="hour"
            height={20}
            stroke="rgba(245, 166, 35, 0.55)"
            fill="rgba(245, 166, 35, 0.08)"
            travellerWidth={8}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PlanTimelinePanel({
  windowHours,
  nodes,
  simulations,
  jobs,
  slots,
  blueprintTypeIdByProduct,
  embedded = false,
}: {
  windowHours: number
  nodes: PlanNode[]
  simulations: Map<number, PlanNodeSimulation>
  jobs: ScheduledPlanJob[]
  slots: number
  blueprintTypeIdByProduct: Map<number, number>
  embedded?: boolean
}) {
  const shortages = useMemo(
    () => collectPlanShortages(simulations, nodes),
    [simulations, nodes],
  )

  const uniqueShortCount = useMemo(
    () => new Set(shortages.map((s) => s.productTypeId)).size,
    [shortages],
  )

  const lanes = useMemo(() => buildSlotLanes(jobs, nodes, slots), [jobs, nodes, slots])

  const stockNodes = useMemo(
    () => buildNodesForStockCharts(nodes, jobs, simulations, 4),
    [nodes, jobs, simulations],
  )

  const body = (
    <>
      <div className="plan-timeline__hero">
        <UiTooltip
          text="Hour when the last scheduled job on this plan finishes, after packing work onto your industry slots. Not the ideal single-root job time."
          placement="bottom"
        >
          <p className="plan-timeline__finish">
            Finishes in{' '}
            <span className="plan-timeline__finish-value">{formatDecimal(windowHours, 1)}h</span>
          </p>
        </UiTooltip>

        <UiTooltip
          text={
            uniqueShortCount > 0
              ? 'A component is short when its stock goes negative because a parent job starts before enough supply is ready. See charts below for the worst cases.'
              : 'Every build node has enough supply when downstream jobs need it.'
          }
          placement="bottom"
        >
          <p
            className={`plan-timeline__status ${uniqueShortCount > 0 ? 'plan-timeline__status--warn' : 'plan-timeline__status--ok'}`}
          >
            {uniqueShortCount > 0
              ? `${uniqueShortCount} component${uniqueShortCount === 1 ? '' : 's'} short`
              : 'On track'}
          </p>
        </UiTooltip>

        <UiTooltip
          text={`${slots} concurrent industry ${slots === 1 ? 'slot' : 'slots'} from Mass Production and related skills.`}
          placement="bottom"
        >
          <p className="plan-timeline__slots cursor-help tabular-nums text-sm text-base-content/60">
            {slots} slot{slots === 1 ? '' : 's'}
          </p>
        </UiTooltip>
      </div>

      <PlanSlotSchedule
        lanes={lanes}
        windowHours={windowHours}
        blueprintTypeIdByProduct={blueprintTypeIdByProduct}
      />

      {stockNodes.length > 0 ? (
        <div className="plan-timeline__chart-block">
          <UiTooltip
            text="Hourly supply, demand, and stock for the worst shortages. Red bands mark short windows."
            placement="right"
          >
            <h3 className="plan-timeline__chart-title cursor-help">Component stock</h3>
          </UiTooltip>
          <div className="plan-timeline__stock-grid">
            {stockNodes.map((node) => (
              <PlanStockChart
                key={node.productTypeId}
                node={node}
                points={downsampleStockSeries(buildStockSeries(simulations.get(node.productTypeId)))}
                windowHours={windowHours}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="plan-timeline__on-track">Supply keeps up across the full plan.</p>
      )}
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
