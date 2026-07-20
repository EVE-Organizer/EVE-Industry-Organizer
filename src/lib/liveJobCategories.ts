import type { IndustryActivityId, LiveIndustryJob, LiveIndustryJobStatus } from '@/types'

/** ESI can still report `active` until the next fetch after `end_date`. */
export function effectiveLiveJobStatus(
  job: Pick<LiveIndustryJob, 'status' | 'endAt'>,
  nowMs = Date.now(),
): LiveIndustryJobStatus {
  if (job.status === 'active' && nowMs >= Date.parse(job.endAt)) {
    return 'ready'
  }
  return job.status
}

export function isTrackedLiveJob(
  job: Pick<LiveIndustryJob, 'status' | 'endAt'>,
  nowMs = Date.now(),
): boolean {
  const status = effectiveLiveJobStatus(job, nowMs)
  return status === 'active' || status === 'ready' || status === 'paused'
}

export type LiveJobsTab = 'manufacturing' | 'research'

/** EVE SDE eveIcons IDs (images.evetech.net/types/{id}/icon). */
export const LIVE_JOBS_TAB_ICON_TYPE_ID: Record<LiveJobsTab, number> = {
  manufacturing: 24656, // Industry/activity/manufacturing.png
  research: 24658, // Industry/activity/researchMaterial.png
}

const MANUFACTURING_IDS = new Set<IndustryActivityId>([1, 7, 8, 11])
const RESEARCH_IDS = new Set<IndustryActivityId>([3, 4, 5])

export function isLiveManufacturingJob(job: LiveIndustryJob): boolean {
  return MANUFACTURING_IDS.has(job.activityId)
}

export function isLiveResearchJob(job: LiveIndustryJob): boolean {
  return RESEARCH_IDS.has(job.activityId)
}

export function filterJobsByTab<T extends LiveIndustryJob>(jobs: T[], tab: LiveJobsTab): T[] {
  return jobs.filter(tab === 'manufacturing' ? isLiveManufacturingJob : isLiveResearchJob)
}

/** BPO scroll behind product icon; omit when both type IDs match (typical research jobs). */
export function blueprintStackTypeId(job: LiveIndustryJob): number | undefined {
  if (job.productTypeId === job.blueprintTypeId) return undefined
  return job.blueprintTypeId
}

export function blueprintTypeIdMapFromJobs(jobs: LiveIndustryJob[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const job of jobs) {
    const blueprintTypeId = blueprintStackTypeId(job)
    if (blueprintTypeId != null) {
      map.set(job.productTypeId, blueprintTypeId)
    }
  }
  return map
}

export function researchSlotsEstimate(activeJobs: LiveIndustryJob[]): number {
  return Math.min(11, Math.max(1, activeJobs.length))
}
