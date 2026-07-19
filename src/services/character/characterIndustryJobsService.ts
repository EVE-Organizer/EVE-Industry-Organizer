import type { IndustryActivityId, LiveIndustryJob, LiveIndustryJobStatus } from '@/types'
import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'
import { esiAuthGet } from '@/services/character/esiAuthFetch'
import { getCached } from '@/services/cache/cacheStore'

export interface EsiIndustryJob {
  job_id: number
  installer_id: number
  facility_id: number
  location_id: number
  activity_id: number
  blueprint_id: number
  blueprint_type_id: number
  blueprint_location_id: number
  output_location_id: number
  runs: number
  cost?: number
  licensed_runs?: number
  status: string
  duration: number
  start_date: string
  end_date: string
  pause_date?: string
  completed_date?: string
  completed_character_id?: number
  successful_runs?: number
  product_type_id?: number
}

const ACTIVITY_LABELS: Record<number, string> = {
  1: 'Manufacturing',
  3: 'TE research',
  4: 'ME research',
  5: 'Copying',
  7: 'Reaction',
  8: 'Biochemical',
  11: 'Reverse engineering',
}

function mapJobStatus(status: string): LiveIndustryJobStatus {
  switch (status) {
    case 'active':
    case 'paused':
    case 'ready':
    case 'delivered':
    case 'cancelled':
    case 'reverted':
      return status
    default:
      return 'active'
  }
}

export function mapEsiIndustryJob(
  job: EsiIndustryJob,
  characterId: number,
  productName: string,
): LiveIndustryJob {
  const activityId = job.activity_id as IndustryActivityId
  const productTypeId = job.product_type_id ?? job.blueprint_type_id
  return {
    jobId: job.job_id,
    characterId,
    installerId: job.installer_id,
    blueprintId: job.blueprint_id,
    activityId,
    activityLabel: ACTIVITY_LABELS[job.activity_id] ?? `Activity ${job.activity_id}`,
    blueprintTypeId: job.blueprint_type_id,
    productTypeId,
    productName,
    facilityId: job.facility_id,
    locationId: job.location_id,
    runs: job.runs,
    licensedRuns: job.licensed_runs,
    status: mapJobStatus(job.status),
    startAt: job.start_date,
    endAt: job.end_date,
    durationSeconds: job.duration,
    successfulRuns: job.successful_runs,
  }
}

export async function fetchCharacterIndustryJobs(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions,
): Promise<EsiIndustryJob[]> {
  return esiAuthGet<EsiIndustryJob[]>(
    `/characters/${characterId}/industry/jobs/`,
    accessToken,
    { cacheKey: `esi:jobs:${characterId}`, ...options },
  )
}

/** Read cached jobs from localStorage without a network call. */
export function getCachedCharacterIndustryJobs(characterId: number): EsiIndustryJob[] | null {
  const cached = getCached<EsiIndustryJob[]>(`esi:jobs:${characterId}`)
  return cached?.data ?? null
}
