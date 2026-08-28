import type {
  GlobalSettings,
  ProductionLocationKind,
  ReactionFacilitySettings,
  RefineryType,
} from '@/types'
import { refineryHullPreset } from '@/lib/upwellCatalog'

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

export function isRefineryStructureTypeId(typeId: number | undefined): boolean {
  return typeId === REFINERY_TYPE_IDS.athanor || typeId === REFINERY_TYPE_IDS.tatara
}

export function refineryTypeFromTypeId(
  typeId: number | undefined,
  kind: ProductionLocationKind,
): RefineryType {
  if (kind === 'station') return 'none'
  if (typeId == null) return 'custom'
  if (typeId === REFINERY_TYPE_IDS.athanor) return 'athanor'
  if (typeId === REFINERY_TYPE_IDS.tatara) return 'tatara'
  return 'custom'
}

export function refineryHullTePercent(type: RefineryType, customTe: number): number {
  if (type === 'athanor') return refineryHullPreset('athanor').hullTeBonusPercent
  if (type === 'tatara') return refineryHullPreset('tatara').hullTeBonusPercent
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
      hullTeBonusPercent: refineryHullPreset(refineryType).hullTeBonusPercent,
    },
  }
}

export const REACTION_FAMILY_LABELS: Record<'composite' | 'biochemical' | 'hybrid', string> = {
  composite: 'Composite',
  biochemical: 'Biochemical',
  hybrid: 'Hybrid',
}
