import { useQuery } from '@tanstack/react-query'
import { getValidAccessToken } from '@/services/auth/eveAuth'
import { EsiAuthError } from '@/services/character/esiAuthFetch'
import {
  fetchCharacterSkillQueue,
  type EsiSkillQueueEntry,
} from '@/services/character/characterSkillQueueService'
import {
  fetchCharacterAttributes,
  type EsiCharacterAttributes,
} from '@/services/character/characterAttributesService'
import { fetchCharacterImplants } from '@/services/character/characterImplantsService'
import {
  fetchCharacterSkills,
  type EsiSkillsResponse,
} from '@/services/character/characterSkillsService'

const CHARACTER_DATA_STALE_MS = 10 * 60 * 1000
const CHARACTER_DATA_GC_MS = 24 * 60 * 60 * 1000

export function characterSkillQueueQueryOptions(characterId: number, forceRefresh = false) {
  return {
    queryKey: ['character-skillqueue', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: async (): Promise<EsiSkillQueueEntry[]> => {
      const accessToken = await getValidAccessToken(characterId)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      return fetchCharacterSkillQueue(
        characterId,
        accessToken,
        forceRefresh ? { forceRefresh: true } : undefined,
      )
    },
  }
}

export function useCharacterSkillQueue(characterId: number | null | undefined) {
  return useQuery({
    ...characterSkillQueueQueryOptions(characterId!),
    enabled: characterId != null,
  })
}

export function characterAttributesQueryOptions(characterId: number, forceRefresh = false) {
  return {
    queryKey: ['character-attributes', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: async (): Promise<EsiCharacterAttributes> => {
      const accessToken = await getValidAccessToken(characterId)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      return fetchCharacterAttributes(
        characterId,
        accessToken,
        forceRefresh ? { forceRefresh: true } : undefined,
      )
    },
  }
}

export function useCharacterAttributes(characterId: number | null | undefined) {
  return useQuery({
    ...characterAttributesQueryOptions(characterId!),
    enabled: characterId != null,
  })
}

export function characterImplantsQueryOptions(characterId: number, forceRefresh = false) {
  return {
    queryKey: ['character-implants', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: async (): Promise<number[]> => {
      const accessToken = await getValidAccessToken(characterId)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      return fetchCharacterImplants(
        characterId,
        accessToken,
        forceRefresh ? { forceRefresh: true } : undefined,
      )
    },
  }
}

export function useCharacterImplants(characterId: number | null | undefined) {
  return useQuery({
    ...characterImplantsQueryOptions(characterId!),
    enabled: characterId != null,
  })
}

export function characterSkillsQueryOptions(characterId: number, forceRefresh = false) {
  return {
    queryKey: ['character-skills', characterId] as const,
    staleTime: CHARACTER_DATA_STALE_MS,
    gcTime: CHARACTER_DATA_GC_MS,
    refetchOnMount: true as const,
    queryFn: async (): Promise<EsiSkillsResponse> => {
      const accessToken = await getValidAccessToken(characterId)
      if (!accessToken) throw new EsiAuthError('Session expired. Sign in again.', 401)
      return fetchCharacterSkills(
        characterId,
        accessToken,
        forceRefresh ? { forceRefresh: true } : undefined,
      )
    },
  }
}

export function useCharacterSkills(characterId: number | null | undefined) {
  return useQuery({
    ...characterSkillsQueryOptions(characterId!),
    enabled: characterId != null,
  })
}
