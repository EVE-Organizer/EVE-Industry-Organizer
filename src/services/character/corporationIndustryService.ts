import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'
import { esiAuthGet, esiAuthGetAllPages, esiPublicGet } from '@/services/character/esiAuthFetch'
import type { EsiAsset } from '@/services/character/characterAssetsService'

export interface EsiCharacterPublic {
  corporation_id?: number
  alliance_id?: number
}

export interface EsiCorpStructure {
  structure_id: number
  type_id: number
  system_id: number
  state: string
}

export interface EsiUniverseStructure {
  name: string
  solar_system_id: number
  type_id: number
}

export interface EsiStation {
  name: string
  system_id: number
  type_id: number
}

export async function fetchCharacterCorporationId(characterId: number): Promise<number | null> {
  const data = await esiPublicGet<EsiCharacterPublic>(`/characters/${characterId}/`, {
    cacheKey: `esi:char-public:${characterId}`,
  })
  return data?.corporation_id ?? null
}

export async function fetchCorporationStructures(
  corporationId: number,
  accessToken: string,
  options?: EsiFetchOptions<EsiCorpStructure[]>,
): Promise<EsiCorpStructure[]> {
  return esiAuthGet<EsiCorpStructure[]>(
    `/corporations/${corporationId}/structures/`,
    accessToken,
    { cacheKey: `esi:corp-structures:${corporationId}`, forbiddenFallback: [], ...options },
  )
}

export async function fetchCorporationAssets(
  corporationId: number,
  accessToken: string,
  options?: EsiFetchOptions<EsiAsset[]>,
): Promise<EsiAsset[]> {
  return esiAuthGetAllPages<EsiAsset>(
    `/corporations/${corporationId}/assets/`,
    accessToken,
    `esi:corp-assets:${corporationId}`,
    { forbiddenFallback: [], ...options },
  )
}

export async function fetchUniverseStructure(
  structureId: number,
  accessToken?: string,
): Promise<EsiUniverseStructure | null> {
  const cacheKey = `esi:structure:${structureId}`

  if (accessToken) {
    try {
      return await esiAuthGet<EsiUniverseStructure>(
        `/universe/structures/${structureId}/`,
        accessToken,
        { cacheKey },
      )
    } catch {
      // Fall back to the public endpoint for structures that do not need auth.
    }
  }

  return esiPublicGet<EsiUniverseStructure>(`/universe/structures/${structureId}/`, {
    cacheKey: `${cacheKey}:public`,
  })
}

export async function fetchUniverseStation(stationId: number): Promise<EsiStation | null> {
  return esiPublicGet<EsiStation>(`/universe/stations/${stationId}/`, {
    cacheKey: `esi:station:${stationId}`,
  })
}
