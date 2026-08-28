import { describe, expect, it } from 'vitest'
import {
  fitSkillStatusLabel,
  isFitSkillGap,
  resolveFitSkillStatus,
} from '@/pages/FitSkills/fitSkillStatus'
import type { EsiSkillQueueEntry } from '@/services/character/characterSkillQueueService'

const SKILL = 3380

describe('fitSkillStatus', () => {
  it('marks ok when trained meets requirement', () => {
    expect(resolveFitSkillStatus(SKILL, 5, 5, []).status).toBe('ok')
  })

  it('marks training when active queue entry will reach requirement', () => {
    const queue: EsiSkillQueueEntry[] = [
      {
        skill_id: SKILL,
        finished_level: 5,
        queue_position: 0,
        start_date: '2026-01-01T00:00:00Z',
        finish_date: '2026-01-02T00:00:00Z',
      },
    ]
    expect(resolveFitSkillStatus(SKILL, 5, 3, queue)).toEqual({
      status: 'training',
      queuedTo: 5,
    })
  })

  it('marks queued when skill is queued but not training now', () => {
    const queue: EsiSkillQueueEntry[] = [
      {
        skill_id: 999,
        finished_level: 2,
        queue_position: 0,
        start_date: '2026-01-01T00:00:00Z',
        finish_date: '2026-01-02T00:00:00Z',
      },
      { skill_id: SKILL, finished_level: 5, queue_position: 1 },
    ]
    expect(resolveFitSkillStatus(SKILL, 5, 3, queue)).toEqual({
      status: 'queued',
      queuedTo: 5,
    })
  })

  it('marks missing when not trained and not queued', () => {
    expect(resolveFitSkillStatus(SKILL, 5, 2, []).status).toBe('missing')
  })

  it('still counts partial queue as a gap when target is below need', () => {
    const queue: EsiSkillQueueEntry[] = [{ skill_id: SKILL, finished_level: 3, queue_position: 0 }]
    expect(resolveFitSkillStatus(SKILL, 5, 2, queue).status).toBe('queued')
    expect(isFitSkillGap(SKILL, 5, 2, queue)).toBe(true)
  })

  it('does not count gap when queue will finish at required level', () => {
    const queue: EsiSkillQueueEntry[] = [{ skill_id: SKILL, finished_level: 5, queue_position: 1 }]
    expect(isFitSkillGap(SKILL, 5, 3, queue)).toBe(false)
  })

  it('labels statuses for display', () => {
    expect(fitSkillStatusLabel('training')).toBe('Training')
    expect(fitSkillStatusLabel('queued')).toBe('Queued')
  })
})
