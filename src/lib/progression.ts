import type { CharacterAccount, SkillPath, SkillPathStage } from '@/types'

export const SKILL_PATHS: SkillPath[] = [
  {
    id: 't1-ammo',
    name: 'T1 Ammo Starter',
    description: 'Core industry skills for T1 ammo manufacturing in hub systems.',
    stages: [
      {
        id: 't1-w1',
        name: 'Week 1: Setup',
        rationale: 'Unlock basic manufacturing and trading.',
        unlocks: 'First manufacturing jobs, reduced tax',
        skills: [
          { skillKey: 'industry', targetLevel: 5 },
          { skillKey: 'massProduction', targetLevel: 3 },
          { skillKey: 'accounting', targetLevel: 2 },
          { skillKey: 'brokerRelations', targetLevel: 1 },
        ],
      },
      {
        id: 't1-w2',
        name: 'Week 2: Faster jobs',
        rationale: 'More job slots and lower tax.',
        unlocks: '4-5 parallel jobs, 3.6% sales tax',
        skills: [
          { skillKey: 'advancedIndustry', targetLevel: 3 },
          { skillKey: 'massProduction', targetLevel: 4 },
          { skillKey: 'accounting', targetLevel: 4 },
          { skillKey: 'metallurgy', targetLevel: 1 },
        ],
      },
      {
        id: 't1-w3',
        name: 'Week 3: Research',
        rationale: 'Start ME research on BPOs.',
        unlocks: 'ME research, faster research speed',
        skills: [
          { skillKey: 'metallurgy', targetLevel: 4 },
          { skillKey: 'science', targetLevel: 4 },
          { skillKey: 'research', targetLevel: 2 },
        ],
      },
      {
        id: 't1-w4',
        name: 'Week 4: Max slots',
        rationale: 'Maximum manufacturing throughput on Omega.',
        unlocks: '6 job slots, Advanced Industry V',
        skills: [
          { skillKey: 'massProduction', targetLevel: 5 },
          { skillKey: 'advancedIndustry', targetLevel: 5 },
          { skillKey: 'research', targetLevel: 4 },
        ],
      },
    ],
  },
  {
    id: 't2-invention',
    name: 'T2 Invention',
    description: 'Skills toward T2 blueprint copying and invention.',
    stages: [
      {
        id: 't2-w1',
        name: 'Science foundation',
        rationale: 'Required for invention datacores.',
        unlocks: 'Invention tab access',
        skills: [
          { skillKey: 'science', targetLevel: 5 },
          { skillKey: 'research', targetLevel: 4 },
        ],
      },
    ],
  },
  {
    id: 'trade-tax',
    name: 'Trade & Tax',
    description: 'Optimize market fees for selling manufactured goods.',
    stages: [
      {
        id: 'trade-1',
        name: 'Market efficiency',
        rationale: 'Lower broker and sales tax.',
        unlocks: 'Better sell margins in Jita',
        skills: [
          { skillKey: 'accounting', targetLevel: 5 },
          { skillKey: 'brokerRelations', targetLevel: 5 },
        ],
      },
    ],
  },
  {
    id: 'mining-reprocess',
    name: 'Mining & Reprocess (Optional)',
    description: 'Only if you mine your own ore. Not recommended for new manufacturers.',
    stages: [
      {
        id: 'mine-1',
        name: 'Basic reprocessing',
        rationale: 'Recover minerals from ore you mine.',
        unlocks: 'Ore reprocessing',
        skills: [{ skillKey: 'industry', targetLevel: 3 }],
      },
    ],
  },
]

const SP_PER_LEVEL = [250, 1414, 8000, 45255, 256000]

export function skillPointsForLevel(rank: number, level: number): number {
  let total = 0
  for (let i = 0; i < level; i++) total += SP_PER_LEVEL[i]! * rank
  return total
}

export function trainingMinutesForSkill(
  rank: number,
  fromLevel: number,
  toLevel: number,
  primaryAttr: number,
  secondaryAttr: number,
  isOmega: boolean,
): number {
  const sp = skillPointsForLevel(rank, toLevel) - skillPointsForLevel(rank, fromLevel)
  const primary = Math.max(primaryAttr, 1)
  const secondary = Math.max(secondaryAttr, 1)
  const multiplier = isOmega ? 1 : 0.5
  return (sp / (primary + secondary / 2)) * multiplier
}

export function getCharacterSkillLevel(account: CharacterAccount, skillKey: string): number {
  return account.skills[skillKey] ?? account.skillProgress[skillKey] ?? 0
}

export function stageCompletion(
  account: CharacterAccount,
  stage: SkillPathStage,
): { completed: number; total: number; percent: number } {
  const total = stage.skills.length
  const completed = stage.skills.filter((s) => getCharacterSkillLevel(account, s.skillKey) >= s.targetLevel).length
  return { completed, total, percent: total ? (completed / total) * 100 : 0 }
}

export function pathCompletion(account: CharacterAccount, path: SkillPath): number {
  const all = path.stages.flatMap((s) => s.skills)
  if (!all.length) return 0
  const done = all.filter((s) => getCharacterSkillLevel(account, s.skillKey) >= s.targetLevel).length
  return (done / all.length) * 100
}

export function nextRecommendedSkill(
  account: CharacterAccount,
  path: SkillPath,
): { skillKey: string; targetLevel: number; stageName: string } | null {
  for (const stage of path.stages) {
    for (const skill of stage.skills) {
      const current = getCharacterSkillLevel(account, skill.skillKey)
      if (current < skill.targetLevel) {
        return { skillKey: skill.skillKey, targetLevel: skill.targetLevel, stageName: stage.name }
      }
    }
  }
  return null
}

export function buildSkillQueue(
  account: CharacterAccount,
  path: SkillPath,
  skillRanks: Map<string, number>,
): { skillKey: string; fromLevel: number; toLevel: number; days: number }[] {
  const queue: { skillKey: string; fromLevel: number; toLevel: number; days: number }[] = []
  for (const stage of path.stages) {
    for (const skill of stage.skills) {
      const current = getCharacterSkillLevel(account, skill.skillKey)
      if (current >= skill.targetLevel) continue
      const rank = skillRanks.get(skill.skillKey) ?? 1
      const minutes = trainingMinutesForSkill(
        rank,
        current,
        skill.targetLevel,
        account.intelligence,
        account.memory,
        account.isOmega,
      )
      queue.push({
        skillKey: skill.skillKey,
        fromLevel: current,
        toLevel: skill.targetLevel,
        days: minutes / 60 / 24,
      })
    }
  }
  return queue
}

export function totalQueueDays(queue: { days: number }[]): number {
  return queue.reduce((s, q) => s + q.days, 0)
}
