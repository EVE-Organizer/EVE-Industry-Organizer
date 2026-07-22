import type { LiveIndustryJob } from '@/types'
import type { GanttBar, GanttLane } from '@/components/gantt/ganttTypes'
import { ganttBarColor } from '@/lib/planTimelineChartData'

export interface LiveTimelineWindow {
  startMs: number
  endMs: number
  spanMs: number
}

export function buildLiveTimelineWindow(jobs: LiveIndustryJob[], nowMs = Date.now()): LiveTimelineWindow {
  const activeJobs = jobs.filter((j) => j.status === 'active' || j.status === 'ready' || j.status === 'paused')
  if (activeJobs.length === 0) {
    const endMs = nowMs + 24 * 60 * 60 * 1000
    return { startMs: nowMs, endMs, spanMs: endMs - nowMs }
  }

  const starts = activeJobs.map((j) => Date.parse(j.startAt))
  const ends = activeJobs.map((j) => Date.parse(j.endAt))
  const startMs = Math.min(nowMs, ...starts)
  const endMs = Math.max(nowMs + 60 * 60 * 1000, ...ends)
  return { startMs, endMs, spanMs: Math.max(endMs - startMs, 60 * 60 * 1000) }
}

function normalizeMs(value: number, window: LiveTimelineWindow): number {
  return (value - window.startMs) / window.spanMs
}

export function liveJobsToGanttLanes(
  jobs: LiveIndustryJob[],
  slotCount: number,
  window: LiveTimelineWindow,
): GanttLane[] {
  const activeJobs = [...jobs]
    .filter((j) => j.status === 'active' || j.status === 'ready' || j.status === 'paused')
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))

  const slots = Math.max(1, slotCount)
  const slotEnds = Array.from({ length: slots }, () => window.startMs)
  const bySlot = Array.from({ length: slots }, () => [] as LiveIndustryJob[])

  for (const job of activeJobs) {
    const startMs = Date.parse(job.startAt)
    const endMs = Date.parse(job.endAt)
    let slot = 0
    for (let s = 1; s < slots; s += 1) {
      if (slotEnds[s]! <= slotEnds[slot]!) slot = s
    }
    if (startMs < slotEnds[slot]!) {
      const alt = slotEnds.findIndex((end) => end <= startMs)
      if (alt !== -1) slot = alt
    }
    bySlot[slot]!.push(job)
    slotEnds[slot] = Math.max(slotEnds[slot]!, endMs)
  }

  return bySlot.map((slotJobs, slotIndex) => {
    const bars: GanttBar[] = slotJobs.map((job, index) => {
      const startMs = Date.parse(job.startAt)
      const endMs = Date.parse(job.endAt)
      const durationHours = Math.max(0.01, (endMs - startMs) / (60 * 60 * 1000))
      return {
        id: `${job.jobId}-${slotIndex}-${index}`,
        label: job.productName,
        start: normalizeMs(startMs, window),
        end: normalizeMs(endMs, window),
        duration: durationHours,
        productTypeId: job.productTypeId,
        color: ganttBarColor(0, job.activityId === 1),
        meta: { job },
      }
    })

    const busyMs = slotJobs.reduce((sum, job) => {
      const startMs = Math.max(Date.parse(job.startAt), window.startMs)
      const endMs = Math.min(Date.parse(job.endAt), window.endMs)
      return sum + Math.max(0, endMs - startMs)
    }, 0)

    const endHour = busyMs / (60 * 60 * 1000)
    return {
      id: `slot-${slotIndex}`,
      label: `Slot ${slotIndex + 1}`,
      sublabel: `${slotJobs.length} job${slotJobs.length === 1 ? '' : 's'}`,
      bars,
      jobCount: slotJobs.length,
      busyHours: endHour,
      endHour,
    }
  })
}

export function formatLiveTick(ratio: number, window: LiveTimelineWindow): string {
  const ms = window.startMs + ratio * window.spanMs
  const date = new Date(ms)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeOffset(targetMs: number, nowMs: number): string {
  const deltaMs = targetMs - nowMs
  const absMs = Math.abs(deltaMs)
  if (absMs < 60_000) {
    if (deltaMs > 0) return 'less than 1m from now'
    if (deltaMs < 0) return 'less than 1m ago'
    return 'now'
  }

  const totalMinutes = Math.round(absMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  let label: string
  if (hours > 48) {
    const days = Math.floor(hours / 24)
    label = `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    label = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  } else {
    label = `${minutes}m`
  }

  if (deltaMs > 0) return `${label} from now`
  if (deltaMs < 0) return `${label} ago`
  return 'now'
}

export function formatLiveScrubLabel(
  ratio: number,
  window: LiveTimelineWindow,
  nowMs: number,
): string {
  const ms = window.startMs + ratio * window.spanMs
  return `${formatLiveTick(ratio, window)} · ${formatRelativeOffset(ms, nowMs)}`
}

export interface LiveJobProgress {
  ratio: number
  remainingMs: number
  animating: boolean
}

export function liveJobProgress(job: LiveIndustryJob, nowMs: number): LiveJobProgress {
  const startMs = Date.parse(job.startAt)
  const endMs = Date.parse(job.endAt)
  const spanMs = endMs - startMs
  if (spanMs <= 0) {
    return { ratio: 1, remainingMs: 0, animating: false }
  }

  if (job.status === 'ready' || nowMs >= endMs) {
    return { ratio: 1, remainingMs: 0, animating: false }
  }
  if (nowMs <= startMs) {
    return {
      ratio: 0,
      remainingMs: endMs - nowMs,
      animating: false,
    }
  }

  const ratio = Math.min(1, Math.max(0, (nowMs - startMs) / spanMs))
  const remainingMs = Math.max(0, endMs - nowMs)
  return {
    ratio,
    remainingMs,
    animating: job.status === 'active' && remainingMs > 0,
  }
}

export function formatCountdown(endAt: string, nowMs = Date.now()): string {
  const remainingMs = Date.parse(endAt) - nowMs
  if (remainingMs <= 0) return 'Ready'
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 48) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
