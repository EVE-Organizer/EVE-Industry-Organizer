import { esiAuthGet } from '@/services/character/esiAuthFetch'
import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'

/** ESI `/characters/{id}/implants/` returns implant type IDs, not objects. */
export type EsiImplantTypeIds = number[]

export function normalizeImplantTypeIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const ids: number[] = []
  for (const item of raw) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      ids.push(item)
      continue
    }
    if (item && typeof item === 'object' && 'type_id' in item) {
      const typeId = (item as { type_id: unknown }).type_id
      if (typeof typeId === 'number' && Number.isFinite(typeId)) ids.push(typeId)
    }
  }
  return ids
}

export async function fetchCharacterImplants(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions<unknown>,
): Promise<number[]> {
  const raw = await esiAuthGet<unknown>(
    `/characters/${characterId}/implants/`,
    accessToken,
    { cacheKey: `esi:implants:${characterId}`, ...options },
  )
  return normalizeImplantTypeIds(raw)
}
