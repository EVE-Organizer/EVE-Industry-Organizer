import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getWarOverlayBase,
  getWarOverlaySeedFromSmallerRadius,
  setWarOverlayCached,
  type WarOverlayCacheParams,
} from '@/services/market/warOverlayCache'

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  })
}

const BASE_PARAMS: WarOverlayCacheParams = {
  scanSystemId: 30000142,
  radius: 20,
  window: '1d',
  sellHubId: 'jita',
  manufacturingSystemId: 30000142,
}

const PAYLOAD = {
  warResults: [],
  warTheaters: [],
  killsFetchedAt: 1_700_000_000_000,
}

describe('war overlay radius seeding', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
  })

  it('reuses the largest smaller-radius cache when widening scan radius', () => {
    setWarOverlayCached({ ...BASE_PARAMS, radius: 12 }, {
      ...PAYLOAD,
      warTheaters: [{ id: 'inner', systemIds: [1], systemNames: ['Inner'] } as never],
    })

    const seed = getWarOverlaySeedFromSmallerRadius(BASE_PARAMS)
    expect(seed?.data.warTheaters[0]?.id).toBe('inner')

    const base = getWarOverlayBase(BASE_PARAMS)
    expect(base?.exact).toBe(false)
    expect(base?.overlay.data.warTheaters[0]?.id).toBe('inner')
  })

  it('prefers the exact-radius cache when present', () => {
    setWarOverlayCached({ ...BASE_PARAMS, radius: 12 }, {
      ...PAYLOAD,
      warTheaters: [{ id: 'inner', systemIds: [1], systemNames: ['Inner'] } as never],
    })
    setWarOverlayCached(BASE_PARAMS, {
      ...PAYLOAD,
      warTheaters: [{ id: 'outer', systemIds: [2], systemNames: ['Outer'] } as never],
    })

    const base = getWarOverlayBase(BASE_PARAMS)
    expect(base?.exact).toBe(true)
    expect(base?.overlay.data.warTheaters[0]?.id).toBe('outer')
  })
})
