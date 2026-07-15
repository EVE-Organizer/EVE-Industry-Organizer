import { describe, expect, it } from 'vitest'
import { parseAccessToken } from '@/services/auth/jwtClaims'

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${body}.signature`
}

describe('parseAccessToken', () => {
  it('extracts character id, name, and scopes from EVE JWT', () => {
    const jwt = makeJwt({
      sub: 'CHARACTER:EVE:2112625428',
      name: 'Test Pilot',
      scp: ['esi-skills.read_skills.v1'],
      exp: 1_700_000_000,
    })

    expect(parseAccessToken(jwt)).toEqual({
      characterId: 2112625428,
      characterName: 'Test Pilot',
      scopes: ['esi-skills.read_skills.v1'],
      exp: 1_700_000_000,
    })
  })

  it('rejects unexpected subject format', () => {
    const jwt = makeJwt({ sub: 'USER:EVE:1', name: 'Bad' })
    expect(() => parseAccessToken(jwt)).toThrow(/subject/)
  })

  it('accepts scp as a space-separated string', () => {
    const jwt = makeJwt({
      sub: 'CHARACTER:EVE:1',
      name: 'Pilot',
      scp: 'esi-skills.read_skills.v1',
    })
    expect(parseAccessToken(jwt).scopes).toEqual(['esi-skills.read_skills.v1'])
  })
})
