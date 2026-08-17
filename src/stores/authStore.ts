import { create } from 'zustand'
import {
  beginLogin,
  getStoredCharacter,
  getStoredCharacters,
  getValidAccessToken,
  handleCallback,
  isSsoConfigured,
  logoutAll,
  removeCharacter,
  setActiveCharacter,
  touchCharacterSync,
} from '@/services/auth/eveAuth'
import type { EveCharacterSession } from '@/services/auth/authStorage'
import {
  fetchCharacterSkills,
  mapEsiSkillsToSkillLevels,
} from '@/services/character/characterSkillsService'
import { useAppStore } from '@/stores/appStore'
import {
  mergeAssumedWithTrainedSkillLevels,
  normalizeImportedSkillLevels,
} from '@/lib/skillFields'
import { queryClient } from '@/lib/queryClient'
import { refreshCharacterApiCaches } from '@/lib/refreshCharacterData'
import { ZERO_SKILLS, type SkillLevels } from '@/types'

function applyAssumedSkills(skills: SkillLevels): void {
  useAppStore.getState().updateSettings({
    skills: normalizeImportedSkillLevels(skills),
  })
}

function applyZeroSkills(): void {
  useAppStore.getState().updateSettings({
    skills: { ...ZERO_SKILLS },
    inventionSkillLevel: 0,
  })
}

function assumedLevelsForCharacter(character: EveCharacterSession | null): SkillLevels | null {
  if (!character) return null
  if (character.skills) return normalizeImportedSkillLevels(character.skills)
  if (character.trainedSkills) return normalizeImportedSkillLevels(character.trainedSkills)
  return null
}

function activateCharacterSkills(
  character: EveCharacterSession | null,
  sync: (characterId: number) => void,
): void {
  if (!character) return
  const assumed = assumedLevelsForCharacter(character)
  if (assumed) {
    applyAssumedSkills(assumed)
    return
  }
  applyZeroSkills()
  sync(character.characterId)
}

function persistEsiSkillSync(
  characterId: number,
  trainedSkills: SkillLevels,
  syncedAt: string,
): EveCharacterSession | null {
  const snapshot = getStoredCharacter()
  const existing = snapshot?.characterId === characterId ? snapshot : null
  const assumedSkills = existing?.skills

  touchCharacterSync(characterId, {
    lastSyncedAt: syncedAt,
    trainedSkills,
    skills: assumedSkills
      ? mergeAssumedWithTrainedSkillLevels(assumedSkills, trainedSkills)
      : { ...trainedSkills },
  })

  return getStoredCharacter()
}

interface AuthStore {
  configured: boolean
  characters: EveCharacterSession[]
  activeCharacterId: number | null
  character: EveCharacterSession | null
  isAuthenticated: boolean
  isBusy: boolean
  error: string | null
  hydrated: boolean
  hydrate: () => void
  login: () => Promise<void>
  completeCallback: (code: string, state: string) => Promise<void>
  switchCharacter: (characterId: number) => void
  persistActiveSkillsFromSettings: () => void
  resetAssumedToTrained: () => void
  syncSkills: (characterId?: number) => Promise<void>
  refreshCharacter: (characterId?: number) => Promise<void>
  logoutCharacter: (characterId?: number) => void
  logoutAll: () => void
  clearError: () => void
}

