import type { SkillLevels } from '@/types'
import {
  clearAuthAccounts,
  CHARACTER_SKILLS_SNAPSHOT_VERSION,
  getActiveStoredCharacter,
  getStoredCharacter,
  getStoredCharacters,
  loadAuthAccounts,
  saveAuthAccounts,
  toPublicCharacter,
  type AuthAccountState,
  type EveAuthSession,
  type EveAuthTokens,
  type EveCharacterSession,
  type StoredCharacter,
} from '@/services/auth/authStorage'
import { parseAccessToken } from '@/services/auth/jwtClaims'
import {
  codeChallenge,
  consumeOAuthState,
  consumePkceVerifier,
  generateCodeVerifier,
  generateOAuthState,
  storeOAuthState,
  storePkceVerifier,
} from '@/services/auth/pkce'
import {
  EVE_SCOPES,
  EVE_SSO_AUTHORIZE_URL,
  EVE_SSO_TOKEN_URL,
  getCallbackUrl,
  getClientId,
  isSsoConfigured,
} from '@/services/auth/ssoMetadata'

export { getStoredCharacter, getStoredCharacters, isSsoConfigured }

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

function tokensFromResponse(body: TokenResponse): EveAuthTokens {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  }
}

function sessionFromTokens(tokens: EveAuthTokens): EveAuthSession {
  const claims = parseAccessToken(tokens.accessToken)
  const character: EveCharacterSession = {
    characterId: claims.characterId,
    characterName: claims.characterName,
  }
  return { tokens, character }
}

function storedFromSession(
  session: EveAuthSession,
  existing?: StoredCharacter,
): StoredCharacter {
  return {
    characterId: session.character.characterId,
    characterName: session.character.characterName,
    tokens: session.tokens,
    lastSyncedAt: existing?.lastSyncedAt,
    skills: existing?.skills,
  }
}

function upsertCharacter(state: AuthAccountState, stored: StoredCharacter): AuthAccountState {
  const index = state.characters.findIndex((c) => c.characterId === stored.characterId)
  const characters =
    index === -1
      ? [...state.characters, stored]
      : state.characters.map((c, i) => (i === index ? stored : c))

  return {
    version: 1,
    activeCharacterId: stored.characterId,
    characters,
  }
}

async function exchangeToken(body: URLSearchParams): Promise<EveAuthTokens> {
  const clientId = getClientId()
  if (!clientId) throw new Error('EVE SSO is not configured')

  const res = await fetch(EVE_SSO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Token exchange failed (${res.status})${text ? `: ${text}` : ''}`)
  }

  return tokensFromResponse((await res.json()) as TokenResponse)
}

/** Redirect the browser to EVE SSO login (adds or refreshes a character). */
export async function beginLogin(): Promise<void> {
  const clientId = getClientId()
  if (!clientId) throw new Error('EVE SSO is not configured')

  const verifier = generateCodeVerifier()
  const challenge = await codeChallenge(verifier)
  const state = generateOAuthState()

  storePkceVerifier(verifier)
  storeOAuthState(state)

  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: getCallbackUrl(),
    client_id: clientId,
    scope: EVE_SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.assign(`${EVE_SSO_AUTHORIZE_URL}?${params}`)
}

/** Complete OAuth after redirect; adds or updates the character and sets them active. */
export async function handleCallback(code: string, state: string): Promise<EveCharacterSession> {
  const expectedState = consumeOAuthState()
  if (!expectedState || expectedState !== state) {
    throw new Error('OAuth state mismatch')
  }

  const verifier = consumePkceVerifier()
  if (!verifier) throw new Error('Missing PKCE verifier')

  const clientId = getClientId()
  if (!clientId) throw new Error('EVE SSO is not configured')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    code_verifier: verifier,
    redirect_uri: getCallbackUrl(),
  })

  const tokens = await exchangeToken(body)
  const session = sessionFromTokens(tokens)
  const accounts = loadAuthAccounts()
  const existing = accounts.characters.find((c) => c.characterId === session.character.characterId)
  const stored = storedFromSession(session, existing)
  saveAuthAccounts(upsertCharacter(accounts, stored))
  return toPublicCharacter(stored)
}

async function refreshAccessToken(refreshToken: string): Promise<EveAuthTokens> {
  const clientId = getClientId()
  if (!clientId) throw new Error('EVE SSO is not configured')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })

  return exchangeToken(body)
}

function updateCharacterTokens(characterId: number, tokens: EveAuthTokens): StoredCharacter | null {
  const accounts = loadAuthAccounts()
  const index = accounts.characters.findIndex((c) => c.characterId === characterId)
  if (index === -1) return null

  const claims = parseAccessToken(tokens.accessToken)
  const existing = accounts.characters[index]!
  const updated: StoredCharacter = {
    ...existing,
    characterName: claims.characterName,
    tokens,
  }

  const characters = [...accounts.characters]
  characters[index] = updated
  saveAuthAccounts({ ...accounts, characters })
  return updated
}

/** Return a valid access token for a character, refreshing when close to expiry. */
export async function getValidAccessToken(characterId?: number): Promise<string | null> {
  const accounts = loadAuthAccounts()
  const id = characterId ?? accounts.activeCharacterId
  if (id === null) return null

  const stored = accounts.characters.find((c) => c.characterId === id)
  if (!stored) return null

  const { tokens } = stored
  const expiresSoon = tokens.expiresAt - Date.now() < 60_000

  if (!expiresSoon) return tokens.accessToken

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken)
    const updated = updateCharacterTokens(id, refreshed)
    return updated?.tokens.accessToken ?? null
  } catch {
    removeCharacter(id)
    return null
  }
}

export function setActiveCharacter(characterId: number): EveCharacterSession | null {
  const accounts = loadAuthAccounts()
  const stored = accounts.characters.find((c) => c.characterId === characterId)
  if (!stored) return null

  saveAuthAccounts({ ...accounts, activeCharacterId: characterId })
  return toPublicCharacter(stored)
}

export function removeCharacter(characterId: number): void {
  const accounts = loadAuthAccounts()
  const characters = accounts.characters.filter((c) => c.characterId !== characterId)
  let activeCharacterId = accounts.activeCharacterId

  if (activeCharacterId === characterId) {
    activeCharacterId = characters[0]?.characterId ?? null
  }

  if (characters.length === 0) {
    clearAuthAccounts()
    return
  }

  saveAuthAccounts({ version: 1, activeCharacterId, characters })
}

export function logoutAll(): void {
  clearAuthAccounts()
}

export function touchCharacterSync(
  characterId: number,
  patch?: { lastSyncedAt?: string; skills?: SkillLevels },
): void {
  const accounts = loadAuthAccounts()
  const index = accounts.characters.findIndex((c) => c.characterId === characterId)
  if (index === -1) return

  const existing = accounts.characters[index]!
  const characters = [...accounts.characters]
  characters[index] = {
    ...existing,
    lastSyncedAt: patch?.lastSyncedAt ?? new Date().toISOString(),
    skills: patch?.skills ? { ...patch.skills } : existing.skills,
    skillsSnapshotVersion: CHARACTER_SKILLS_SNAPSHOT_VERSION,
  }
  saveAuthAccounts({ ...accounts, characters })
}

export function getActiveCharacterSkills(): SkillLevels | undefined {
  return getActiveStoredCharacter()?.skills
}
