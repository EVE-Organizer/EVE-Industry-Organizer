export interface GanttBar {
  id: string
  label: string
  start: number
  end: number
  duration: number
  productTypeId?: number
  color?: string
  meta?: Record<string, unknown>
}

export interface GanttLane {
  id: string
  label: string
  sublabel?: string
  bars: GanttBar[]
  jobCount: number
  busyHours: number
  endHour: number
}

export interface GanttBarLayout {
  left: string
  width: string
  /** Rendered left edge on the lane track (%). */
  leftPct: number
  /** Rendered bar width on the lane track (%), may exceed true visual span. */
  widthPct: number
  visualWidthPct: number
  row: number
}
