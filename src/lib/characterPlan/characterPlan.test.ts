import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { analyzeFit } from '@/lib/fitting/analyzeFit'
import { buildFittingIndex } from '@/lib/fitting/fitSkills'
import {
  BADGER_HS_EFT,
  BUSTARD_HS_EFT,
  HULK_HS_EFT,
  HULK_MLU2_EFT,
  PORPOISE_BURST_EFT,
  PORPOISE_BURST2_EFT,
  PORPOISE_CORE_EFT,
  RETRIEVER_HS_EFT,
} from '@/lib/characterPlan/fits'
import { applyQueueToTrained, buildQueue } from '@/lib/characterPlan/buildPlan'
import { CHARACTER_PATHS } from '@/lib/characterPlan/paths'
import { formatDuration, spBetween, spPerHour } from '@/lib/characterPlan/sp'
import type { FittingData } from '@/lib/fitting/types'
import type { SkillInfo } from '@/types'

function loadSkills(): SkillInfo[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/data/skills.json'), 'utf8')) as SkillInfo[]
}

function loadIndex() {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/fitting.json'), 'utf8'),
  ) as FittingData
  return buildFittingIndex(raw)
}

const RATE = {
  implant: 0,
  remap: { primary: 'perception' as const, secondary: 'willpower' as const },
}

describe('sp', () => {
  it('uses the rank-1 level table', () => {
    expect(spBetween(1, 0, 5)).toBe(250 + 1415 + 8000 + 45255 + 256000)
    expect(spBetween(4, 4, 5)).toBe(1_024_000)
  })

  it('is 2250 SP/h at 27/21', () => {
    expect(spPerHour('perception', 'willpower', RATE)).toBe(2250)
  })

  it('formats durations', () => {
    expect(formatDuration(26)).toBe('1d 2h')
  })
})

describe('buildQueue', () => {
  it('expands Industry V before Mass Production', () => {
    const skills = loadSkills()
    const queue = buildQueue([{ skillId: 3387, level: 1 }], skills, {
      implant: 0,
      remap: { primary: 'intelligence', secondary: 'memory' },
    })
    const names = queue.rows.map((row) => `${row.name} ${row.toLevel}`)
    expect(names.some((n) => n.startsWith('Industry'))).toBe(true)
    expect(names.at(-1)).toBe('Mass Production 1')
  })

  it('carries trained levels into the next step', () => {
    const skills = loadSkills()
    const first = buildQueue([{ skillId: 3380, level: 3 }], skills, {
      implant: 0,
      remap: { primary: 'intelligence', secondary: 'memory' },
    })
    const trained = applyQueueToTrained(new Map(), first)
    const second = buildQueue([{ skillId: 3380, level: 5 }], skills, {
      implant: 0,
      remap: { primary: 'intelligence', secondary: 'memory' },
    }, trained)
    expect(second.rows.every((row) => row.fromLevel >= 3)).toBe(true)
  })
})

describe('character paths', () => {
  it('keeps each month under 40 days at remap-only', () => {
    const skills = loadSkills()
    for (const path of CHARACTER_PATHS) {
      let trained = new Map<number, number>()
      for (const step of path.steps) {
        const queue = buildQueue(step.targets, skills, { implant: 0, remap: step.remap }, trained)
        trained = applyQueueToTrained(trained, queue)
        expect(queue.totalHours, `${path.id} ${step.id}`).toBeLessThan(40 * 24)
      }
    }
  })

  it('does not train Tycoon or remote-trade skills on the seller', () => {
    const seller = CHARACTER_PATHS.find((p) => p.id === 'seller')
    const ids = new Set(seller?.steps.flatMap((s) => s.targets.map((t) => t.skillId)))
    expect(ids.has(18580)).toBe(false)
    expect(ids.has(16594)).toBe(false)
    expect(ids.has(16595)).toBe(false)
    expect(ids.has(3447)).toBe(false)
  })
})

describe('plan fits', () => {
  const cases = [
    ['Badger', BADGER_HS_EFT],
    ['Bustard', BUSTARD_HS_EFT],
    ['Retriever', RETRIEVER_HS_EFT],
    ['Hulk', HULK_HS_EFT],
    ['Hulk MLU II', HULK_MLU2_EFT],
    ['Porpoise burst', PORPOISE_BURST_EFT],
    ['Porpoise burst II', PORPOISE_BURST2_EFT],
    ['Porpoise core', PORPOISE_CORE_EFT],
  ] as const

  it.each(cases)('%s parses and fits at skills V', (_label, eft) => {
    const analysis = analyzeFit(eft, loadIndex(), loadSkills())
    expect(analysis.unknown).toEqual([])
    expect(analysis.possible).toBe(true)
  })
})
