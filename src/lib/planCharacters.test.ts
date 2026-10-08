import { describe, expect, it } from 'vitest'
import {
  buildOwnerByProduct,
  buildSchedulerCharacters,
  characterDurationFactor,
  displayOwnerForProduct,
  resolvePlanCharacters,
  settingsWithOwnerTimeSkills,
  settingsWithPlanSellerFees,
  sumPlanCrewSlots,
} from '@/lib/planCharacters'
import { mockNode } from '@/pages/Plan/planTestUtils'
import { schedulePlanJobs } from '@/pages/Plan/planScheduler'
import { DEFAULT_SETTINGS } from '@/types'

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

describe('characterDurationFactor', () => {
  it('is 1 for the base skills and faster for higher Industry', () => {
    const base = DEFAULT_SETTINGS.skills
    expect(characterDurationFactor(base, base, {})).toBe(1)
    const better = { ...base, industry: 5, advancedIndustry: 5 }
    expect(
      characterDurationFactor(better, { ...base, industry: 0, advancedIndustry: 0 }, {}),
    ).toBeLessThan(1)
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

describe('displayOwnerForProduct', () => {
  it('shows inherited owner on an unpinned child', () => {
    const owners = buildOwnerByProduct(
      [
        { productTypeId: 1, parentProductTypeIds: [3] },
        { productTypeId: 3, parentProductTypeIds: [] },
      ],
      [{ productTypeId: 3, characterKey: 'sso:1' }],
      {},
      ['sso:1'],
    )
    expect(displayOwnerForProduct(1, false, undefined, undefined, owners)).toEqual({
      characterKey: 'sso:1',
      inherited: true,
    })
  })

  it('keeps a pinned child when the root owner changes', () => {
    const owners = buildOwnerByProduct(
      [
        { productTypeId: 1, parentProductTypeIds: [3] },
        { productTypeId: 3, parentProductTypeIds: [] },
      ],
      [{ productTypeId: 3, characterKey: 'sso:1' }],
      { 1: { characterKey: 'sso:2' } },
      ['sso:1', 'sso:2'],
    )
    expect(displayOwnerForProduct(1, false, undefined, { characterKey: 'sso:2' }, owners)).toEqual({
      characterKey: 'sso:2',
      inherited: false,
    })
  })
})

describe('sumPlanCrewSlots', () => {
  it('adds manufacturing, reaction, and research slots across the crew', () => {
    const totals = sumPlanCrewSlots([
      {
        key: 'sso:1',
        name: 'One',
        skills: DEFAULT_SETTINGS.skills,
        slots: { manufacturing: 2, reactions: 1, research: 3 },
        isSso: true,
        skillsAssumed: false,
      },
      {
        key: 'sso:2',
        name: 'Two',
        skills: DEFAULT_SETTINGS.skills,
        slots: { manufacturing: 5, reactions: 2, research: 1 },
        isSso: true,
        skillsAssumed: false,
      },
    ])
    expect(totals).toEqual({ manufacturing: 7, reactions: 3, research: 4 })
  })
})

describe('settingsWithOwnerTimeSkills', () => {
  it('overlays industry and reaction skills without changing trading skills', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      skills: { ...DEFAULT_SETTINGS.skills, industry: 0, reactions: 0, accounting: 4 },
    }
    const merged = settingsWithOwnerTimeSkills(settings, 'sso:9', {
      sso: [
        {
          characterId: 9,
          characterName: 'Builder',
          skills: { ...DEFAULT_SETTINGS.skills, industry: 5, reactions: 3, science: 4 },
        },
      ],
      manual: [],
    })
    expect(merged.skills.industry).toBe(5)
    expect(merged.skills.reactions).toBe(3)
    expect(merged.skills.science).toBe(4)
    expect(merged.skills.accounting).toBe(4)
  })
})

describe('settingsWithPlanSellerFees', () => {
  it('overlays Accounting and Broker Relations without changing Industry', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      skills: { ...DEFAULT_SETTINGS.skills, industry: 3, accounting: 0, brokerRelations: 0 },
    }
    const merged = settingsWithPlanSellerFees(
      settings,
      'sso:9',
      [
        {
          characterId: 9,
          characterName: 'Trader',
          skills: { ...DEFAULT_SETTINGS.skills, accounting: 5, brokerRelations: 5, industry: 0 },
        },
      ],
      [],
    )
    expect(merged.skills.industry).toBe(3)
    expect(merged.skills.accounting).toBe(5)
    expect(merged.skills.brokerRelations).toBe(5)
  })

  it('returns settings unchanged when no seller is set', () => {
    const settings = { ...DEFAULT_SETTINGS }
    expect(settingsWithPlanSellerFees(settings, undefined, [], [])).toBe(settings)
  })
})

describe('buildSchedulerCharacters durationFactor', () => {
  it('is 1 when the node owner matches the character', () => {
    const [character] = buildSchedulerCharacters(
      resolvePlanCharacters({
        keys: ['sso:1'],
        sso: [
          {
            characterId: 1,
            characterName: 'One',
            skills: { ...DEFAULT_SETTINGS.skills, industry: 5 },
          },
        ],
        manual: [],
        settingsSkills: DEFAULT_SETTINGS.skills,
      }),
      DEFAULT_SETTINGS.skills,
      new Map(),
      new Map([[100, 'sso:1']]),
    )
    const node = mockNode({ productTypeId: 100, recipeKind: undefined })
    expect(character?.durationFactor(node)).toBe(1)
  })
})

describe('multi-character scheduling', () => {
  it('runs two independent roots at once when each character owns one', () => {
    const nodes = [
      mockNode({
        productTypeId: 1,
        name: 'A',
        isRoot: true,
        depth: 0,
        runs: 10,
        jobTimeSeconds: 3600,
      }),
      mockNode({
        productTypeId: 2,
        name: 'B',
        isRoot: true,
        depth: 0,
        runs: 10,
        jobTimeSeconds: 3600,
      }),
    ]
    const crew = buildSchedulerCharacters(
      resolvePlanCharacters({
        keys: ['sso:1', 'sso:2'],
        sso: [
          { characterId: 1, characterName: 'One' },
          { characterId: 2, characterName: 'Two' },
        ],
        manual: [],
        settingsSkills: {
          ...DEFAULT_SETTINGS.skills,
          massProduction: 0,
          advancedMassProduction: 0,
        },
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
