import { esiAuthGet } from '@/services/character/esiAuthFetch'
import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'

export interface EsiSkillQueueEntry {
  skill_id: number
  finished_level: number
  queue_position: number
  level_start_sp?: number
  level_end_sp?: number
  training_start_sp?: number
  start_date?: string
  finish_date?: string
}

export async function fetchCharacterSkillQueue(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions<EsiSkillQueueEntry[]>,
): Promise<EsiSkillQueueEntry[]> {
  return esiAuthGet<EsiSkillQueueEntry[]>(
    `/characters/${characterId}/skillqueue/`,
    accessToken,
    { cacheKey: `esi:skillqueue:${characterId}`, ...options },
  )
}

export function isActiveQueueEntry(entry: EsiSkillQueueEntry): boolean {
  return Boolean(entry.start_date && entry.finish_date)
}

export function queueProgress(entry: EsiSkillQueueEntry, nowMs = Date.now()): number {
  if (!entry.start_date || !entry.finish_date) return 0
  const start = Date.parse(entry.start_date)
  const finish = Date.parse(entry.finish_date)
  if (Number.isNaN(start) || Number.isNaN(finish) || finish <= start) return 0
  return Math.min(1, Math.max(0, (nowMs - start) / (finish - start)))
}

/** Seconds until this queue entry finishes, or null if the queue is paused. */
export function queueEntryRemainingSeconds(
  entry: EsiSkillQueueEntry,
  nowMs = Date.now(),
): number | null {
  if (!entry.finish_date) return null
  const finish = Date.parse(entry.finish_date)
  if (Number.isNaN(finish)) return null
  return Math.max(0, Math.round((finish - nowMs) / 1000))
}

/** Seconds this queue entry itself takes (start to finish). */
export function queueEntryDurationSeconds(entry: EsiSkillQueueEntry): number | null {
  if (!entry.start_date || !entry.finish_date) return null
  const start = Date.parse(entry.start_date)
  const finish = Date.parse(entry.finish_date)
  if (Number.isNaN(start) || Number.isNaN(finish) || finish <= start) return null
  return Math.round((finish - start) / 1000)
}

/** Remaining seconds until the last queued skill finishes. */
export function queueTotalRemainingSeconds(
  entries: readonly EsiSkillQueueEntry[],
  nowMs = Date.now(),
): number | null {
  let latest: number | null = null
  for (const entry of entries) {
    const remaining = queueEntryRemainingSeconds(entry, nowMs)
    if (remaining == null) continue
    latest = latest == null ? remaining : Math.max(latest, remaining)
  }
  return latest
}
