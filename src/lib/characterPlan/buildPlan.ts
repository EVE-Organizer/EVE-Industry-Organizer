import type { SkillInfo } from '@/types'
import { skillAttrs } from '@/lib/characterPlan/attributes'
import {
  formatDuration,
  hoursForSp,
  spBetween,
  spPerHour,
  type Remap,
  type TrainRate,
} from '@/lib/characterPlan/sp'

export interface SkillTarget {
  skillId: number
  level: number
}

export interface QueueRow {
  skillId: number
  name: string
  fromLevel: number
  toLevel: number
  rank: number
  sp: number
  hours: number
  duration: string
}

export interface BuiltQueue {
  rows: QueueRow[]
  totalSp: number
  totalHours: number
  duration: string
}

export function expandPrereqTargets(
  target: SkillTarget,
  skills: SkillInfo[],
  trained: Map<number, number>,
): SkillTarget[] {
  const byId = new Map(skills.map((s) => [s.skillId, s]))
  const out: SkillTarget[] = []
  const seen = new Set<string>()

  function walk(skillId: number, level: number) {
    const key = `${skillId}:${level}`
    if (seen.has(key)) return
    seen.add(key)
    const info = byId.get(skillId)
    if (!info) return
    for (const pre of info.prerequisites) {
      walk(pre.skillId, pre.level)
    }
    if ((trained.get(skillId) ?? 0) < level) {
      out.push({ skillId, level })
    }
  }

  walk(target.skillId, target.level)
  return out
}

/** Merge overlapping targets so each skill appears once at its max requested level. */
export function mergeTargets(targets: SkillTarget[]): SkillTarget[] {
  const max = new Map<number, number>()
  const order: number[] = []
  for (const t of targets) {
    if (!max.has(t.skillId)) order.push(t.skillId)
    max.set(t.skillId, Math.max(max.get(t.skillId) ?? 0, t.level))
  }
  return order.map((skillId) => ({ skillId, level: max.get(skillId) ?? 0 }))
}

export function buildQueue(
  targets: SkillTarget[],
  skills: SkillInfo[],
  rate: TrainRate,
  trainedStart: Map<number, number> = new Map(),
): BuiltQueue {
  const byId = new Map(skills.map((s) => [s.skillId, s]))
  const trained = new Map(trainedStart)
  const rows: QueueRow[] = []

  for (const goal of mergeTargets(targets)) {
    for (const step of expandPrereqTargets(goal, skills, trained)) {
      const info = byId.get(step.skillId)
      if (!info) continue
      const from = trained.get(step.skillId) ?? 0
      if (from >= step.level) continue
      const attrs = skillAttrs(step.skillId)
      const sph = spPerHour(attrs.primary, attrs.secondary, rate)
      for (let to = from + 1; to <= step.level; to += 1) {
        const sp = spBetween(info.rank, to - 1, to)
        const hours = hoursForSp(sp, sph)
        rows.push({
          skillId: step.skillId,
          name: info.name,
          fromLevel: to - 1,
          toLevel: to,
          rank: info.rank,
          sp,
          hours,
          duration: formatDuration(hours),
        })
        trained.set(step.skillId, to)
      }
    }
  }

  const totalSp = rows.reduce((sum, row) => sum + row.sp, 0)
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0)
  return {
    rows,
    totalSp,
    totalHours,
    duration: formatDuration(totalHours),
  }
}

export function applyQueueToTrained(trained: Map<number, number>, queue: BuiltQueue): Map<number, number> {
  const next = new Map(trained)
  for (const row of queue.rows) {
    next.set(row.skillId, Math.max(next.get(row.skillId) ?? 0, row.toLevel))
  }
  return next
}

export function remapLabel(remap: Remap): string {
  const short: Record<string, string> = {
    intelligence: 'Int',
    memory: 'Mem',
    perception: 'Per',
    willpower: 'Wil',
    charisma: 'Cha',
  }
  return `${short[remap.primary]}/${short[remap.secondary]} 27/21`
}
