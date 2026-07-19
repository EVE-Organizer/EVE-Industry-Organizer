import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadRecentItemSearchIds,
  MAX_RECENT_ITEM_SEARCHES,
  recordRecentItemSearch,
} from '@/lib/recentItemSearch'

describe('recentItemSearch', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores up to five unique ids with most recent first', () => {
    for (let id = 1; id <= 6; id++) {
      recordRecentItemSearch(id)
    }
    expect(loadRecentItemSearchIds()).toEqual([6, 5, 4, 3, 2])
    expect(loadRecentItemSearchIds()).toHaveLength(MAX_RECENT_ITEM_SEARCHES)
  })

  it('moves an existing id to the front', () => {
    recordRecentItemSearch(10)
    recordRecentItemSearch(20)
    recordRecentItemSearch(30)
    recordRecentItemSearch(10)
    expect(loadRecentItemSearchIds()).toEqual([10, 30, 20])
  })
})
