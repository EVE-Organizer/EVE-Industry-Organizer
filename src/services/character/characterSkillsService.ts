import type { SkillLevels } from '@/types'
import { SKILL_FIELDS, normalizeImportedSkillLevels } from '@/lib/skillFields'
import { esiAuthGet } from '@/services/character/esiAuthFetch'
import type { EsiFetchOptions } from '@/services/character/esiAuthFetch'

export interface EsiSkill {
  skill_id: number
  trained_skill_level: number
  active_skill_level: number
  skillpoints_in_skill?: number
}

export interface EsiSkillsResponse {
  skills: EsiSkill[]
  total_sp: number
  unallocated_sp: number
}

export async function fetchCharacterSkills(
  characterId: number,
  accessToken: string,
  options?: EsiFetchOptions<EsiSkillsResponse>,
): Promise<EsiSkillsResponse> {
  return esiAuthGet<EsiSkillsResponse>(
    `/characters/${characterId}/skills/`,
    accessToken,
    { cacheKey: `esi:skills:${characterId}`, ...options },
  )
}

/** Map ESI skill rows to app skill keys used in profit, slots, and buildability. */
export function mapEsiSkillsToSkillLevels(esiSkills: EsiSkill[] | undefined): SkillLevels {
  const byId = new Map((esiSkills ?? []).map((s) => [s.skill_id, s.trained_skill_level]))
  const partial: Partial<SkillLevels> = {}

  for (const field of SKILL_FIELDS) {
    const level = byId.get(field.skillId)
    if (typeof level === 'number') {
      partial[field.key] = Math.min(5, Math.max(0, level))
    }
  }

  return normalizeImportedSkillLevels(partial)
}
