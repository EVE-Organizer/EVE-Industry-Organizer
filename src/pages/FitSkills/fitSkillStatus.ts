import type { EsiSkillQueueEntry } from '@/services/character/characterSkillQueueService'
import {
  activeTrainingSkillId,
  queuedTargetLevelBySkill,
} from '@/services/character/characterSkillQueueService'

export type FitSkillStatus = 'ok' | 'training' | 'queued' | 'missing'

export function resolveFitSkillStatus(
  skillId: number,
  required: number,
  trained: number,
  queue: readonly EsiSkillQueueEntry[],
): { status: FitSkillStatus; queuedTo?: number } {
  if (trained >= required) return { status: 'ok' }

  const queuedTo = queuedTargetLevelBySkill(queue).get(skillId)
  if (queuedTo == null) return { status: 'missing' }

  const isActive = activeTrainingSkillId(queue) === skillId
  if (queuedTo >= required) {
    return { status: isActive ? 'training' : 'queued', queuedTo }
  }
  return { status: isActive ? 'training' : 'queued', queuedTo }
}

/** True when trained level is short and the queue will not cover the requirement. */
export function isFitSkillGap(
  skillId: number,
  required: number,
  trained: number,
  queue: readonly EsiSkillQueueEntry[],
): boolean {
  if (trained >= required) return false
  const queuedTo = queuedTargetLevelBySkill(queue).get(skillId)
  return queuedTo == null || queuedTo < required
}

export function fitSkillStatusLabel(status: FitSkillStatus): string {
  switch (status) {
    case 'ok':
      return 'Ok'
    case 'training':
      return 'Training'
    case 'queued':
      return 'Queued'
    case 'missing':
      return 'Missing'
  }
}

export function fitSkillStatusClass(status: FitSkillStatus): string {
  switch (status) {
    case 'ok':
      return 'text-success'
    case 'training':
      return 'text-warning'
    case 'queued':
      return 'text-info'
    case 'missing':
      return 'text-error'
  }
}
