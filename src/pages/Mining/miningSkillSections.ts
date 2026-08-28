import type { MiningBoosterHullId, MiningSubtype } from '@/types'
import type { MiningShipPreset } from '@/lib/miningShipPresets'
import type { SkillFieldDef } from '@/lib/skillFields'

export function hullSkillKeys(ship: MiningShipPreset): SkillFieldDef['key'][] {
  if (ship.tier === 'exhumer') return ['miningBarge', 'exhumers']
  if (ship.tier === 'barge') return ['miningBarge']
  if (ship.tier === 'expedition') return ['miningFrigate', 'expeditionFrigates']
  if (ship.tier === 'frigate') return ['miningFrigate']
  return []
}

export function minerSkillKeys(subtype: MiningSubtype): SkillFieldDef['key'][] {
  if (subtype === 'ice') return ['iceHarvesting']
  if (subtype === 'gas') return ['gasCloudHarvesting']
  return ['mining', 'astrogeology']
}

export function boosterHullSkillKeys(hull: MiningBoosterHullId | null): SkillFieldDef['key'][] {
  if (hull === 'rorqual') return ['capitalIndustrialShips']
  if (hull) return ['industrialCommandShips']
  return []
}

export const MINING_BURST_SKILL_KEYS: SkillFieldDef['key'][] = ['miningDirector']
