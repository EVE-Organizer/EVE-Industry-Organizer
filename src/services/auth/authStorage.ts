import type { SkillLevels } from '@/types'

export interface EveAuthTokens {
  accessToken: string
  refreshToken: string
  /** Expiry as Unix ms. */
  expiresAt: number
}

/** Public character info (no tokens). */
export interface EveCharacterSession {
  characterId: number
  characterName: string
  lastSyncedAt?: string
  skills?: SkillLevels
}

export interface StoredCharacter extends EveCharacterSession {
  tokens: EveAuthTokens
}

export interface AuthAccountState {
  version: 1
  activeCharacterId: number | null
  characters: StoredCharacter[]
}

/** @deprecated Legacy single-character session shape. */
export interface EveAuthSession {
  tokens: EveAuthTokens
  character: EveCharacterSession
}

const AUTH_ACCOUNTS_KEY = 'eveio:authAccounts'
const LEGACY_AUTH_SESSION_KEY = 'eveio:authSession'

function emptyState(): AuthAccountState {
  return { version: 1, activeCharacterId: null, characters: [] }
}

export function toPublicCharacter(char: StoredCharacter): EveCharacterSession {
  return {
    characterId: char.characterId,
    characterName: char.characterName,
    lastSyncedAt: char.lastSyncedAt,
    skills: char.skills,
  }
}

export function toPublicCharacters(chars: StoredCharacter[]): EveCharacterSession[] {
  return chars.map(toPublicCharacter)
}

function migrateLegacySession(): AuthAccountState | null {
  try {
    const raw = localStorage.getItem(LEGACY_AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EveAuthSession
    if (!parsed.tokens?.accessToken || !parsed.character?.characterId) return null

    const stored: StoredCharacter = {
      characterId: parsed.character.characterId,
      characterName: parsed.character.characterName,
      lastSyncedAt: parsed.character.lastSyncedAt,
      skills: parsed.character.skills,
      tokens: parsed.tokens,
    }

    localStorage.removeItem(LEGACY_AUTH_SESSION_KEY)
    return {
      version: 1,
      activeCharacterId: stored.characterId,
      characters: [stored],
    }
  } catch {
    return null
  }
}

export function loadAuthAccounts(): AuthAccountState {
  try {
    const raw = localStorage.getItem(AUTH_ACCOUNTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AuthAccountState
      if (parsed.version === 1 && Array.isArray(parsed.characters)) {
        return {
          version: 1,
          activeCharacterId: parsed.activeCharacterId ?? null,
          characters: parsed.characters.filter((c) => c.tokens?.accessToken && c.characterId),
        }
      }
    }
  } catch {
    // fall through to migration
  }

  const migrated = migrateLegacySession()
  if (migrated) {
    saveAuthAccounts(migrated)
    return migrated
  }

  return emptyState()
}

export function saveAuthAccounts(state: AuthAccountState): void {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(state))
}

export function clearAuthAccounts(): void {
  localStorage.removeItem(AUTH_ACCOUNTS_KEY)
  localStorage.removeItem(LEGACY_AUTH_SESSION_KEY)
}

export function getActiveStoredCharacter(state = loadAuthAccounts()): StoredCharacter | null {
  if (state.activeCharacterId === null) return null
  return state.characters.find((c) => c.characterId === state.activeCharacterId) ?? null
}

export function getStoredCharacter(): EveCharacterSession | null {
  const active = getActiveStoredCharacter()
  return active ? toPublicCharacter(active) : null
}

export function getStoredCharacters(): EveCharacterSession[] {
  return toPublicCharacters(loadAuthAccounts().characters)
}
