import type { EveAttributeId, SkillAttributePair } from '@/types'

/** SP required to train from level (L-1) to level L. */
export function skillPointsToLevel(rank: number, level: number): number {
  if (level <= 0) return 0
  return Math.ceil(250 * rank * 2 ** (2.5 * (level - 1)))
}

/** Total SP from untrained to level L. */
export function totalSkillPointsToLevel(rank: number, level: number): number {
  let total = 0
  for (let l = 1; l <= level; l++) {
    total += skillPointsToLevel(rank, l)
  }
  return total
}

/** SP per minute from effective primary and secondary attributes. */
export function skillPointsPerMinute(
  primary: number,
  secondary: number,
): number {
  return primary + secondary / 2
}

export function spPerMinuteForSkill(
  attrs: Record<EveAttributeId, number>,
  skill: SkillAttributePair,
): number {
  return skillPointsPerMinute(attrs[skill.primaryAttribute], attrs[skill.secondaryAttribute])
}

/** Remaining seconds to finish training given SP left and current SP/min. */
export function trainingSecondsRemaining(spRemaining: number, spPerMin: number): number | null {
  if (spRemaining <= 0) return 0
  if (spPerMin <= 0) return null
  return Math.ceil((spRemaining / spPerMin) * 60)
}

/** Scale ESI finish time when SP/min changes mid-training. */
export function scaledQueueFinishMs(
  finishDate: string,
  startDate: string,
  oldSpPerMin: number,
  newSpPerMin: number,
  nowMs = Date.now(),
): number | null {
  if (newSpPerMin <= 0 || oldSpPerMin <= 0) return null
  const finishMs = Date.parse(finishDate)
  const startMs = Date.parse(startDate)
  if (Number.isNaN(finishMs) || Number.isNaN(startMs)) return null

  const remainingMs = Math.max(0, finishMs - nowMs)
  if (remainingMs === 0) return finishMs

  const totalMs = Math.max(1, finishMs - startMs)
  const progress = 1 - remainingMs / totalMs
  const totalSp = (totalMs / 60_000) * oldSpPerMin
  const spRemaining = totalSp * (1 - progress)
  const newRemainingSec = trainingSecondsRemaining(spRemaining, newSpPerMin)
  if (newRemainingSec == null) return null
  return nowMs + newRemainingSec * 1000
}

export function formatTrainingDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds <= 0) return 'Done'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `~${days}d ${hours}h`
  if (hours > 0) return `~${hours}h ${mins}m`
  return `~${mins}m`
}

interface QueueTimeInput {
  skill_id: number
  queue_position: number
  start_date?: string
  finish_date?: string
}

export interface ScaledQueueTimes {
  remainingByPosition: Map<number, number | null>
  totalSeconds: number | null
}

function isInProgress(entry: QueueTimeInput, nowMs: number): boolean {
  if (!entry.start_date || !entry.finish_date) return false
  const start = Date.parse(entry.start_date)
  const finish = Date.parse(entry.finish_date)
  if (Number.isNaN(start) || Number.isNaN(finish)) return false
  return start <= nowMs && nowMs < finish
}

function entryDurationSeconds(entry: QueueTimeInput): number | null {
  if (!entry.start_date || !entry.finish_date) return null
  const start = Date.parse(entry.start_date)
  const finish = Date.parse(entry.finish_date)
  if (Number.isNaN(start) || Number.isNaN(finish) || finish <= start) return null
  return Math.round((finish - start) / 1000)
}

/** Scale each queued skill by the SP/min change from a remap or implant tweak. */
export function scaleSkillQueueTimes(
  entries: readonly QueueTimeInput[],
  resolveAttrs: (skillId: number) => SkillAttributePair | null,
  oldAttrs: Record<EveAttributeId, number>,
  newAttrs: Record<EveAttributeId, number>,
  nowMs = Date.now(),
): ScaledQueueTimes {
  const remainingByPosition = new Map<number, number | null>()
  let cumulative = 0
  let any = false

  const sorted = [...entries].sort((a, b) => a.queue_position - b.queue_position)
  for (const entry of sorted) {
    const pair = resolveAttrs(entry.skill_id)
    const oldSpm = pair ? spPerMinuteForSkill(oldAttrs, pair) : 0
    const newSpm = pair ? spPerMinuteForSkill(newAttrs, pair) : 0
    const ratio = oldSpm > 0 && newSpm > 0 ? oldSpm / newSpm : 1

    let thisSeconds: number | null
    if (isInProgress(entry, nowMs)) {
      const remainingMs = Math.max(0, Date.parse(entry.finish_date!) - nowMs)
      thisSeconds = Math.round((remainingMs / 1000) * ratio)
    } else {
      const duration = entryDurationSeconds(entry)
      thisSeconds = duration == null ? null : Math.round(duration * ratio)
    }

    if (thisSeconds != null) {
      cumulative += thisSeconds
      any = true
      remainingByPosition.set(entry.queue_position, cumulative)
    } else {
      remainingByPosition.set(entry.queue_position, any ? cumulative : null)
    }
  }

  return { remainingByPosition, totalSeconds: any ? cumulative : null }
}

const FOCUS_ATTRIBUTES: EveAttributeId[] = [
  'intelligence',
  'memory',
  'perception',
  'willpower',
  'charisma',
]

export interface QueueAttributeFocus {
  attr: EveAttributeId
  points: number
  savedSeconds: number
}

/** Ranked attributes to raise for this queue (up to 3), with seconds saved vs current preview. */
export function suggestQueueAttributeFocus(
  entries: readonly QueueTimeInput[],
  resolveAttrs: (skillId: number) => SkillAttributePair | null,
  seedAttrs: Record<EveAttributeId, number>,
  currentAttrs: Record<EveAttributeId, number>,
  pointsByAttr: Record<EveAttributeId, number>,
  nowMs = Date.now(),
  limit = 3,
): QueueAttributeFocus[] {
  const baseline = scaleSkillQueueTimes(entries, resolveAttrs, seedAttrs, currentAttrs, nowMs)
  if (baseline.totalSeconds == null || baseline.totalSeconds <= 0) return []

  const ranked: QueueAttributeFocus[] = []
  for (const attr of FOCUS_ATTRIBUTES) {
    const points = pointsByAttr[attr] ?? 0
    if (points <= 0) continue
    const bumped = { ...currentAttrs, [attr]: currentAttrs[attr] + points }
    const scaled = scaleSkillQueueTimes(entries, resolveAttrs, seedAttrs, bumped, nowMs)
    if (scaled.totalSeconds == null) continue
    const savedSeconds = baseline.totalSeconds - scaled.totalSeconds
    if (savedSeconds <= 0) continue
    ranked.push({ attr, points, savedSeconds })
  }

  ranked.sort((a, b) => b.savedSeconds - a.savedSeconds)
  return ranked.slice(0, Math.max(1, Math.min(3, limit)))
}

/** T2 invention success chance with assumed encryption + 2 datacore skills. */
export function inventionSuccessChance(
  baseChance: number,
  inventionSkillLevel: number,
): number {
  const skillFactor = 1 + inventionSkillLevel * 0.01
  return Math.min(1, baseChance * skillFactor ** 3)
}

/** Default base chance used when blueprint-specific chance is unknown (display only). */
export const DEFAULT_INVENTION_BASE_CHANCE = 0.34
