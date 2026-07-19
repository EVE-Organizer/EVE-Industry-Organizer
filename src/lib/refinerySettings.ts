import type { GlobalSettings, RefineryType, ReactionFacilitySettings } from '@/types'
import { REFINERY_HULL_PRESETS } from '@/types'

/** EVE type icons for refinery options. */
export const REFINERY_TYPE_IDS: Record<RefineryType, number> = {
  none: 1529,
  athanor: 35835,
  tatara: 35836,
  custom: 35836,
}

export const REFINERY_TYPES: RefineryType[] = ['none', 'athanor', 'tatara', 'custom']

export function refineryTypeLabel(type: RefineryType): string {
  switch (type) {
    case 'none':
      return 'No refinery (NPC / buy reactions)'
    case 'athanor':
      return 'Athanor (medium)'
    case 'tatara':
      return 'Tatara (large)'
    case 'custom':
      return 'Custom refinery'
  }
}

export function isActiveRefinery(type: RefineryType): boolean {
  return type !== 'none'
}

export function isPresetRefinery(type: RefineryType): boolean {
  return type === 'athanor' || type === 'tatara'
}

export function refineryHullTePercent(type: RefineryType, customTe: number): number {
  if (type === 'athanor') return REFINERY_HULL_PRESETS.athanor.hullTeBonusPercent
  if (type === 'tatara') return REFINERY_HULL_PRESETS.tatara.hullTeBonusPercent
  if (type === 'custom') return customTe
  return 0
}

/** Apply preset hull TE when the user picks a refinery type. */
export function patchRefineryType(
  refineryType: RefineryType,
  current: ReactionFacilitySettings,
): Partial<GlobalSettings> {
  if (refineryType === 'none') {
    return {
      reactionFacility: {
        ...current,
        refineryType,
        hullTeBonusPercent: 0,
      },
    }
  }
  if (refineryType === 'custom') {
    return {
      reactionFacility: {
        ...current,
        refineryType,
      },
    }
  }
  return {
    reactionFacility: {
      ...current,
      refineryType,
      hullTeBonusPercent: REFINERY_HULL_PRESETS[refineryType].hullTeBonusPercent,
    },
  }
}

export const REACTION_FAMILY_LABELS: Record<
  'composite' | 'biochemical' | 'hybrid',
  string
> = {
  composite: 'Composite',
  biochemical: 'Biochemical',
  hybrid: 'Hybrid',
}
