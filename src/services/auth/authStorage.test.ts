import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  clearAuthAccounts,
  getStoredCharacter,
  getStoredCharacters,
  loadAuthAccounts,
  saveAuthAccounts,
  type EveAuthSession,
} from '@/services/auth/authStorage'

const LEGACY_KEY = 'eveio:authSession'
const ACCOUNTS_KEY = 'eveio:authAccounts'

describe('authStorage multi-character', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    })
  })

  it('migrates legacy single-character session', () => {
    const legacy: EveAuthSession = {
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 60_000,
      },
      character: {
        characterId: 123,
        characterName: 'Test Pilot',
        lastSyncedAt: '2026-01-01T00:00:00.000Z',
      },
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const state = loadAuthAccounts()
    expect(state.characters).toHaveLength(1)
    expect(state.activeCharacterId).toBe(123)
    expect(getStoredCharacter()?.characterName).toBe('Test Pilot')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('stores multiple characters with an active selection', () => {
    saveAuthAccounts({
      version: 1,
      activeCharacterId: 2,
      characters: [
        {
          characterId: 1,
          characterName: 'Alpha',
          tokens: { accessToken: 'a', refreshToken: 'ra', expiresAt: 0 },
          skillsSnapshotVersion: 4,
        },
        {
          characterId: 2,
          characterName: 'Bravo',
          tokens: { accessToken: 'b', refreshToken: 'rb', expiresAt: 0 },
          skillsSnapshotVersion: 4,
        },
      ],
    })

    expect(getStoredCharacters()).toHaveLength(2)
    expect(getStoredCharacter()?.characterName).toBe('Bravo')
    expect(localStorage.getItem(ACCOUNTS_KEY)).toContain('Bravo')
    clearAuthAccounts()
    expect(loadAuthAccounts().characters).toHaveLength(0)
  })

  it('clears legacy skill snapshots missing skillsSnapshotVersion', () => {
    saveAuthAccounts({
      version: 1,
      activeCharacterId: 1,
      characters: [
        {
          characterId: 1,
          characterName: 'Zoe Ross',
          tokens: { accessToken: 'a', refreshToken: 'ra', expiresAt: 0 },
          skills: {
            industry: 5,
            advancedIndustry: 3,
            science: 0,
            accounting: 0,
            brokerRelations: 0,
          },
        },
      ],
    })

    const state = loadAuthAccounts()
    expect(state.characters[0]?.skills).toBeUndefined()
    expect(getStoredCharacter()?.skills).toBeUndefined()
  })

  it('clears skill snapshots from an older snapshot version', () => {
    saveAuthAccounts({
      version: 1,
      activeCharacterId: 1,
      characters: [
        {
          characterId: 1,
          characterName: 'Zoe Ross',
          tokens: { accessToken: 'a', refreshToken: 'ra', expiresAt: 0 },
          skillsSnapshotVersion: 1,
          skills: {
            industry: 5,
            advancedIndustry: 5,
            massProduction: 5,
            advancedMassProduction: 5,
            science: 0,
            accounting: 0,
            brokerRelations: 0,
          },
        },
      ],
    })

    const state = loadAuthAccounts()
    expect(state.characters[0]?.skills).toBeUndefined()
  })
})
