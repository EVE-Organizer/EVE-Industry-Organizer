import { describe, expect, it } from 'vitest'
import { isToolsPath } from '@/lib/toolsNav'

describe('isToolsPath', () => {
  it('matches tools routes', () => {
    expect(isToolsPath('/tools')).toBe(true)
    expect(isToolsPath('/tools/route-risk')).toBe(true)
    expect(isToolsPath('/tools/gate-check')).toBe(true)
    expect(isToolsPath('/tools/mining')).toBe(true)
  })

  it('does not match unrelated routes', () => {
    expect(isToolsPath('/')).toBe(false)
    expect(isToolsPath('/isk-hr/mining')).toBe(false)
    expect(isToolsPath('/settings')).toBe(false)
  })
})
