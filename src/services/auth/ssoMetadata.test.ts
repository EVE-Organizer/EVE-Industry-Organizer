import { describe, expect, it } from 'vitest'
import { missingScopes, hasAllScopes } from '@/services/auth/ssoMetadata'

describe('ssoMetadata scopes', () => {
  it('detects missing scopes', () => {
    const missing = missingScopes(['esi-skills.read_skills.v1'])
    expect(missing).toContain('esi-industry.read_character_jobs.v1')
    expect(missing).toContain('esi-assets.read_assets.v1')
    expect(hasAllScopes(['esi-skills.read_skills.v1'])).toBe(false)
  })

  it('reports complete scope set', () => {
    const granted = [
      'esi-skills.read_skills.v1',
      'esi-industry.read_character_jobs.v1',
      'esi-characters.read_blueprints.v1',
      'esi-assets.read_assets.v1',
      'esi-corporations.read_structures.v1',
      'esi-assets.read_corporation_assets.v1',
      'esi-universe.read_structures.v1',
    ]
    expect(missingScopes(granted)).toEqual([])
    expect(hasAllScopes(granted)).toBe(true)
  })
})
