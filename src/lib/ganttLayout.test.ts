import { describe, expect, it } from 'vitest'
import {
  barProgressFillRatio,
  layoutLaneBarsFromNormalized,
  timelineNormalizedRatioFromVisual,
  timelineTickPositionFromNormalized,
} from '@/lib/ganttLayout'
import type { GanttBar } from '@/components/gantt/ganttTypes'

const bar: GanttBar = {
  id: 'job-1',
  label: 'Test',
  start: 0.2,
  end: 0.8,
  duration: 12,
}

describe('barProgressFillRatio', () => {
  it('aligns fill edge with the now marker on the visual timeline', () => {
    const { layouts } = layoutLaneBarsFromNormalized([bar])
    const layout = layouts.get(bar.id)!
    const nowRatio = 0.5

    const fillRatio = barProgressFillRatio(bar, nowRatio, layout.leftPct, layout.widthPct)
    const nowPosPct = parseFloat(timelineTickPositionFromNormalized(nowRatio))
    const fillEdgePct = layout.leftPct + fillRatio * layout.widthPct

    expect(fillEdgePct).toBeCloseTo(nowPosPct, 5)
  })

  it('clamps before start and after end', () => {
    const { layouts } = layoutLaneBarsFromNormalized([bar])
    const layout = layouts.get(bar.id)!

    expect(barProgressFillRatio(bar, 0, layout.leftPct, layout.widthPct)).toBe(0)
    expect(barProgressFillRatio(bar, 1, layout.leftPct, layout.widthPct)).toBe(1)
  })
})

describe('timelineNormalizedRatioFromVisual', () => {
  it('inverts the visual timeline mapping', () => {
    const ratio = 0.42
    const visual = parseFloat(timelineTickPositionFromNormalized(ratio)) / 100
    expect(timelineNormalizedRatioFromVisual(visual)).toBeCloseTo(ratio, 5)
  })

  it('clamps to 0 and 1', () => {
    expect(timelineNormalizedRatioFromVisual(-0.2)).toBe(0)
    expect(timelineNormalizedRatioFromVisual(1.2)).toBe(1)
  })
})