function readAuthSnapshot() {
  const characters = getStoredCharacters()
  const character = getStoredCharacter()
  return {
    characters,
    activeCharacterId: character?.characterId ?? null,
    character,
    isAuthenticated: characters.length > 0,
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  configured: isSsoConfigured(),
  characters: [],
  activeCharacterId: null,
  character: null,
  isAuthenticated: false,
  isBusy: false,
  error: null,
  hydrated: false,

  hydrate: () => {
    const snapshot = readAuthSnapshot()
    set({
      configured: isSsoConfigured(),
      ...snapshot,
      hydrated: true,
    })
    activateCharacterSkills(snapshot.character, (id) => {
      void get().syncSkills(id).catch(() => {})
    })
  },

  login: async () => {
    set({ error: null, isBusy: true })
    try {
      await beginLogin()
    } catch (err) {
      set({
        isBusy: false,
        error: err instanceof Error ? err.message : 'Sign-in failed',
      })
    }
  },

  completeCallback: async (code, state) => {
    set({ error: null, isBusy: true })
    try {
      const character = await handleCallback(code, state)
      const snapshot = readAuthSnapshot()
      set({
        ...snapshot,
        isBusy: false,
        error: null,
      })
      applyZeroSkills()

      void get()
        .syncSkills(character.characterId)
        .catch((err) => {
          set({
            error: err instanceof Error ? err.message : 'Signed in, but skill sync failed',
          })
        })
    } catch (err) {
      set({
        isBusy: false,
        error: err instanceof Error ? err.message : 'Sign-in failed',
      })
      throw err
    }
  },

  switchCharacter: (characterId) => {
    const previousId = get().activeCharacterId
    if (previousId != null && previousId !== characterId) {
      const skills = useAppStore.getState().userData.settings.skills
      touchCharacterSync(previousId, { skills: { ...skills } })
    }

    if (!setActiveCharacter(characterId)) return

    const snapshot = readAuthSnapshot()
    set({ ...snapshot, error: null })

    activateCharacterSkills(snapshot.character, (id) => {
      void get().syncSkills(id).catch(() => {})
    })
  },

  persistActiveSkillsFromSettings: () => {
    const characterId = get().activeCharacterId
    if (characterId == null) return

    const skills = useAppStore.getState().userData.settings.skills
    touchCharacterSync(characterId, { skills: { ...skills } })
    set({ ...readAuthSnapshot(), error: null })
  },

  resetAssumedToTrained: () => {
    const characterId = get().activeCharacterId
    const character = get().character
    if (characterId == null || !character?.trainedSkills) return

    const trained = normalizeImportedSkillLevels(character.trainedSkills)
    touchCharacterSync(characterId, { skills: { ...trained } })
    applyAssumedSkills(trained)
    set({ ...readAuthSnapshot(), error: null })
  },

  syncSkills: async (characterId) => {
    const targetId = characterId ?? get().activeCharacterId ?? get().character?.characterId
    if (!targetId) {
      set({ error: 'Sign in with EVE first' })
      return
    }

    set({ error: null, isBusy: true })
    try {
      const accessToken = await getValidAccessToken(targetId)
      if (!accessToken) {
        const snapshot = readAuthSnapshot()
        set({
          ...snapshot,
          isBusy: false,
          error: 'Session expired. Sign in again.',
        })
        return
      }

      const esi = await fetchCharacterSkills(targetId, accessToken, { forceRefresh: true })
      const trainedSkills = mapEsiSkillsToSkillLevels(esi.skills)
      const syncedAt = new Date().toISOString()
      const updated = persistEsiSkillSync(targetId, trainedSkills, syncedAt)

      const snapshot = readAuthSnapshot()
      set({ ...snapshot, isBusy: false })

      if (snapshot.activeCharacterId === targetId && updated) {
        const assumed = assumedLevelsForCharacter(updated)
        if (assumed) applyAssumedSkills(assumed)
      }
    } catch (err) {
      set({
        isBusy: false,
        error: err instanceof Error ? err.message : 'Failed to sync skills',
      })
      throw err
    }
  },

  refreshCharacter: async (characterId) => {
    const targetId = characterId ?? get().activeCharacterId ?? get().character?.characterId
    if (!targetId) {
      set({ error: 'Sign in with EVE first' })
      return
    }

    set({ error: null, isBusy: true })
    try {
      const accessToken = await getValidAccessToken(targetId)
      if (!accessToken) {
        const snapshot = readAuthSnapshot()
        set({
          ...snapshot,
          isBusy: false,
          error: 'Session expired. Sign in again.',
        })
        return
      }

      const esi = await fetchCharacterSkills(targetId, accessToken, { forceRefresh: true })
      const trainedSkills = mapEsiSkillsToSkillLevels(esi.skills)
      const syncedAt = new Date().toISOString()
      const updated = persistEsiSkillSync(targetId, trainedSkills, syncedAt)

      await refreshCharacterApiCaches(queryClient, targetId)

      const snapshot = readAuthSnapshot()
      set({ ...snapshot, isBusy: false })

      if (snapshot.activeCharacterId === targetId && updated) {
        const assumed = assumedLevelsForCharacter(updated)
        if (assumed) applyAssumedSkills(assumed)
      }
    } catch (err) {
      set({
        isBusy: false,
        error: err instanceof Error ? err.message : 'Failed to refresh character data',
      })
      throw err
    }
  },

  logoutCharacter: (characterId) => {
    const id = characterId ?? get().activeCharacterId
    if (id === null) return

    removeCharacter(id)
    const snapshot = readAuthSnapshot()
    set({ ...snapshot, error: null })
    activateCharacterSkills(snapshot.character, (nextId) => {
      void get().syncSkills(nextId).catch(() => {})
    })
  },

  logoutAll: () => {
    logoutAll()
    set({
      characters: [],
      activeCharacterId: null,
      character: null,
      isAuthenticated: false,
      error: null,
    })
  },

  clearError: () => set({ error: null }),
}))
