import { makeProductionLocation } from '@/lib/productionLocations'
import { isEngineeringStructureTypeId } from '@/lib/structureTypeFromTypeId'
import { isRefineryStructureTypeId } from '@/lib/refineryTypeFromTypeId'
import type { ProductionLocation } from '@/types'

export interface IndustryStructureRow {
  id: number
  name: string
  solarSystemId: number
  typeId: number
}

export function industryStructuresInRange(
  structures: IndustryStructureRow[],
  nearbySystems: Set<number> | null,
  kind: 'manufacturing' | 'refinery',
): ProductionLocation[] {
  return structures
    .filter((row) => {
      if (nearbySystems && !nearbySystems.has(row.solarSystemId)) return false
      return kind === 'manufacturing'
        ? isEngineeringStructureTypeId(row.typeId)
        : isRefineryStructureTypeId(row.typeId)
    })
    .map((row) =>
      makeProductionLocation({
        locationId: row.id,
        kind: 'structure',
        name: row.name,
        solarSystemId: row.solarSystemId,
        structureTypeId: row.typeId,
        source: 'public_structure',
      }),
    )
}
