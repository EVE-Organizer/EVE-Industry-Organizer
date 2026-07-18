import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import {
  applyME,
  applyTE,
  advancedIndustryTimeFactor,
  industryTimeFactor,
  teTimeFactor,
} from '@/lib/cost'
import type { BlueprintInfo, BlueprintRegistry } from '@/types'

/**
 * Golden checks against published in-game / SDE-derived numbers.
 * Sources:
 * - chruker.dk Venture BPO showinfo (Industry 5 + Adv Industry 5 skilled time)
 * - c4813.space industry formula example (100 Ventures, Raitaru)
 * - CCP Crius: TE steps are 2% each (display 0–20); Industry 4%/lvl; Adv Industry 3%/lvl
 * - EVE University: ME never below 1 unit per run
 */

function loadBlueprints(): BlueprintInfo[] {
  const data = JSON.parse(readFileSync('public/data/blueprints.json', 'utf8')) as
    | BlueprintRegistry
    | BlueprintInfo[]
  return Array.isArray(data) ? data : data.blueprints
}

describe('in-game golden: Venture (product 32880)', () => {
  const venture = loadBlueprints().find((b) => b.productTypeId === 32880)!

  it('SDE base manufacturing time is 1h 40m (6000s)', () => {
    expect(venture).toBeDefined()
    expect(venture.manufacturingTime).toBe(6000)
  })

  it('matches chruker skilled time: Industry V + Adv Industry V = 1h 8m', () => {
    // http://games.chruker.dk/eve_online/item.php?type_id=32881
    const seconds = applyTE(venture.manufacturingTime, 0, 1, 5, 5, 0)
    expect(seconds).toBe(4080)
  })

  it('matches c4813 example: 100 runs TE0 Raitaru15% Ind5 Adv4 = 359040s', () => {
    // https://www.c4813.space/eve-online-industry-formula/
    const seconds = applyTE(venture.manufacturingTime, 0, 100, 5, 4, 15)
    expect(seconds).toBe(359_040)
  })

  it('matches chruker ME table for Tritanium (1 run)', () => {
    const trit0 = applyME(venture.materials, 0, 1).find((m) => m.typeId === 34)!
    const trit10 = applyME(venture.materials, 10, 1).find((m) => m.typeId === 34)!
    expect(trit0.quantity).toBe(22_400)
    expect(trit10.quantity).toBe(20_160)
  })
})

describe('in-game golden: Nova Heavy Missile (product 206)', () => {
  const nova = loadBlueprints().find((b) => b.productTypeId === 206)!

  it('SDE base time is 10 min (600s), 100 missiles per run', () => {
    expect(nova.manufacturingTime).toBe(600)
    expect(nova.productQuantity).toBe(100)
  })

  it('6 runs at Industry I TE0 = 57:36 (3456s)', () => {
    expect(applyTE(nova.manufacturingTime, 0, 6, 1, 0, 0)).toBe(3456)
  })

  it('Nocxium qty-1 stays 100 units at ME10 × 100 runs', () => {
    const nocx = applyME(nova.materials, 10, 100).find((m) => m.typeId === 38)!
    expect(nocx.quantity).toBe(100)
  })
})

describe('in-game golden: modifier factors', () => {
  it('TE 20 is −20% time (not −80%)', () => {
    expect(teTimeFactor(20)).toBeCloseTo(0.8, 10)
  })

  it('Industry V is −20% and Advanced Industry V is −15%', () => {
    expect(industryTimeFactor(5)).toBeCloseTo(0.8, 10)
    expect(advancedIndustryTimeFactor(5)).toBeCloseTo(0.85, 10)
  })
})
