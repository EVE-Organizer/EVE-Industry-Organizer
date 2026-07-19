import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WAR_INTEL_SETTINGS,
  loadWarIntelSettings,
  saveWarIntelSettings,
} from '@/lib/warIntelSettings'

const STORAGE_KEY = 'eveio:warIntelSettings'

describe('warIntelSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns defaults when nothing is stored', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    })
    expect(loadWarIntelSettings()).toEqual(DEFAULT_WAR_INTEL_SETTINGS)
  })

  it('round-trips valid settings', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    })

    saveWarIntelSettings({
      anchor: 'mapCenter',
      radius: 20,
      window: '7d',
      mapCenterSystemId: 30000142,
    })

    expect(loadWarIntelSettings()).toEqual({
      anchor: 'mapCenter',
      radius: 20,
      window: '7d',
      mapCenterSystemId: 30000142,
    })
    expect(store.get(STORAGE_KEY)).toBeTruthy()
  })

  it('falls back to defaults for invalid stored values', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() =>
        JSON.stringify({
          anchor: 'invalid',
          radius: 99,
          window: '2d',
          mapCenterSystemId: -1,
        }),
      ),
      setItem: vi.fn(),
    })

    expect(loadWarIntelSettings()).toEqual(DEFAULT_WAR_INTEL_SETTINGS)
  })

  it('migrates removed 1h window to default', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() =>
        JSON.stringify({
          anchor: 'factory',
          radius: 12,
          window: '1h',
          mapCenterSystemId: null,
        }),
      ),
      setItem: vi.fn(),
    })

    expect(loadWarIntelSettings().window).toBe('1d')
  })
})
