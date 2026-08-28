import { describe, expect, it } from 'vitest'
import { buildPlanPipeline } from '@/lib/planPipeline'
import { DEFAULT_SETTINGS } from '@/types'
import type { BlueprintInfo, PlanNode } from '@/types'

function mockBlueprint(
  partial: Partial<BlueprintInfo> & Pick<BlueprintInfo, 'productTypeId' | 'blueprintTypeId'>,
): BlueprintInfo {
  return {
    productQuantity: 1,
    manufacturingTime: 3600,
    materials: [],
    requiredSkills: {},
    tier: 't1',
    productGroup: 'Module',
    bpIconUrl: '',
    productIconUrl: '',
    productRenderUrl: '',
    ...partial,
  }
}

function mockNode(partial: Partial<PlanNode> & Pick<PlanNode, 'productTypeId' | 'name'>): PlanNode {
  return {
    mode: 'build',
    totalDemandQty: 10,
    demandByParent: [],
    parentProductTypeIds: [],
    childProductTypeIds: [],
    runs: 10,
    bpcCount: 1,
    concurrentCopies: 1,
    jobTimeSeconds: 3600,
    outputQty: 10,
    isRoot: true,
    isLeaf: false,
    depth: 0,
    canToggle: true,
    ...partial,
  }
}

describe('buildPlanPipeline', () => {
  const settings = DEFAULT_SETTINGS

  it('emits copy, invention, and manufacture for T2 build nodes with invention times', () => {
    const productTypeId = 500
    const blueprints = [
      mockBlueprint({
        blueprintTypeId: 15000,
        productTypeId,
        tier: 't2',
        invention: {
          t1BlueprintTypeId: 14000,
          datacores: [{ typeId: 11467, quantity: 1 }],
          runsPerBPC: 10,
          baseChance: 0.34,
          copyTime: 3600,
          inventionTime: 1800,
        },
      }),
    ]
    const nodes = [
      mockNode({
        productTypeId,
        name: 'T2 Module',
        runs: 10,
        jobTimeSeconds: 7200,
        unitPrice: 1_000_000,
      }),
    ]

    const { stages } = buildPlanPipeline({
      nodes,
      blueprints,
      settings,
      scienceSlots: 2,
      manufacturingSlots: 5,
    })

    const copy = stages.find((s) => s.id === `copy-${productTypeId}`)
    const invent = stages.find((s) => s.id === `invent-${productTypeId}`)
    const mfg = stages.find((s) => s.id === `mfg-${productTypeId}`)

    expect(copy).toMatchObject({ activity: 'copy', pool: 'science' })
    expect(invent).toMatchObject({ activity: 'invention', pool: 'science' })
    expect(mfg).toMatchObject({ activity: 'manufacture', pool: 'manufacturing' })

    expect(copy!.dependsOn).toEqual([])
    expect(invent!.dependsOn).toEqual([`copy-${productTypeId}`])
    expect(mfg!.dependsOn).toEqual([`copy-${productTypeId}`, `invent-${productTypeId}`])
    expect(copy!.durationHours).toBeLessThan(1.2)
    expect(invent!.durationHours).toBeLessThan(0.7)
  })

  it('skips pipeline stages for buy-mode nodes', () => {
    const productTypeId = 501
    const blueprints = [
      mockBlueprint({
        blueprintTypeId: 15001,
        productTypeId,
        tier: 't2',
        invention: {
          t1BlueprintTypeId: 14001,
          datacores: [{ typeId: 11467, quantity: 1 }],
          runsPerBPC: 10,
          baseChance: 0.34,
          copyTime: 3600,
          inventionTime: 1800,
        },
      }),
    ]
    const nodes = [
      mockNode({
        productTypeId,
        name: 'Bought T2',
        mode: 'buy',
        runs: 0,
        jobTimeSeconds: 0,
        outputQty: 0,
      }),
    ]

    const { stages } = buildPlanPipeline({
      nodes,
      blueprints,
      settings,
      scienceSlots: 1,
      manufacturingSlots: 1,
    })

    expect(stages.filter((s) => s.productTypeId === productTypeId)).toHaveLength(0)
  })

  it('uses reaction activity on the manufacturing pool for reaction recipes', () => {
    const productTypeId = 600
    const blueprints = [
      mockBlueprint({
        blueprintTypeId: 16000,
        productTypeId,
        kind: 'reaction',
        materials: [{ typeId: 34, quantity: 100 }],
      }),
    ]
    const nodes = [
      mockNode({
        productTypeId,
        name: 'Fuel Block',
        recipeKind: 'reaction',
        runs: 5,
        jobTimeSeconds: 1800,
      }),
    ]

    const { stages } = buildPlanPipeline({
      nodes,
      blueprints,
      settings,
      scienceSlots: 1,
      manufacturingSlots: 3,
    })

    expect(stages).toHaveLength(1)
    expect(stages[0]).toMatchObject({
      id: `mfg-${productTypeId}`,
      activity: 'reaction',
      pool: 'manufacturing',
    })
  })

  it('applies Sotiyo science TE so copy and invention finish faster than NPC', () => {
    const productTypeId = 502
    const blueprints = [
      mockBlueprint({
        blueprintTypeId: 15002,
        productTypeId,
        tier: 't2',
        invention: {
          t1BlueprintTypeId: 14002,
          datacores: [{ typeId: 11467, quantity: 1 }],
          runsPerBPC: 10,
          baseChance: 1,
          copyTime: 3600,
          inventionTime: 1800,
        },
      }),
    ]
    const nodes = [
      mockNode({
        productTypeId,
        name: 'T2 Module',
        runs: 10,
        jobTimeSeconds: 7200,
        unitPrice: 1,
      }),
    ]
    const npc = buildPlanPipeline({
      nodes,
      blueprints,
      settings,
      scienceSlots: 2,
      manufacturingSlots: 5,
    })
    const sotiyo = buildPlanPipeline({
      nodes,
      blueprints,
      settings: {
        ...settings,
        copyFacility: { ...settings.copyFacility, structureType: 'sotiyo' },
        inventionFacility: { ...settings.inventionFacility, structureType: 'sotiyo' },
      },
      scienceSlots: 2,
      manufacturingSlots: 5,
    })
    const npcCopy = npc.stages.find((s) => s.id === `copy-${productTypeId}`)!
    const sotiyoCopy = sotiyo.stages.find((s) => s.id === `copy-${productTypeId}`)!
    const npcInvent = npc.stages.find((s) => s.id === `invent-${productTypeId}`)!
    const sotiyoInvent = sotiyo.stages.find((s) => s.id === `invent-${productTypeId}`)!
    expect(sotiyoCopy.durationHours).toBeCloseTo(npcCopy.durationHours * 0.75, 5)
    expect(sotiyoInvent.durationHours).toBeCloseTo(npcInvent.durationHours * 0.75, 5)
  })
})
