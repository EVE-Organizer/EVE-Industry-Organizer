import { create } from 'zustand'
import type { GlobalSettings, UserData, WatchlistItem } from '@/types'
import {
  createDefaultUserData,
  loadUserDataFromLocal,
  normalizeGlobalSettings,
  saveUserDataToLocal,
} from '@/services/sync/types'
import { clearPriceCache as clearPriceCacheStorage } from '@/services/cache/cacheStore'

interface AppStore {
  userData: UserData
  hydrated: boolean
  hydrate: () => void
  setUserData: (data: UserData) => void
  updateSettings: (settings: Partial<GlobalSettings>) => void
  toggleWatchlist: (productTypeId: number) => void
  resetAll: () => void
  clearPriceCache: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  userData: createDefaultUserData(),
  hydrated: false,

  hydrate: () => {
    set({ userData: loadUserDataFromLocal(), hydrated: true })
  },

  setUserData: (data) => {
    saveUserDataToLocal(data)
    set({ userData: data })
  },

  updateSettings: (settings) => {
    const userData = {
      ...get().userData,
      settings: normalizeGlobalSettings({ ...get().userData.settings, ...settings }),
      updatedAt: new Date().toISOString(),
    }
    get().setUserData(userData)
  },

  toggleWatchlist: (productTypeId) => {
    const exists = get().userData.watchlist.some((w) => w.productTypeId === productTypeId)
    const watchlist: WatchlistItem[] = exists
      ? get().userData.watchlist.filter((w) => w.productTypeId !== productTypeId)
      : [...get().userData.watchlist, { productTypeId, addedAt: new Date().toISOString() }]
    get().setUserData({ ...get().userData, watchlist, updatedAt: new Date().toISOString() })
  },

  resetAll: () => {
    const fresh = createDefaultUserData()
    saveUserDataToLocal(fresh)
    set({ userData: fresh })
  },

  clearPriceCache: () => {
    clearPriceCacheStorage()
  },
}))
