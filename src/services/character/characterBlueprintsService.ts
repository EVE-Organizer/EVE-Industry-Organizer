import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'
import { esiAuthGetAllPages } from '@/services/character/esiAuthFetch'

export interface EsiBlueprint {
  item_id: number
  location_flag: string
  location_id: number
  material_efficiency: number
  time_efficiency: number
  quantity: number
  runs: number
  type_id: number
}

export interface BlueprintItemState {
  itemId: number
  typeId: number
  materialEfficiency: number
  timeEfficiency: number
  /** -1 for a blueprint original. */
  runs: number
}

export function mapEsiBlueprint(blueprint: EsiBlueprint): BlueprintItemState {
  return {
    itemId: blueprint.item_id,
    typeId: blueprint.type_id,
    materialEfficiency: blueprint.material_efficiency,
    timeEfficiency: blueprint.time_efficiency,
    runs: blueprint.runs,
  }
}

export async function fetchCharacterBlueprints(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions,
): Promise<EsiBlueprint[]> {
  return esiAuthGetAllPages<EsiBlueprint>(
    `/characters/${characterId}/blueprints/`,
    accessToken,
    `esi:blueprints:${characterId}`,
    options,
  )
}
