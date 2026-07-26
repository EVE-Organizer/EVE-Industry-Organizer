import { describe, expect, it } from 'vitest'
import {
  applicableMiningBuffIds,
  defaultMiningShipForSubtype,
  MINING_SHIPS,
  inferMiningBoostSpace,
  miningBuffIdsForBoostSpace,
  miningBuffsForContext,
  miningBuffsForSetup,
  normalizeMiningShipId,
  resolveUserMiningM3PerHr,
  toggleMiningBuffId,
} from '@/lib/miningShipPresets'

describe('miningShipPresets', () => {
  it('defaults to Retriever for ore', () => {
    expect(defaultMiningShipForSubtype('ore')).toBe('retriever')
    expect(resolveUserMiningM3PerHr('ore', 'retriever', [])).toBe(50_400)
  })

  it('switches invalid ship when subtype changes', () => {
    expect(normalizeMiningShipId('venture', 'ice')).toBe('retriever')
    expect(normalizeMiningShipId('prospect', 'ice')).toBe('retriever')
  })

  it('stacks only applicable buffs on ship rate', () => {
    const base = resolveUserMiningM3PerHr('ore', 'retriever', [], 'highsec')
    const boosted = resolveUserMiningM3PerHr(
      'ore',
      'retriever',
      ['mlu3', 'highwall', 'orcaBoost'],
      'highsec',
    )
    expect(boosted).toBeGreaterThan(base)
    expect(resolveUserMiningM3PerHr('ore', 'venture', ['mlu3', 'highwall'], 'highsec')).toBe(15_750)
  })

  it('shows space-appropriate fleet buffs', () => {
    const hs = miningBuffsForContext('retriever', 'ore', 'highsec', [])
    expect(hs.fleet.some((b) => b.id === 'orcaBoost')).toBe(true)
    expect(hs.fleet.some((b) => b.id === 'porpoiseBoost')).toBe(true)
    expect(hs.fleet.some((b) => b.id === 'rorqualBoost')).toBe(false)

    const ns = miningBuffsForContext('hulk', 'moon', 'nullsec', [])
    expect(ns.fleet.some((b) => b.id === 'rorqualBoost')).toBe(true)
    expect(ns.fleet.some((b) => b.id === 'porpoiseBoost')).toBe(true)
    expect(ns.fleet.some((b) => b.id === 'orcaBoost')).toBe(false)

    const wh = miningBuffsForContext('skiff', 'ore', 'wormhole', [])
    expect(wh.fleet.some((b) => b.id === 'porpoiseBoost')).toBe(true)

    const solo = miningBuffsForContext('retriever', 'ore', 'solo', [])
    expect(solo.fleet).toHaveLength(0)
  })

  it('shows mindlink only when a fleet burst is enabled', () => {
    const without = miningBuffsForContext('hulk', 'moon', 'nullsec', [])
    expect(without.fleet.some((b) => b.id === 'mindlink')).toBe(false)

    const withRorqual = miningBuffsForContext('hulk', 'moon', 'nullsec', ['rorqualBoost'])
    expect(withRorqual.fleet.some((b) => b.id === 'mindlink')).toBe(true)

    const withPorpoise = miningBuffsForContext('hulk', 'moon', 'wormhole', ['porpoiseBoost'])
    expect(withPorpoise.fleet.some((b) => b.id === 'mindlink')).toBe(true)
  })

  it('filters inactive buff ids for boost space', () => {
    expect(applicableMiningBuffIds('venture', 'ore', ['mlu3', 'orcaBoost'], 'highsec')).toEqual([
      'orcaBoost',
    ])
    expect(applicableMiningBuffIds('hulk', 'moon', ['rorqualBoost'], 'highsec')).toEqual([])
  })

  it('clears wrong-space fleet buffs when boost space changes', () => {
    expect(
      miningBuffIdsForBoostSpace(['mlu3', 'orcaBoost', 'mindlink'], 'nullsec'),
    ).toEqual(['mlu3'])
    expect(
      miningBuffIdsForBoostSpace(['mlu3', 'porpoiseBoost', 'mindlink'], 'solo'),
    ).toEqual(['mlu3'])
  })

  it('keeps only one fleet burst when multiple are saved', () => {
    expect(
      applicableMiningBuffIds('retriever', 'ore', ['orcaBoost', 'porpoiseBoost'], 'highsec'),
    ).toEqual(['orcaBoost'])
  })

  it('toggles fleet bursts exclusively', () => {
    expect(toggleMiningBuffId(['mlu3', 'orcaBoost'], 'porpoiseBoost')).toEqual([
      'mlu3',
      'porpoiseBoost',
    ])
  })

  it('infers boost space from fleet buff selection', () => {
    expect(inferMiningBoostSpace(['orcaBoost'])).toBe('highsec')
    expect(inferMiningBoostSpace(['rorqualBoost'])).toBe('nullsec')
    expect(inferMiningBoostSpace(['porpoiseBoost'], 'solo')).toBe('wormhole')
    expect(inferMiningBoostSpace(['porpoiseBoost'], 'highsec')).toBe('highsec')
    expect(inferMiningBoostSpace([])).toBe('solo')
  })

  it('lists setup buffs in one group without space sections', () => {
    const buffs = miningBuffsForSetup('retriever', 'ore', [])
    expect(buffs.some((b) => b.id === 'mlu3')).toBe(true)
    expect(buffs.some((b) => b.id === 'orcaBoost')).toBe(true)
    expect(buffs.some((b) => b.id === 'porpoiseBoost')).toBe(true)
    expect(buffs.some((b) => b.id === 'mindlink')).toBe(false)
  })

  it('uses Mackinaw rate for ice', () => {
    expect(resolveUserMiningM3PerHr('ice', 'mackinaw', [])).toBe(50_000)
  })

  it('includes Endurance for all mining types', () => {
    expect(resolveUserMiningM3PerHr('ore', 'endurance', [])).toBe(12_000)
    expect(resolveUserMiningM3PerHr('ice', 'endurance', [])).toBe(22_000)
    expect(resolveUserMiningM3PerHr('gas', 'endurance', [])).toBe(2_800)
  })

  it('lists all nine mining hulls', () => {
    expect(MINING_SHIPS).toHaveLength(9)
  })
})
