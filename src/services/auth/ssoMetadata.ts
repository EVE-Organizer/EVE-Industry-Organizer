export const EVE_SSO_AUTHORIZE_URL = 'https://login.eveonline.com/v2/oauth/authorize'
export const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token'
export const ESI_BASE = 'https://esi.evetech.net/latest'

/**
 * Scopes for skills (includes attributes), jobs, blueprint ME/TE, assets, and structures.
 * Enable "Read character blueprints" on your app at developers.eveonline.com or SSO returns invalid_scope.
 */
export const EVE_SCOPES = [
  'esi-skills.read_skills.v1',
  'esi-skills.read_skillqueue.v1',
  'esi-clones.read_implants.v1',
  'esi-industry.read_character_jobs.v1',
  'esi-characters.read_blueprints.v1',
  'esi-assets.read_assets.v1',
  'esi-corporations.read_structures.v1',
  'esi-assets.read_corporation_assets.v1',
  'esi-universe.read_structures.v1',
] as const

export const EVE_BLUEPRINT_SCOPE = 'esi-characters.read_blueprints.v1' as const

export type EveScope = (typeof EVE_SCOPES)[number]

export function missingScopes(granted: readonly string[]): EveScope[] {
  const set = new Set(granted)
  return EVE_SCOPES.filter((scope) => !set.has(scope))
}

export function hasAllScopes(granted: readonly string[]): boolean {
  return missingScopes(granted).length === 0
}

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
