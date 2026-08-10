import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCached, setCached, TTL } from '@/services/cache/cacheStore'
import { esiAuthGet, esiAuthGetAllPages } from '@/services/character/esiAuthFetch'

vi.mock('@/services/market/requestQueue', () => ({
  dedupe: (_key: string, fn: () => Promise<unknown>) => fn(),
  throttle: () => Promise.resolve(),
  esiPaused: () => false,
  noteEsiResponse: () => {},
}))

function installLocalStorage(): void {
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

describe('esiAuthGet', () => {
  beforeEach(() => {
    installLocalStorage()
    vi.restoreAllMocks()
  })

  it('returns fresh localStorage cache without calling fetch', async () => {
    const key = 'esi:jobs:123'
    setCached(key, [{ job_id: 1 }], 'esi-auth', TTL.characterData.fresh, TTL.characterData.stale)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const data = await esiAuthGet('/characters/123/industry/jobs/', 'token', { cacheKey: key })

    expect(data).toEqual([{ job_id: 1 }])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refetches stale cache and updates localStorage', async () => {
    const key = 'esi:jobs:123'
    const now = Date.now()
    localStorage.setItem(
      key,
      JSON.stringify({
        fetchedAt: now - 20 * 60 * 1000,
        expiresAt: now - 10 * 60 * 1000,
        maxStaleAt: now + 60 * 60 * 1000,
        payload: [{ job_id: 2 }],
        source: 'esi-auth',
      }),
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ job_id: 99 }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await esiAuthGet('/characters/123/industry/jobs/', 'token', { cacheKey: key })

    expect(data).toEqual([{ job_id: 99 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getCached(key)?.data).toEqual([{ job_id: 99 }])
  })

  it('falls back to stale cache on rate limit when force refreshing', async () => {
    const key = 'esi:jobs:123'
    const now = Date.now()
    localStorage.setItem(
      key,
      JSON.stringify({
        fetchedAt: now - 20 * 60 * 1000,
        expiresAt: now - 10 * 60 * 1000,
        maxStaleAt: now + 60 * 60 * 1000,
        payload: [{ job_id: 3 }],
        source: 'esi-auth',
      }),
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 420,
        headers: new Headers({ 'Retry-After': '60' }),
        json: async () => ({ error: 'Rate limit exceeded' }),
      }),
    )

    const data = await esiAuthGet('/characters/123/industry/jobs/', 'token', {
      cacheKey: key,
      forceRefresh: true,
    })

    expect(data).toEqual([{ job_id: 3 }])
  })

  it('updates cache after a successful fetch', async () => {
    const key = 'esi:jobs:123'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ job_id: 4 }],
      }),
    )

    const data = await esiAuthGet('/characters/123/industry/jobs/', 'token', { cacheKey: key })

    expect(data).toEqual([{ job_id: 4 }])
    expect(getCached(key)?.data).toEqual([{ job_id: 4 }])
  })
})

describe('esiAuthGetAllPages', () => {
  beforeEach(() => {
    installLocalStorage()
    vi.restoreAllMocks()
  })

  it('returns fresh paginated cache without calling fetch', async () => {
    const segment = 'esi:assets:123'
    setCached(
      `eveio:cache:esi-auth:${segment}:{"page":1}`,
      [{ item_id: 1 }],
      'esi-auth',
      TTL.characterData.fresh,
      TTL.characterData.stale,
    )
    setCached(
      `eveio:cache:esi-auth:${segment}:{"meta":"pages"}`,
      { totalPages: 1 },
      'esi-auth',
      TTL.characterData.fresh,
      TTL.characterData.stale,
    )

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const data = await esiAuthGetAllPages('/characters/123/assets/', 'token', segment)

    expect(data).toEqual([{ item_id: 1 }])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refetches stale paginated cache', async () => {
    const segment = 'esi:assets:123'
    const now = Date.now()
    const pageKey = `eveio:cache:esi-auth:${segment}:{"page":1}`
    localStorage.setItem(
      pageKey,
      JSON.stringify({
        fetchedAt: now - 20 * 60 * 1000,
        expiresAt: now - 10 * 60 * 1000,
        maxStaleAt: now + 60 * 60 * 1000,
        payload: [{ item_id: 2 }],
        source: 'esi-auth',
      }),
    )
    localStorage.setItem(
      `eveio:cache:esi-auth:${segment}:{"meta":"pages"}`,
      JSON.stringify({
        fetchedAt: now - 20 * 60 * 1000,
        expiresAt: now - 10 * 60 * 1000,
        maxStaleAt: now + 60 * 60 * 1000,
        payload: { totalPages: 1 },
        source: 'esi-auth',
      }),
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Pages': '1' }),
      json: async () => [{ item_id: 99 }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await esiAuthGetAllPages('/characters/123/assets/', 'token', segment)

    expect(data).toEqual([{ item_id: 99 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
