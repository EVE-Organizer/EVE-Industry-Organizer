import { describe, expect, it } from 'vitest'
import {
  applyDeadlineCopies,
  applyDeadlineRootRuns,
  clearChainComponentRunOverrides,
  dropUnpinnedPlanCharacter,
  mergePlanCharacterNames,
  pruneUnpinnedPlanCharacters,
  removePlanCharacter,
  resetPlanPatch,
  setNodeCopies,
  setAllReadyBy,
  setReadyBy,
  setRootOwner,
  syncAllPlanRunsFromStoredDuration,
  syncPlanRunsAfterOwnerChange,
  syncPlanRunsFromProductionHours,
  togglePlanBuildMode,
  setStepStatus,
  setT2Options,
  startPlanPatch,
} from '@/lib/planActions'
import { inGameRunsFromDurationHours } from '@/lib/rootRunsDuration'
import type { BlueprintInfo, PlanNode } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'
import { createDefaultPlanTemplate } from '@/services/sync/types'

function template() {
  const t = createDefaultPlanTemplate('t')
  t.roots = [
    { id: 'r1', productTypeId: 1, runs: 10, productionDurationHours: 8, characterKey: 'sso:1' },
  ]
  t.nodeOverrides = { 2: { characterKey: 'sso:1', copies: 2 } }
  t.characters = ['sso:1', 'sso:2']
  t.sellerCharacterKey = 'sso:1'
  return t
}

