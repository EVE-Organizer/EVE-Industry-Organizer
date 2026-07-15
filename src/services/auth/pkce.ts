const PKCE_VERIFIER_KEY = 'eveio:pkceVerifier'
const OAUTH_STATE_KEY = 'eveio:oauthState'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** RFC 7636 code verifier (43-128 chars from unreserved set). */
export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32))
}

export async function codeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(hash))
}

export function generateOAuthState(): string {
  return base64UrlEncode(randomBytes(16))
}

export function storePkceVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
}

export function consumePkceVerifier(): string | null {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  return verifier
}

export function storeOAuthState(state: string): void {
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
}

export function consumeOAuthState(): string | null {
  const state = sessionStorage.getItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  return state
}
