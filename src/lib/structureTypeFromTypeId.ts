import type { StructureType } from '@/types'

/** SDE structure type IDs for engineering complexes. */
export const STRUCTURE_TYPE_IDS: Record<Exclude<StructureType, 'npc' | 'custom'>, number> = {
  raitaru: 35825,
  azbel: 35826,
  sotiyo: 35827,
}

const TYPE_ID_TO_STRUCTURE: Record<number, StructureType> = {
  35825: 'raitaru',
  35826: 'azbel',
  35827: 'sotiyo',
}

export function structureTypeFromTypeId(typeId: number | undefined): StructureType {
  if (typeId == null) return 'npc'
  return TYPE_ID_TO_STRUCTURE[typeId] ?? 'custom'
}

export function isPlayerStructureTypeId(typeId: number | undefined): boolean {
  return typeId != null && typeId in TYPE_ID_TO_STRUCTURE
}

export function isEngineeringStructureTypeId(typeId: number | undefined): boolean {
  return typeId === 35825 || typeId === 35826 || typeId === 35827
}
