import { describe, expect, it } from 'vitest'
import { expandManufacturingPlan } from '@/lib/manufacturingPlan'
import {
  activeConcurrentCopies,
  supplySlotsForComponent,
  totalRootRuns,
} from '@/lib/supplyChainSlots'
import { DEFAULT_SETTINGS } from '@/types'
import blueprintsData from '../../public/data/blueprints.json'

const blueprints = blueprintsData.blueprints

describe('supplyChainSlots', () => {
  it('scales supply slots with bpc batches per root run', () => {
    expect(supplySlotsForComponent(4229, 50)).toBe(85)
    expect(supplySlotsForComponent(10, 50)).toBe(1)
    expect(supplySlotsForComponent(1, 50)).toBe(1)
  })

  it('caps active scheduling by skill slots and supply need', () => {
    expect(activeConcurrentCopies(false, 4229, 5, 50)).toBe(5)
    expect(activeConcurrentCopies(false, 10, 5, 50)).toBe(1)
    expect(activeConcurrentCopies(true, 50, 5, 50)).toBe(1)
    expect(activeConcurrentCopies(true, 50, 5, 50, 3)).toBe(3)
    expect(activeConcurrentCopies(true, 50, 2, 50, 5)).toBe(2)
  })

  it('assigns lower active concurrency to light sub-builds', () => {
    const template = {
      id: 't1',
      name: 'test',
      roots: [{ id: 'r1', productTypeId: 28710, runs: 50, productionDurationHours: 24 }],
      modeOverrides: {},
      nodeOverrides: {},
      defaultRunsPerBpc: 10,
      slotSource: 'skills' as const,
      manufacturingSlots: 6,
    }
    const prices = new Map<number, number>()
    for (const bp of blueprints) prices.set(bp.productTypeId, 1000)

    const expanded = expandManufacturingPlan({
      template,
      blueprints,
      typeMap: new Map(),
      prices,
      settings: {
        ...DEFAULT_SETTINGS,
        reactionFacility: {
          ...DEFAULT_SETTINGS.reactionFacility,
          refineryType: 'tatara',
        },
      },
      systemCostIndex: 0.01,
      reactionCostIndex: 0.01,
    })

    const rootRuns = totalRootRuns(template.roots.map((r) => r.runs))
    const grav = expanded.nodes.find((n) => n.productTypeId === 11534)!
    const light = expanded.nodes
      .filter((n) => n.mode === 'build' && !n.isRoot)
      .find((n) => supplySlotsForComponent(n.bpcCount, rootRuns) === 1)!

    expect(supplySlotsForComponent(grav.bpcCount, rootRuns)).toBeGreaterThan(5)
    expect(grav.concurrentCopies).toBe(expanded.slots)
    expect(light.concurrentCopies).toBe(1)
  })
})
