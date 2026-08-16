import { describe, expect, it } from 'vitest'
import { HUBS } from '@/types'
import { formatHubLabel, hubDisplayName, isNpcTradeHub } from '@/lib/hubDisplay'

describe('hubDisplay', () => {
  it('identifies NPC trade hubs by sell station', () => {
    expect(isNpcTradeHub(HUBS.find((h) => h.id === 'jita')!)).toBe(true)
    expect(isNpcTradeHub(HUBS.find((h) => h.id === 'ympwl')!)).toBe(false)
  })

  it('formats NPC hubs as region (system)', () => {
    expect(formatHubLabel(HUBS.find((h) => h.id === 'jita')!)).toBe('The Forge (Jita)')
    expect(formatHubLabel(HUBS.find((h) => h.id === 'amarr')!)).toBe('Domain (Amarr)')
  })

  it('formats player structure hubs as region only', () => {
    expect(formatHubLabel(HUBS.find((h) => h.id === 'ympwl')!)).toBe('Providence')
    expect(formatHubLabel(HUBS.find((h) => h.id === 'vale')!)).toBe('Vale of the Silent')
  })

  it('looks up display name by hub id', () => {
    expect(hubDisplayName('dodixie')).toBe('Sinq Laison (Dodixie)')
    expect(hubDisplayName('ympwl')).toBe('Providence')
    expect(hubDisplayName('vale')).toBe('Vale of the Silent')
  })
})
