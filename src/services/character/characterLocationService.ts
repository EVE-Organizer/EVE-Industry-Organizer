import { esiAuthGet } from '@/services/character/esiAuthFetch'

interface EsiCharacterLocation {
  solar_system_id: number
  station_id?: number
  structure_id?: number
}

export async function fetchCharacterSolarSystemId(
  characterId: number,
  accessToken: string,
): Promise<number | null> {
  const data = await esiAuthGet<EsiCharacterLocation | null>(
    `/characters/${characterId}/location/`,
    accessToken,
    {
      cacheKey: `esi:char-location:${characterId}`,
      forbiddenFallback: null,
    },
  )
  return data?.solar_system_id && data.solar_system_id > 0 ? data.solar_system_id : null
}
