import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  ATTRIBUTE_TOTAL_POINTS,
  basesFromEsiTotals,
  defaultAttributes,
  effectiveAttributes,
  remainingRemapPoints,
} from '@/lib/skillAttributes'
import {
  implantBonusFromDescription,
  implantsFromTypeIds,
  mergeImplantBonuses,
  fittedImplantsFromTypeIds,
} from '@/lib/skillImplants'
import { normalizeImplantTypeIds } from '@/services/character/characterImplantsService'
import { skillPointsPerMinute } from '@/lib/skillTraining'

describe('skillAttributes', () => {
  it('defaults sum to 99 remap points', () => {
    const bases = defaultAttributes()
    expect(remainingRemapPoints(bases)).toBe(0)
    expect(
      bases.intelligence +
        bases.memory +
        bases.perception +
        bases.willpower +
        bases.charisma,
    ).toBe(ATTRIBUTE_TOTAL_POINTS)
  })

  it('clamps remap within bounds', () => {
    expect(ATTRIBUTE_MIN).toBe(17)
    expect(ATTRIBUTE_MAX).toBe(27)
  })

  it('adds implant bonuses to effective attributes', () => {
    const bases = defaultAttributes()
    const effective = effectiveAttributes(bases, {
      intelligence: 3,
      memory: 0,
      perception: 0,
      willpower: 0,
      charisma: 0,
    })
    expect(effective.intelligence).toBe(bases.intelligence + 3)
  })

  it('subtracts implants from ESI sheet totals to recover remap bases', () => {
    const remap = basesFromEsiTotals(
      {
        intelligence: 25,
        memory: 24,
        perception: 22,
        willpower: 20,
        charisma: 20,
      },
      { intelligence: 5, memory: 4, perception: 2, willpower: 0, charisma: 1 },
    )
    expect(remainingRemapPoints(remap.bases)).toBe(0)
    expect(remap.temporaryBoost.intelligence).toBe(0)
    expect(remap.bases.intelligence).toBe(20)
    expect(remap.bases.memory).toBe(20)
    expect(remap.bases.perception).toBe(20)
    expect(remap.bases.charisma).toBe(19)
  })

  it('separates cerebral accelerator boosts from the remap pool', () => {
    const implants = { intelligence: 4, memory: 4, perception: 4, willpower: 4, charisma: 0 }
    const totals = {
      intelligence: 31,
      memory: 31,
      perception: 31,
      willpower: 31,
      charisma: 26,
    }
    const remap = basesFromEsiTotals(totals, implants)
    expect(remainingRemapPoints(remap.bases)).toBe(0)
    expect(
      remap.bases.intelligence +
        remap.bases.memory +
        remap.bases.perception +
        remap.bases.willpower +
        remap.bases.charisma,
    ).toBe(ATTRIBUTE_TOTAL_POINTS)
    expect(effectiveAttributes(remap.bases, implants, remap.temporaryBoost)).toEqual(totals)
  })
})

describe('skillImplants', () => {
  it('maps implant type ids to attribute bonuses', () => {
    const bonuses = implantsFromTypeIds([10222, 10209])
    expect(bonuses.intelligence).toBe(5)
    expect(bonuses.memory).toBe(5)
  })

  it('maps elite Cyber Learning implants as +7', () => {
    const bonuses = implantsFromTypeIds([10224, 10211])
    expect(bonuses.intelligence).toBe(7)
    expect(bonuses.memory).toBe(7)
  })

  it('merges ESI bonus with clone implant type ids', () => {
    const fromTypes = implantsFromTypeIds([9943])
    const merged = mergeImplantBonuses(fromTypes, { intelligence: 3, memory: 0 })
    expect(merged.intelligence).toBe(3)
    expect(merged.memory).toBe(0)
  })

  it('reads ESI implant payloads as a type-id array', () => {
    expect(normalizeImplantTypeIds([10222, 10209])).toEqual([10222, 10209])
    expect(normalizeImplantTypeIds([{ type_id: 9943 }, { type_id: 10209 }])).toEqual([9943, 10209])
  })

  it('parses faction implant descriptions', () => {
    const parsed = implantBonusFromDescription(
      'Primary Effect: +4 Bonus to Perception\n\nSecondary Effect: 1% reduction in signature radius',
    )
    expect(parsed).toEqual({ attr: 'perception', bonus: 4 })
  })

  it('maps unknown type ids from SDE descriptions', () => {
    const descriptions = new Map<number, string | undefined>([
      [20499, 'Primary Effect: +4 Bonus to Intelligence'],
    ])
    const fitted = fittedImplantsFromTypeIds([20499], descriptions)
    expect(fitted.bonuses.intelligence).toBe(4)
  })
})

describe('spPerMinute scaling', () => {
  it('increases when intelligence implant is added', () => {
    const low = skillPointsPerMinute(20, 20)
    const high = skillPointsPerMinute(27, 20)
    expect(high).toBeGreaterThan(low)
  })
})
