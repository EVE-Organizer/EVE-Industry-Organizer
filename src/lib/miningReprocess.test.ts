import { describe, expect, it } from 'vitest'
import { DEFAULT_REPROCESS_YIELD } from '@/lib/miningIph'
import {
  formatReprocessYieldStatus,
  reprocessCoreYield,
  reprocessGroupSkillKey,
  reprocessSkillGroupsForSubtype,
  reprocessSkillKeysForSubtype,
  miningReprocessHullFromLocation,
  miningReprocessSpaceFromSecurity,
  reprocessStructureBase,
  reprocessYieldForItem,
  reprocessYieldStatusForSubtype,
} from '@/lib/miningReprocess'
import type { MiningItem } from '@/types'

function sampleItem(group: string, subtype: MiningItem['subtype'] = 'ore'): MiningItem {
  return {
    typeId: 1230,
    name: 'Test Ore',
    group,
    volume: 0.1,
    portionSize: 100,
    subtype,
    foundIn: ['highsec'],
    compressedTypeId: 62516,
    reprocess: [{ typeId: 34, quantityPerBatch: 400 }],
    iconUrl: '',
  }
}

describe('miningReprocess', () => {
  it('maps ore groups to processing skills', () => {
    expect(reprocessGroupSkillKey('Veldspar', 'ore')).toBe('simpleOreProcessing')
    expect(reprocessGroupSkillKey('Mercoxit', 'ore')).toBe('mercoxitOreProcessing')
    expect(reprocessGroupSkillKey('Ice', 'ice')).toBe('iceProcessing')
    expect(reprocessGroupSkillKey('Ubiquitous Moon Asteroids', 'moon')).toBe(
      'ubiquitousMoonOreProcessing',
    )
  })

  it('lists reprocess skill groups by subtype', () => {
    expect(reprocessSkillGroupsForSubtype('gas')).toEqual([])
    expect(reprocessSkillGroupsForSubtype('ice')).toEqual([
      { label: 'Core', keys: ['reprocessing', 'reprocessingEfficiency'] },
      { label: 'Ice', keys: ['iceProcessing'] },
    ])
    expect(reprocessSkillGroupsForSubtype('ore')[1]?.keys).toContain('simpleOreProcessing')
  })

  it('lists reprocess skills by subtype', () => {
    expect(reprocessSkillKeysForSubtype('gas')).toEqual([])
    expect(reprocessSkillKeysForSubtype('ice')).toContain('iceProcessing')
    expect(reprocessSkillKeysForSubtype('ore')).toContain('simpleOreProcessing')
  })

  it('counts reprocessing skills without prerequisite gating', () => {
    const skills = {
      reprocessing: 5,
      reprocessingEfficiency: 5,
      simpleOreProcessing: 5,
    }
    expect(reprocessCoreYield(skills)).toBeCloseTo(0.5 * 1.15 * 1.1)
    expect(reprocessYieldForItem(sampleItem('Veldspar'), skills)).toBeCloseTo(
      0.5 * 1.15 * 1.1 * 1.1,
    )
  })

  it('uses NPC 50% when reprocessing skills are untrained', () => {
    expect(reprocessYieldForItem(sampleItem('Veldspar'), {})).toBeCloseTo(DEFAULT_REPROCESS_YIELD)
    expect(reprocessCoreYield({})).toBeCloseTo(DEFAULT_REPROCESS_YIELD)
    expect(formatReprocessYieldStatus('ore', {})).toBe('50% refine')
  })

  it('reports refine yield range from core and group skills', () => {
    const skills = {
      industry: 5,
      reprocessing: 5,
      reprocessingEfficiency: 5,
      simpleOreProcessing: 5,
      mercoxitOreProcessing: 0,
    }
    const status = reprocessYieldStatusForSubtype('ore', skills)
    expect(status).not.toBeNull()
    expect(status!.core).toBeCloseTo(0.5 * 1.15 * 1.1)
    expect(status!.max).toBeGreaterThan(status!.core)
    expect(formatReprocessYieldStatus('ore', skills)).toMatch(/% refine$/)
  })

  it('applies group skill only for matching ore', () => {
    const base = {
      industry: 5,
      reprocessing: 5,
      reprocessingEfficiency: 5,
    }
    const withMatchingGroup = reprocessYieldForItem(sampleItem('Veldspar'), {
      ...base,
      simpleOreProcessing: 5,
    })
    const withWrongGroup = reprocessYieldForItem(sampleItem('Veldspar'), {
      ...base,
      mercoxitOreProcessing: 5,
    })
    expect(withMatchingGroup).toBeGreaterThan(withWrongGroup)
    expect(withWrongGroup).toBeCloseTo(reprocessYieldForItem(sampleItem('Veldspar'), base))
  })

  it('uses the Upwell refine formula for hull, rig, and security', () => {
    expect(reprocessStructureBase({ hull: 'npc', rig: 't2', space: 'nullsec' })).toBeCloseTo(0.5)
    expect(reprocessStructureBase({ hull: 'athanor', rig: 'none', space: 'highsec' })).toBeCloseTo(0.51)
    expect(reprocessStructureBase({ hull: 'tatara', rig: 'none', space: 'highsec' })).toBeCloseTo(
      0.5 * 1.055,
    )
    expect(reprocessStructureBase({ hull: 'upwell', rig: 't1', space: 'highsec' })).toBeCloseTo(0.51)
    expect(reprocessStructureBase({ hull: 'tatara', rig: 't2', space: 'nullsec' })).toBeCloseTo(
      (53 * 1.12 * 1.055) / 100,
    )
    expect(
      formatReprocessYieldStatus('ice', {}, { hull: 'athanor', rig: 'none', space: 'highsec' }),
    ).toBe('51% refine')
  })

  it('maps character locations to refine hull and space', () => {
    expect(miningReprocessHullFromLocation('station')).toBe('npc')
    expect(miningReprocessHullFromLocation('structure', 35835)).toBe('athanor')
    expect(miningReprocessHullFromLocation('structure', 35836)).toBe('tatara')
    expect(miningReprocessHullFromLocation('structure', 35833)).toBe('upwell')
    expect(miningReprocessSpaceFromSecurity(0.9)).toBe('highsec')
    expect(miningReprocessSpaceFromSecurity(0.4)).toBe('lowsec')
    expect(miningReprocessSpaceFromSecurity(-0.1)).toBe('nullsec')
  })
})
