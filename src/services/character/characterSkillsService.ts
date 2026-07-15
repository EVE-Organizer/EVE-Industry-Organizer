import type { SkillLevels } from '@/types'
import { SKILL_FIELDS, normalizeImportedSkillLevels } from '@/lib/skillFields'
import { ESI_BASE } from '@/services/auth/ssoMetadata'
import { dedupe, throttle } from '@/services/market/requestQueue'

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
): Promise<EsiSkillsResponse> {
  return dedupe(`esi:skills:${characterId}`, async () => {
    await throttle()
    const res = await fetch(`${ESI_BASE}/characters/${characterId}/skills/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status === 401) throw new Error('Session expired. Sign in again.')
    if (!res.ok) throw new Error(`Failed to fetch skills (${res.status})`)

    return (await res.json()) as EsiSkillsResponse
  })
}

/** Map ESI skill rows to the five app skill keys used in profit and buildability. */
export function mapEsiSkillsToSkillLevels(esiSkills: EsiSkill[] | undefined): SkillLevels {
  const byId = new Map((esiSkills ?? []).map((s) => [s.skill_id, s.trained_skill_level]))
  const result = normalizeImportedSkillLevels({})

  for (const field of SKILL_FIELDS) {
    const level = byId.get(field.skillId)
    if (typeof level === 'number') {
      result[field.key] = Math.min(5, Math.max(0, level))
    }
  }

  return result
}
