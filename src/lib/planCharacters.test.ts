import { describe, expect, it } from 'vitest'
import {
  buildOwnerByProduct,
  buildSchedulerCharacters,
  canRunJob,
  characterDurationFactor,
  nodeOwner,
  resolvePlanCharacters,
} from '@/lib/planCharacters'
import { schedulePlanJobs } from '@/pages/Plan/planScheduler'
import { mockNode } from '@/pages/Plan/planTestUtils'
import { DEFAULT_SETTINGS } from '@/types'

describe('nodeOwner', () => {
  it('uses a pin over the root owner, and auto when roots disagree', () => {
    expect(nodeOwner(2, { 2: { characterKey: 'manual:a' } }, [{ productTypeId: 1, characterKey: 'sso:1', childIds: [2] }])).toBe(
      'manual:a',
    )
    expect(
      nodeOwner(2, {}, [
        { productTypeId: 1, characterKey: 'sso:1', childIds: [2] },
        { productTypeId: 3, characterKey: 'sso:2', childIds: [2] },
      ]),
    ).toBe('auto')
  })
})

describe('resolvePlanCharacters', () => {
  it('falls back to settings skills when an SSO character has no snapshot', () => {
    const [character] = resolvePlanCharacters({
      keys: ['sso:9'],
      sso: [{ characterId: 9, characterName: 'Alt' }],
      manual: [],
      settingsSkills: DEFAULT_SETTINGS.skills,
    })
    expect(character?.skillsAssumed).toBe(true)
    expect(character?.skills).toBe(DEFAULT_SETTINGS.skills)
  })
})

describe('canRunJob', () => {
  it('requires encryption for invention', () => {
    expect(canRunJob({ encryption: 0 }, undefined, 'invention')).toBe(false)
    expect(canRunJob({ encryption: 1 }, undefined, 'invention')).toBe(true)
    expect(canRunJob({ industry: 1 }, { industry: 4 }, 'manufacture')).toBe(false)
  })
})

describe('characterDurationFactor', () => {
  it('is 1 for the base skills and faster for higher Industry', () => {
    const base = DEFAULT_SETTINGS.skills
    expect(characterDurationFactor(base, base, {})).toBe(1)
    const better = { ...base, industry: 5, advancedIndustry: 5 }
    expect(characterDurationFactor(better, { ...base, industry: 0, advancedIndustry: 0 }, {})).toBeLessThan(1)
  })
})

describe('buildOwnerByProduct', () => {
  const nodes = [
    { productTypeId: 1, parentProductTypeIds: [3] },
    { productTypeId: 2, parentProductTypeIds: [3, 4] },
    { productTypeId: 3, parentProductTypeIds: [] },
    { productTypeId: 4, parentProductTypeIds: [] },
  ]
  const keys = ['sso:1', 'sso:2'] as const

  it('follows the single root owner and falls back to auto when roots disagree', () => {
    const owners = buildOwnerByProduct(
      nodes,
      [
        { productTypeId: 3, characterKey: 'sso:1' },
        { productTypeId: 4, characterKey: 'sso:2' },
      ],
      {},
      [...keys],
    )
    expect(owners.get(1)).toBe('sso:1')
    expect(owners.get(2)).toBe('auto')
  })

  it('lets a node pin beat the root owner', () => {
    const owners = buildOwnerByProduct(
      nodes,
      [{ productTypeId: 3, characterKey: 'sso:1' }],
      { 1: { characterKey: 'sso:2' } },
      [...keys],
    )
    expect(owners.get(1)).toBe('sso:2')
  })
})

describe('multi-character scheduling', () => {
  it('runs two independent roots at once when each character owns one', () => {
    const nodes = [
      mockNode({ productTypeId: 1, name: 'A', isRoot: true, depth: 0, runs: 10, jobTimeSeconds: 3600 }),
      mockNode({ productTypeId: 2, name: 'B', isRoot: true, depth: 0, runs: 10, jobTimeSeconds: 3600 }),
    ]
    const crew = buildSchedulerCharacters(
      resolvePlanCharacters({
        keys: ['sso:1', 'sso:2'],
        sso: [
          { characterId: 1, characterName: 'One' },
          { characterId: 2, characterName: 'Two' },
        ],
        manual: [],
        settingsSkills: { ...DEFAULT_SETTINGS.skills, massProduction: 0, advancedMassProduction: 0 },
      }),
      DEFAULT_SETTINGS.skills,
      new Map(),
    )
    const jobs = schedulePlanJobs({
      nodes,
      slots: 1,
      windowHours: 100,
      characters: crew,
      ownerByProduct: new Map([
        [1, 'sso:1'],
        [2, 'sso:2'],
      ]),
    })
    expect(jobs.every((job) => job.startHour === 0)).toBe(true)
    expect(new Set(jobs.map((job) => job.characterKey))).toEqual(new Set(['sso:1', 'sso:2']))
  })
})