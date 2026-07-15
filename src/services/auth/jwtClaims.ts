export interface EveJwtClaims {
  characterId: number
  characterName: string
  scopes: string[]
  exp: number
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Parse EVE SSO access token JWT payload (signature not verified). */
export function parseAccessToken(jwt: string): EveJwtClaims {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('Invalid access token')

  const payload = JSON.parse(decodeBase64Url(parts[1]!)) as {
    sub?: string
    name?: string
    scp?: string[] | string
    exp?: number
  }

  const sub = payload.sub ?? ''
  const match = /^CHARACTER:EVE:(\d+)$/i.exec(sub)
  if (!match) throw new Error('Unexpected token subject')

  const characterId = Number(match[1])
  if (!Number.isFinite(characterId)) throw new Error('Invalid character id in token')

  const scopes = Array.isArray(payload.scp)
    ? payload.scp
    : typeof payload.scp === 'string'
      ? payload.scp.split(' ').filter(Boolean)
      : []

  return {
    characterId,
    characterName: payload.name ?? 'Unknown',
    scopes,
    exp: typeof payload.exp === 'number' ? payload.exp : 0,
  }
}
