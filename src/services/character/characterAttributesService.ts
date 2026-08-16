import type { EveAttributeId } from '@/types'
import { esiAuthGet } from '@/services/character/esiAuthFetch'
import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'

export interface EsiCharacterAttributes {
  charisma: number
  intelligence: number
  memory: number
  perception: number
  willpower: number
  bonus_remaps?: number
  last_remap_date?: string
  bonus?: Partial<Record<EveAttributeId, number>>
}

export async function fetchCharacterAttributes(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions<EsiCharacterAttributes>,
): Promise<EsiCharacterAttributes> {
  return esiAuthGet<EsiCharacterAttributes>(
    `/characters/${characterId}/attributes/`,
    accessToken,
    { cacheKey: `esi:attributes:${characterId}`, ...options },
  )
}

export function esiAttributesToMap(attrs: EsiCharacterAttributes): Record<EveAttributeId, number> {
  return {
    intelligence: attrs.intelligence,
    memory: attrs.memory,
    perception: attrs.perception,
    willpower: attrs.willpower,
    charisma: attrs.charisma,
  }
}

export function esiBonusToMap(
  bonus: Partial<Record<EveAttributeId, number>> | undefined,
): Partial<Record<EveAttributeId, number>> {
  return {
    intelligence: bonus?.intelligence ?? 0,
    memory: bonus?.memory ?? 0,
    perception: bonus?.perception ?? 0,
    willpower: bonus?.willpower ?? 0,
    charisma: bonus?.charisma ?? 0,
  }
}
