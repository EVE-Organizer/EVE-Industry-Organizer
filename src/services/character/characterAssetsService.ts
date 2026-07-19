import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'
import { esiAuthGetAllPages } from '@/services/character/esiAuthFetch'

export interface EsiAsset {
  item_id: number
  is_singleton: boolean
  location_flag: string
  location_id: number
  location_type: 'station' | 'solar_system' | 'item' | 'other' | string
  quantity: number
  type_id: number
}

export async function fetchCharacterAssets(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions,
): Promise<EsiAsset[]> {
  return esiAuthGetAllPages<EsiAsset>(
    `/characters/${characterId}/assets/`,
    accessToken,
    `esi:assets:${characterId}`,
    options,
  )
}
