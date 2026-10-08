import { describe, expect, it } from 'vitest'
import { classifyRefresh } from '@/lib/refreshCharacterData'

describe('classifyRefresh', () => {
  it('reports not-yet-updated-by-esi when the expiry is ahead and the checksum is unchanged', () => {
    const now = 1_000_000
    expect(
      classifyRefresh({
        beforeChecksum: 'abc',
        afterChecksum: 'abc',
        serverExpiresAt: now + 60_000,
        now,
      }),
    ).toBe('not-yet-updated-by-esi')
  })

  it('reports failed without blocking a later source', () => {
    expect(
      classifyRefresh({
        beforeChecksum: 'abc',
        afterChecksum: 'abc',
        lastError: 'ESI request failed (502)',
        serverExpiresAt: 0,
      }),
    ).toBe('failed')
    expect(
      classifyRefresh({
        beforeChecksum: 'abc',
        afterChecksum: 'def',
      }),
    ).toBe('updated')
  })
})