describe('planActions', () => {
  it('drops a previous owner from the crew once nothing is pinned to them', () => {
    const t = template()
    t.nodeOverrides = {}
    t.roots = [
      { id: 'r1', productTypeId: 1, runs: 10, productionDurationHours: 8, characterKey: 'sso:2' },
    ]
    expect(dropUnpinnedPlanCharacter(t, 'sso:1').characters).toEqual(['sso:2'])
    expect(dropUnpinnedPlanCharacter(t, 'sso:2')).toEqual({})
  })

  it('prunes crew members who are no longer owners and keeps stored names', () => {
    const t = template()
    t.characters = ['sso:1', 'sso:9']
    t.characterNames = { 'sso:9': 'Zoe Mills 2nd' }
    const patch = pruneUnpinnedPlanCharacters(t)
    expect(patch.characters).toEqual(['sso:1'])
    expect(
      mergePlanCharacterNames(t, { 'sso:2124647639': 'Zoe Mills 2nd' }).characterNames,
    ).toEqual({
      'sso:9': 'Zoe Mills 2nd',
      'sso:2124647639': 'Zoe Mills 2nd',
    })
    expect(mergePlanCharacterNames(t, { 'sso:1': 'Character 1' })).toEqual({})
  })

  it('keeps at least one BPO and merges into the existing override', () => {
    const patch = setNodeCopies(template(), 2, 0)
    expect(patch.nodeOverrides?.[2]).toMatchObject({ copies: 1, characterKey: 'sso:1' })
  })

  it('stores T2 options next to the existing override and keeps copy BPOs at 1 or more', () => {
    const patch = setT2Options(template(), 2, { haveBpcs: true, copyBpos: 0 })
    expect(patch.nodeOverrides?.[2]).toMatchObject({ haveBpcs: true, copyBpos: 1, copies: 2 })
  })

  it('marks a step by hand and hands it back when cleared', () => {
    const t = template()
    t.stepProgress = { 'manufacture:1:1': { status: 'running', source: 'esi' } }
    const marked = setStepStatus(t, 'manufacture:1:1', 'done')
    expect(marked.stepProgress?.['manufacture:1:1']).toMatchObject({
      status: 'done',
      source: 'manual',
    })
    expect(setStepStatus(t, 'manufacture:1:1', undefined).stepProgress).toEqual({})
  })

  it('toggles from the displayed mode even when a stale override disagrees', () => {
    const t = template()
    t.modeOverrides = { 2: 'build' }
    const node = {
      productTypeId: 2,
      mode: 'buy' as const,
    }
    expect(togglePlanBuildMode(t, node).modeOverrides?.[2]).toBe('build')
    expect(togglePlanBuildMode(t, { ...node, mode: 'build' }).modeOverrides?.[2]).toBe('buy')
  })

  it('stores an explicit override when switching to the cost-recommended mode', () => {
    const t = template()
    t.modeOverrides = { 2: 'buy' }
    const node = { productTypeId: 2, mode: 'buy' as const }
    expect(togglePlanBuildMode(t, node).modeOverrides?.[2]).toBe('build')
  })

  it('sets and clears ready-by on every duplicate root for that product', () => {
    const t = template()
    t.roots = [
      { id: 'r1', productTypeId: 1, runs: 10 },
      { id: 'r2', productTypeId: 1, runs: 20 },
      { id: 'r3', productTypeId: 2, runs: 4 },
    ]
    const set = setReadyBy(t, 'r1', 12).roots
    expect(set?.find((r) => r.id === 'r1')?.readyByHours).toBe(12)
    expect(set?.find((r) => r.id === 'r2')?.readyByHours).toBe(12)
    expect(set?.find((r) => r.id === 'r3')?.readyByHours).toBeUndefined()
    const withDeadline = setReadyBy(t, 'r1', 12).roots ?? t.roots
    const cleared = setReadyBy({ ...t, roots: withDeadline }, 'r2', undefined).roots
    expect(cleared?.find((r) => r.id === 'r1')?.readyByHours).toBeUndefined()
    expect(cleared?.find((r) => r.id === 'r2')?.readyByHours).toBeUndefined()
  })

  it('writes the same deadline onto every root', () => {
    const t = template()
    t.roots = [
      { id: 'r1', productTypeId: 1, runs: 10 },
      { id: 'r2', productTypeId: 2, runs: 4, readyByHours: 3 },
    ]
    expect(setAllReadyBy(t, 8).roots?.every((r) => r.readyByHours === 8)).toBe(true)
  })

  it('syncs runs from a shared duration without touching ready-by', () => {
    const bp: BlueprintInfo = {
      blueprintTypeId: 10001,
      productTypeId: 100,
      productQuantity: 1,
      manufacturingTime: 3600,
      materials: [],
      requiredSkills: {},
      tier: 't1',
      productGroup: 'Module',
      bpIconUrl: '',
      productIconUrl: '',
      productRenderUrl: '',
    }
    const partBp: BlueprintInfo = { ...bp, blueprintTypeId: 10002, productTypeId: 2 }
    const t = template()
    t.roots = [
      { id: 'r1', productTypeId: 100, runs: 100, productionDurationHours: 24, readyByHours: 6 },
    ]
    t.nodeOverrides = { 2: { runs: 50, runsFromReadyBy: true, copies: 1 } }
    const nodes: PlanNode[] = [
      {
        productTypeId: 2,
        name: 'Part',
        mode: 'build',
        runs: 50,
        isRoot: false,
        totalDemandQty: 50,
        demandByParent: [],
        parentProductTypeIds: [],
        childProductTypeIds: [],
        bpcCount: 1,
        concurrentCopies: 1,
        jobTimeSeconds: 3600,
        outputQty: 50,
        isLeaf: true,
        depth: 1,
        canToggle: true,
      },
    ]
    const patch = syncPlanRunsFromProductionHours(t, nodes, 12, [bp, partBp], DEFAULT_SETTINGS)
    expect(patch.roots?.[0]?.readyByHours).toBe(6)
    expect(patch.roots?.[0]?.productionDurationHours).toBe(12)
    expect(patch.roots?.[0]?.runs).toBe(inGameRunsFromDurationHours(bp, DEFAULT_SETTINGS, 12))
    expect(patch.roots?.[0]?.runsFromReadyBy).toBeUndefined()
    expect(patch.nodeOverrides?.[2]?.runs).toBe(
      inGameRunsFromDurationHours(partBp, DEFAULT_SETTINGS, 12),
    )
    expect(patch.nodeOverrides?.[2]?.copies).toBe(1)
    expect(patch.nodeOverrides?.[2]?.runsFromReadyBy).toBeUndefined()
  })

  it('clears stored component runs in a root chain', () => {
    const t = template()
    t.nodeOverrides = {
      2: { runs: 99, runsFromReadyBy: true, copies: 2 },
      3: { runs: 50 },
    }
    const patch = clearChainComponentRunOverrides(t, [2, 3, 100], 100)
    expect(patch.nodeOverrides?.[2]).toEqual({ copies: 2 })
    expect(patch.nodeOverrides?.[3]).toBeUndefined()
  })

  it('aligns runs on duplicate roots when fixing ready-by', () => {
    const t = template()
    t.roots = [
      { id: 'r1', productTypeId: 100, runs: 5, productionDurationHours: 8 },
      { id: 'r2', productTypeId: 100, runs: 20, productionDurationHours: 8 },
    ]
    const patch = applyDeadlineRootRuns(t, 'r1', 12, 6, [100, 2])
    expect(patch.roots?.find((r) => r.id === 'r1')?.runs).toBe(12)
    expect(patch.roots?.find((r) => r.id === 'r2')?.runs).toBe(12)
    expect(patch.roots?.every((r) => r.runsFromReadyBy)).toBe(true)
  })

  it('applies deadline copies without touching runs', () => {
    const patch = applyDeadlineCopies(template(), new Map([[3, 4]]))
    expect(patch.nodeOverrides?.[3]?.copies).toBe(4)
    expect(patch.nodeOverrides?.[3]?.runs).toBeUndefined()
  })

  it('releases every pin and the seller when a character leaves', () => {
    const patch = removePlanCharacter(template(), 'sso:1')
    expect(patch.characters).toEqual(['sso:2'])
    expect(patch.roots?.[0]?.characterKey).toBeUndefined()
    expect(patch.nodeOverrides?.[2]?.characterKey).toBeUndefined()
    expect(patch.sellerCharacterKey).toBeUndefined()
  })

  it('re-derives root runs from stored duration when the root owner changes', () => {
    const bp: BlueprintInfo = {
      blueprintTypeId: 10001,
      productTypeId: 100,
      productQuantity: 1,
      manufacturingTime: 3600,
      materials: [],
      requiredSkills: {},
      tier: 't1',
      productGroup: 'Module',
      bpIconUrl: '',
      productIconUrl: '',
      productRenderUrl: '',
    }
    const fastSkills = { ...DEFAULT_SETTINGS.skills, industry: 5, advancedIndustry: 5 }
    const slowSkills = { ...DEFAULT_SETTINGS.skills, industry: 0, advancedIndustry: 0 }
    let t = template()
    t.roots = [
      {
        id: 'r1',
        productTypeId: 100,
        runs: 100,
        productionDurationHours: 24,
        runsFromDuration: true,
        characterKey: 'manual:fast',
      },
    ]
    t.characters = ['manual:fast', 'manual:slow']
    t = { ...t, ...setRootOwner(t, 'r1', 'manual:slow') }
    const ownerByProduct = new Map<number, 'manual:slow'>([[100, 'manual:slow']])
    const patch = syncPlanRunsAfterOwnerChange(
      t,
      [],
      [bp],
      DEFAULT_SETTINGS,
      {
        sso: [],
        manual: [
          { id: 'fast', name: 'Fast', skills: fastSkills },
          { id: 'slow', name: 'Slow', skills: slowSkills },
        ],
      },
      ownerByProduct,
      { rootId: 'r1', productTypeId: 100 },
      'production',
    )
    const slowRuns = inGameRunsFromDurationHours(
      bp,
      { ...DEFAULT_SETTINGS, skills: slowSkills },
      24,
    )
    expect(patch.roots?.[0]?.runs).toBe(slowRuns)
    expect(patch.roots?.[0]?.productionDurationHours).toBe(24)
    expect(slowRuns).toBeLessThan(
      inGameRunsFromDurationHours(bp, { ...DEFAULT_SETTINGS, skills: fastSkills }, 24),
    )
  })

  it('restores duration-derived runs in overall mode when switching back to a faster owner', () => {
    const bp: BlueprintInfo = {
      blueprintTypeId: 10001,
      productTypeId: 100,
      productQuantity: 1,
      manufacturingTime: 3600,
      materials: [],
      requiredSkills: {},
      tier: 't1',
      productGroup: 'Module',
      bpIconUrl: '',
      productIconUrl: '',
      productRenderUrl: '',
    }
    const fastSkills = { ...DEFAULT_SETTINGS.skills, industry: 5, advancedIndustry: 5 }
    const slowSkills = { ...DEFAULT_SETTINGS.skills, industry: 0, advancedIndustry: 0 }
    const fastSettings = { ...DEFAULT_SETTINGS, skills: fastSkills }
    const slowSettings = { ...DEFAULT_SETTINGS, skills: slowSkills }
    const fastRuns = inGameRunsFromDurationHours(bp, fastSettings, 24)
    const slowRuns = inGameRunsFromDurationHours(bp, slowSettings, 24)
    const t = template()
    t.durationMode = 'overall'
    t.roots = [
      {
        id: 'r1',
        productTypeId: 100,
        runs: slowRuns,
        productionDurationHours: 24,
        runsFromDuration: true,
        characterKey: 'manual:fast',
      },
    ]
    t.characters = ['manual:fast', 'manual:slow']
    const patch = syncPlanRunsAfterOwnerChange(
      t,
      [],
      [bp],
      DEFAULT_SETTINGS,
      {
        sso: [],
        manual: [
          { id: 'fast', name: 'Fast', skills: fastSkills },
          { id: 'slow', name: 'Slow', skills: slowSkills },
        ],
      },
      new Map([[100, 'manual:fast']]),
      { rootId: 'r1', productTypeId: 100 },
      'overall',
    )
    expect(slowRuns).toBeLessThan(fastRuns)
    expect(patch.roots?.[0]?.runs).toBe(fastRuns)
    expect(patch.roots?.[0]?.productionDurationHours).toBe(24)
  })

  it('syncAllPlanRunsFromStoredDuration uses owner skills for every root', () => {
    const bp: BlueprintInfo = {
      blueprintTypeId: 10001,
      productTypeId: 100,
      productQuantity: 1,
      manufacturingTime: 3600,
      materials: [],
      requiredSkills: {},
      tier: 't1',
      productGroup: 'Module',
      bpIconUrl: '',
      productIconUrl: '',
      productRenderUrl: '',
    }
    const slowSkills = { ...DEFAULT_SETTINGS.skills, industry: 0, advancedIndustry: 0 }
    const t = template()
    t.roots = [
      {
        id: 'r1',
        productTypeId: 100,
        runs: 999,
        productionDurationHours: 24,
        runsFromDuration: true,
        characterKey: 'manual:slow',
      },
    ]
    t.characters = ['manual:slow']
    const patch = syncAllPlanRunsFromStoredDuration(
      t,
      [],
      [bp],
      DEFAULT_SETTINGS,
      {
        sso: [],
        manual: [{ id: 'slow', name: 'Slow', skills: slowSkills }],
      },
      new Map([[100, 'manual:slow']]),
    )
    const slowRuns = inGameRunsFromDurationHours(
      bp,
      { ...DEFAULT_SETTINGS, skills: slowSkills },
      24,
    )
    expect(patch.roots?.[0]?.runs).toBe(slowRuns)
  })

  it('starts with a frozen split and stock, and resets to nothing', () => {
    const started = startPlanPatch({
      jobs: [
        {
          productTypeId: 1,
          name: 'x',
          slot: 0,
          startHour: 0,
          endHour: 1,
          runs: 5,
          outputQty: 5,
          stepKey: 'manufacture:1:1',
        },
      ],
      nodes: [],
      pooledStock: new Map([[34, 100]]),
      now: new Date('2026-10-07T00:00:00Z'),
    })
    expect(started.startedAt).toBe('2026-10-07T00:00:00.000Z')
    expect(started.stepSnapshot?.['manufacture:1:1']?.runs).toBe(5)
    expect(started.startStock).toEqual({ 34: 100 })
    expect(Object.values(resetPlanPatch()).every((v) => v === undefined)).toBe(true)
  })
})
