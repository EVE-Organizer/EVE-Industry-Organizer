import type { GlobalSettings, StructureType } from '@/types'
import { STRUCTURE_HULL_PRESETS } from '@/types'

/** EVE type icons for manufacturing location options. */
export const STRUCTURE_TYPE_IDS: Record<StructureType, number> = {
  npc: 1529,
  raitaru: 35825,
  azbel: 35826,
  sotiyo: 35827,
  custom: 35832,
}

export const STRUCTURE_TYPES: StructureType[] = ['npc', 'raitaru', 'azbel', 'sotiyo', 'custom']

/** Apply preset hull bonuses when the user picks a structure type. Rigs are unchanged. */
export function patchStructureType(structureType: StructureType): Partial<GlobalSettings> {
  if (structureType === 'npc') {
    return {
      structureType,
      structureMeBonusPercent: 0,
      structureTeBonusPercent: 0,
      structureJobCostBonusPercent: 0,
      structureTaxPercent: 0,
    }
  }
  if (structureType === 'custom') {
    return { structureType }
  }
  const hull = STRUCTURE_HULL_PRESETS[structureType]
  return {
    structureType,
    structureMeBonusPercent: hull.hullMeBonusPercent,
    structureTeBonusPercent: hull.hullTeBonusPercent,
    structureJobCostBonusPercent: hull.hullJobCostBonusPercent,
  }
}

export function structureTypeLabel(type: StructureType): string {
  switch (type) {
    case 'npc':
      return 'NPC station'
    case 'raitaru':
      return 'Raitaru (medium)'
    case 'azbel':
      return 'Azbel (large)'
    case 'sotiyo':
      return 'Sotiyo (xlarge)'
    case 'custom':
      return 'Custom structure'
  }
}

export function isPlayerStructure(type: StructureType): boolean {
  return type !== 'npc'
}

export function isPresetPlayerStructure(type: StructureType): boolean {
  return type === 'raitaru' || type === 'azbel' || type === 'sotiyo'
}

export function jobCostSectionTitle(type: StructureType): string {
  return isPlayerStructure(type) ? 'Job cost (player structure)' : 'Job cost (NPC station)'
}

/** Base job cost before structure role bonus and owner tax (EIV × system cost index). */
export function baseJobCostFromIndex(estimatedItemValue: number, systemCostIndex: number): number {
  return estimatedItemValue * systemCostIndex
}
