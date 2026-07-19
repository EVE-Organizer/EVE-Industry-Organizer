import type { GanttBar, GanttBarLayout } from '@/components/gantt/ganttTypes'
import {
  TIMELINE_MIN_BAR_WIDTH_PCT,
  TIMELINE_VISUAL_EXPONENT,
  timelineVisualRatio,
} from '@/lib/planTimelineChartData'

export function buildTimelineTicks(span = 1, count = 5): number[] {
  if (count <= 1) return [0, span]
  const ticks: number[] = []
  for (let i = 0; i < count; i += 1) {
    ticks.push((span * i) / (count - 1))
  }
  return ticks
}

export function timelineTickPositionFromNormalized(ratio: number): string {
  const visual = Math.pow(Math.max(0, Math.min(ratio, 1)), TIMELINE_VISUAL_EXPONENT)
  return `${visual * 100}%`
}

function normalizedBarStyle(bar: Pick<GanttBar, 'start' | 'duration' | 'end'>): {
  leftPct: number
  widthPct: number
  visualWidthPct: number
} {
  const start = Math.max(0, Math.min(bar.start, 1))
  const end = Math.max(start, Math.min(bar.end ?? start + bar.duration / 24, 1))
  const leftPct = timelineVisualRatio(start, 1) * 100
  const rightPct = timelineVisualRatio(end, 1) * 100
  const visualWidthPct = rightPct - leftPct
  const widthPct = Math.min(
    Math.max(visualWidthPct, TIMELINE_MIN_BAR_WIDTH_PCT),
    Math.max(0.35, 100 - leftPct),
  )
  return { leftPct, widthPct, visualWidthPct }
}

function intervalsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end - 0.001 && b.start < a.end - 0.001
}

export function layoutLaneBarsFromNormalized(
  bars: GanttBar[],
  minWidthPct = TIMELINE_MIN_BAR_WIDTH_PCT,
): { layouts: Map<string, GanttBarLayout>; rowCount: number } {
  const sorted = [...bars].sort((a, b) => a.start - b.start || a.duration - b.duration)
  const layouts = new Map<string, GanttBarLayout>()
  const rowIntervals: { start: number; end: number }[][] = []

  for (const bar of sorted) {
    const styled = normalizedBarStyle(bar)
    const leftPct = styled.leftPct
    const widthPct = Math.min(
      Math.max(styled.visualWidthPct, minWidthPct),
      Math.max(0.35, 100 - leftPct),
    )
    const interval = { start: leftPct, end: leftPct + widthPct }

    let row = 0
    for (; row < rowIntervals.length; row += 1) {
      const overlaps = rowIntervals[row]!.some((existing) => intervalsOverlap(interval, existing))
      if (!overlaps) break
    }

    if (row === rowIntervals.length) rowIntervals.push([])
    rowIntervals[row]!.push(interval)

    layouts.set(bar.id, {
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      leftPct,
      widthPct,
      visualWidthPct: widthPct,
      row,
    })
  }

  return { layouts, rowCount: Math.max(1, rowIntervals.length) }
}

/** Fill ratio (0–1) so the progress edge meets the now marker on the lane track. */
export function barProgressFillRatio(
  bar: Pick<GanttBar, 'start' | 'end'>,
  nowRatio: number,
  leftPct: number,
  widthPct: number,
): number {
  if (widthPct <= 0) return 0
  const nowVisualPct = timelineVisualRatio(nowRatio, 1) * 100
  return Math.min(1, Math.max(0, (nowVisualPct - leftPct) / widthPct))
}

export function planHoursToNormalizedBar(
  bar: { startHour: number; endHour: number; durationHours: number },
  windowHours: number,
): Pick<GanttBar, 'start' | 'end' | 'duration'> {
  const span = Math.max(windowHours, 1)
  return {
    start: bar.startHour / span,
    end: bar.endHour / span,
    duration: bar.durationHours,
  }
}
