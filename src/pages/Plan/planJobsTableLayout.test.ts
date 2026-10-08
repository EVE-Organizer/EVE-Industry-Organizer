import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_JOBS_SCROLL_ORDER,
  defaultPlanJobsLayout,
  movePlanJobsColumn,
  filterLayoutToCoreColumns,
  parsePlanJobsLayout,
  resizePlanJobsColumn,
} from '@/pages/Plan/planJobsTableLayout'

describe('planJobsTableLayout', () => {
  it('moves a column to the position of the drop target', () => {
    const moved = movePlanJobsColumn(defaultPlanJobsLayout(), 'profit', 'runs')
    expect(moved.order[0]).toBe('profit')
    expect(moved.order).toHaveLength(DEFAULT_PLAN_JOBS_SCROLL_ORDER.length)
  })

  it('clamps resized widths', () => {
    const layout = resizePlanJobsColumn(defaultPlanJobsLayout(), 'runs', 5)
    expect(layout.widths.runs).toBe(84)
    expect(resizePlanJobsColumn(layout, 'runs', 9999).widths.runs).toBe(140)
  })

  it('falls back to defaults for missing or corrupt storage', () => {
    expect(parsePlanJobsLayout(null)).toEqual(defaultPlanJobsLayout())
    expect(parsePlanJobsLayout('{nope')).toEqual(defaultPlanJobsLayout())
    expect(defaultPlanJobsLayout().timeMode).toBe('duration')
  })

  it('drops unknown ids and appends columns added since the layout was saved', () => {
    const saved = JSON.stringify({
      order: ['margin', 'ghost', 'runs', 'runs'],
      widths: { runs: 100 },
    })
    const layout = parsePlanJobsLayout(saved)
    expect(layout.order.slice(0, 2)).toEqual(['runs', 'duration'])
    expect(layout.order).toHaveLength(DEFAULT_PLAN_JOBS_SCROLL_ORDER.length)
    expect(layout.widths.runs).toBe(100)
    expect(layout.order).not.toContain('readyBy')
  })

  it('filterLayoutToCoreColumns keeps core order and drops extra columns', () => {
    const full = parsePlanJobsLayout(
      JSON.stringify({
        order: ['bpos', 'owner', 'runs', 'progress', 'duration'],
        widths: { runs: 90, bpos: 70, owner: 60 },
        timeMode: 'readyBy',
      }),
    )
    const core = filterLayoutToCoreColumns(full)
    expect(core.order).toEqual([
      'runs',
      'duration',
      'bpos',
      'owner',
      'output',
      'have',
      'volume',
      'setup',
      'profit',
    ])
    expect(core.widths.runs).toBe(90)
    expect(core.widths.bpos).toBe(96)
    expect(core.timeMode).toBe('duration')
    expect(core.widths.margin).toBe(88)
  })

  it('merges a legacy Ready by column into the duration slot and keeps time mode', () => {
    const saved = JSON.stringify({
      order: ['runs', 'readyBy', 'duration'],
      widths: { readyBy: 200 },
      timeMode: 'readyBy',
    })
    const layout = parsePlanJobsLayout(saved)
    expect(layout.order).toEqual(DEFAULT_PLAN_JOBS_SCROLL_ORDER)
    expect(layout.widths.duration).toBe(149)
    expect(layout.timeMode).toBe('readyBy')
  })
})
