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

function applyCharacterSkills(character: EveCharacterSession | null): void {
  if (character?.skills) {
    useAppStore.getState().updateSettings({ skills: character.skills })
  }
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
  syncSkills: (characterId?: number) => Promise<void>
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
    applyCharacterSkills(snapshot.character)
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
    const character = setActiveCharacter(characterId)
    if (!character) return

    const snapshot = readAuthSnapshot()
    set({ ...snapshot, error: null })

    if (character.skills) {
      applyCharacterSkills(character)
    } else {
      void get().syncSkills(characterId)
    }
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

      const esi = await fetchCharacterSkills(targetId, accessToken)
      const skills = mapEsiSkillsToSkillLevels(esi.skills)
      const syncedAt = new Date().toISOString()
      touchCharacterSync(targetId, { lastSyncedAt: syncedAt, skills })

      const snapshot = readAuthSnapshot()
      set({ ...snapshot, isBusy: false })

      if (snapshot.activeCharacterId === targetId) {
        useAppStore.getState().updateSettings({ skills })
      }
    } catch (err) {
      set({
        isBusy: false,
        error: err instanceof Error ? err.message : 'Failed to sync skills',
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
    applyCharacterSkills(snapshot.character)
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
