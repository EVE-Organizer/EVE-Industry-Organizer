export const EVE_SSO_AUTHORIZE_URL = 'https://login.eveonline.com/v2/oauth/authorize'
export const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token'
export const ESI_BASE = 'https://esi.evetech.net/latest'

/** Scopes for importing manufacturing and market skills. */
export const EVE_SCOPES = ['esi-skills.read_skills.v1'] as const

export function getClientId(): string | undefined {
  const id = import.meta.env.VITE_EVE_CLIENT_ID
  return typeof id === 'string' && id.trim() ? id.trim() : undefined
}

/** OAuth redirect URI registered with the EVE developer application. */
export function getCallbackUrl(): string {
  const configured = import.meta.env.VITE_EVE_CALLBACK_URL
  if (typeof configured === 'string' && configured.trim()) return configured.trim()

  const base = import.meta.env.BASE_URL ?? '/'
  if (base === './' || base === '/') {
    return `${window.location.origin}/auth/callback`
  }

  const path = base.endsWith('/') ? base.slice(0, -1) : base
  return `${window.location.origin}${path}/auth/callback`
}

export function isSsoConfigured(): boolean {
  return getClientId() !== undefined
}
