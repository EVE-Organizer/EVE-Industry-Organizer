import type { ProductionLocationKind, RefineryType } from '@/types'

const TYPE_ID_TO_REFINERY: Record<number, RefineryType> = {
  35835: 'athanor',
  35836: 'tatara',
}

export function isRefineryStructureTypeId(typeId: number | undefined): boolean {
  return typeId === 35835 || typeId === 35836
}

export function refineryTypeFromTypeId(
  typeId: number | undefined,
  kind: ProductionLocationKind,
): RefineryType {
  if (kind === 'station') return 'none'
  if (typeId == null) return 'custom'
  return TYPE_ID_TO_REFINERY[typeId] ?? 'custom'
}
