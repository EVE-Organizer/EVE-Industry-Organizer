import { describe, expect, it } from 'vitest'
import {
  inventionSuccessChance,
  scaleSkillQueueTimes,
  skillPointsPerMinute,
  skillPointsToLevel,
  suggestQueueAttributeFocus,
  totalSkillPointsToLevel,
} from '@/lib/skillTraining'
import {
  queueEntryDurationSeconds,
  queueEntryRemainingSeconds,
  queueProgress,
  queueTotalRemainingSeconds,
} from '@/services/character/characterSkillQueueService'

describe('skillTraining', () => {
  it('computes SP to level for Industry rank 1', () => {
    expect(skillPointsToLevel(1, 1)).toBe(250)
    let total = 0
    for (let l = 1; l <= 5; l++) total += skillPointsToLevel(1, l)
    expect(totalSkillPointsToLevel(1, 5)).toBe(total)
  })

  it('computes SP/min from attributes', () => {
    expect(skillPointsPerMinute(27, 22)).toBe(38)
  })

  it('computes invention chance with assumed skills (enc/40 + 2×datacore/30)', () => {
    expect(inventionSuccessChance(0.34, 4)).toBeCloseTo(0.34 * (1 + 4 / 40 + 8 / 30), 5)
    expect(inventionSuccessChance(0.34, 5)).toBeCloseTo(0.34 * (1 + 5 / 40 + 10 / 30), 5)
  })
})

describe('skill queue progress', () => {
  it('returns paused queue progress as zero without dates', () => {
    expect(
      queueProgress({
        skill_id: 3380,
        finished_level: 5,
        queue_position: 0,
      }),
    ).toBe(0)
  })

  it('interpolates progress between start and finish', () => {
    const start = new Date('2026-01-01T00:00:00Z').toISOString()
    const finish = new Date('2026-01-02T00:00:00Z').toISOString()
    const mid = Date.parse('2026-01-01T12:00:00Z')
    expect(
      queueProgress(
        { skill_id: 3380, finished_level: 5, queue_position: 0, start_date: start, finish_date: finish },
        mid,
      ),
    ).toBeCloseTo(0.5, 2)
  })

  it('returns remaining and duration from ESI dates', () => {
    const start = new Date('2026-01-01T00:00:00Z').toISOString()
    const finish = new Date('2026-01-02T12:00:00Z').toISOString()
    const entry = {
      skill_id: 3380,
      finished_level: 5,
      queue_position: 0,
      start_date: start,
      finish_date: finish,
    }
    const now = Date.parse('2026-01-01T12:00:00Z')
    expect(queueEntryRemainingSeconds(entry, now)).toBe(24 * 3600)
    expect(queueEntryDurationSeconds(entry)).toBe(36 * 3600)
  })

  it('uses the latest finish date as total remaining', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const firstFinish = new Date('2026-01-01T12:00:00Z').toISOString()
    const lastFinish = new Date('2026-01-03T00:00:00Z').toISOString()
    expect(
      queueTotalRemainingSeconds(
        [
          { skill_id: 1, finished_level: 1, queue_position: 0, finish_date: firstFinish },
          { skill_id: 2, finished_level: 1, queue_position: 1, finish_date: lastFinish },
        ],
        now,
      ),
    ).toBe(2 * 24 * 3600)
  })
})

describe('scaleSkillQueueTimes', () => {
  it('shortens remaining time when the primary attribute increases', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const start = new Date('2026-01-01T00:00:00Z').toISOString()
    const finish = new Date('2026-01-02T00:00:00Z').toISOString()
    const oldAttrs = {
      intelligence: 20,
      memory: 20,
      perception: 20,
      willpower: 20,
      charisma: 20,
    }
    const newAttrs = { ...oldAttrs, intelligence: 30 }
    const scaled = scaleSkillQueueTimes(
      [{ skill_id: 1, queue_position: 0, start_date: start, finish_date: finish }],
      () => ({ primaryAttribute: 'intelligence', secondaryAttribute: 'memory' }),
      oldAttrs,
      newAttrs,
      now,
    )
    expect(scaled.totalSeconds).toBe(18 * 3600)
  })

  it('suggests the primary attribute that shortens the queue most', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const start = new Date('2026-01-01T00:00:00Z').toISOString()
    const finish = new Date('2026-01-02T00:00:00Z').toISOString()
    const attrs = {
      intelligence: 20,
      memory: 20,
      perception: 20,
      willpower: 20,
      charisma: 20,
    }
    const focus = suggestQueueAttributeFocus(
      [{ skill_id: 1, queue_position: 0, start_date: start, finish_date: finish }],
      () => ({ primaryAttribute: 'intelligence', secondaryAttribute: 'memory' }),
      attrs,
      attrs,
      {
        intelligence: 1,
        memory: 1,
        perception: 1,
        willpower: 1,
        charisma: 1,
      },
      now,
    )
    expect(focus[0]?.attr).toBe('intelligence')
    expect(focus[1]?.attr).toBe('memory')
    expect(focus).toHaveLength(2)
    expect(focus[0]?.savedSeconds).toBeGreaterThan(focus[1]?.savedSeconds ?? 0)
  })
})
