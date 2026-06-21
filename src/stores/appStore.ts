import { create } from 'zustand'
import type {
  CharacterAccount,
  GlobalSettings,
  SyncStatus,
  UserData,
  WatchlistItem,
} from '@/types'
import {
  createDefaultUserData,
  exportUserDataJson,
  importUserDataJson,
  loadUserDataFromLocal,
  mergeUserData,
  saveUserDataToLocal,
} from '@/services/sync/types'
import {
  downloadUserData,
  initGoogleSignIn,
  isGoogleConfigured,
  signOutGoogle as googleSignOut,
  uploadUserData,
} from '@/services/sync/googleDrive'
import { clearPriceCache as clearPriceCacheStorage } from '@/services/cache/cacheStore'

interface AppStore {
  userData: UserData
  syncStatus: SyncStatus
  hydrated: boolean
  hydrate: () => void
  setUserData: (data: UserData, skipSync?: boolean) => void
  updateSettings: (settings: Partial<GlobalSettings>) => void
  completeOnboarding: (settings: GlobalSettings, character: CharacterAccount) => void
  addAccount: (account: CharacterAccount) => void
  updateAccount: (id: string, patch: Partial<CharacterAccount>) => void
  removeAccount: (id: string) => void
  toggleWatchlist: (productTypeId: number) => void
  setSkillProgress: (accountId: string, skillKey: string, level: number) => void
  resetAll: () => void
  exportJson: () => string
  importJson: (json: string) => void
  signInGoogle: () => void
  signOutGoogle: () => void
  syncNow: () => Promise<void>
  clearPriceCache: () => void
}

let uploadTimer: ReturnType<typeof setTimeout> | null = null

function scheduleUpload(get: () => AppStore) {
  if (get().syncStatus.mode !== 'drive') return
  if (uploadTimer) clearTimeout(uploadTimer)
  uploadTimer = setTimeout(async () => {
    try {
      get().syncStatus = { ...get().syncStatus, state: 'syncing' }
      await uploadUserData(get().userData)
      get().syncStatus = {
        mode: 'drive',
        state: 'synced',
        lastSyncedAt: new Date().toISOString(),
      }
    } catch (e) {
      get().syncStatus = {
        mode: 'drive',
        state: 'error',
        lastSyncedAt: get().syncStatus.lastSyncedAt,
        message: e instanceof Error ? e.message : 'Sync failed',
      }
    }
  }, 2000)
}

export const useAppStore = create<AppStore>((set, get) => ({
  userData: createDefaultUserData(),
  syncStatus: { mode: 'local', state: 'synced', lastSyncedAt: null },
  hydrated: false,

  hydrate: () => {
    const local = loadUserDataFromLocal()
    set({ userData: local, hydrated: true })
    if (isGoogleConfigured()) {
      initGoogleSignIn(async () => {
        set({ syncStatus: { mode: 'drive', state: 'syncing', lastSyncedAt: null } })
        try {
          const remote = await downloadUserData()
          if (remote) {
            const merged = mergeUserData(get().userData, remote)
            saveUserDataToLocal(merged)
            set({
              userData: merged,
              syncStatus: { mode: 'drive', state: 'synced', lastSyncedAt: new Date().toISOString() },
            })
          } else {
            await uploadUserData(get().userData)
            set({
              syncStatus: { mode: 'drive', state: 'synced', lastSyncedAt: new Date().toISOString() },
            })
          }
        } catch {
          set({
            syncStatus: {
              mode: 'drive',
              state: 'offline',
              lastSyncedAt: null,
              message: 'Using local cache',
            },
          })
        }
      })
    }
  },

  setUserData: (data, skipSync) => {
    saveUserDataToLocal(data)
    set({ userData: data })
    if (!skipSync) scheduleUpload(get)
  },

  updateSettings: (settings) => {
    const userData = {
      ...get().userData,
      settings: { ...get().userData.settings, ...settings },
      updatedAt: new Date().toISOString(),
    }
    get().setUserData(userData)
  },

  completeOnboarding: (settings, character) => {
    get().setUserData({
      ...get().userData,
      onboardingComplete: true,
      settings,
      accounts: [character],
      updatedAt: new Date().toISOString(),
    })
  },

  addAccount: (account) => {
    get().setUserData({
      ...get().userData,
      accounts: [...get().userData.accounts, account],
      updatedAt: new Date().toISOString(),
    })
  },

  updateAccount: (id, patch) => {
    get().setUserData({
      ...get().userData,
      accounts: get().userData.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      updatedAt: new Date().toISOString(),
    })
  },

  removeAccount: (id) => {
    get().setUserData({
      ...get().userData,
      accounts: get().userData.accounts.filter((a) => a.id !== id),
      updatedAt: new Date().toISOString(),
    })
  },

  toggleWatchlist: (productTypeId) => {
    const exists = get().userData.watchlist.some((w) => w.productTypeId === productTypeId)
    const watchlist: WatchlistItem[] = exists
      ? get().userData.watchlist.filter((w) => w.productTypeId !== productTypeId)
      : [...get().userData.watchlist, { productTypeId, addedAt: new Date().toISOString() }]
    get().setUserData({ ...get().userData, watchlist, updatedAt: new Date().toISOString() })
  },

  setSkillProgress: (accountId, skillKey, level) => {
    get().setUserData({
      ...get().userData,
      accounts: get().userData.accounts.map((a) =>
        a.id === accountId
          ? { ...a, skills: { ...a.skills, [skillKey]: level }, skillProgress: { ...a.skillProgress, [skillKey]: level } }
          : a,
      ),
      updatedAt: new Date().toISOString(),
    })
  },

  resetAll: () => {
    const fresh = createDefaultUserData()
    saveUserDataToLocal(fresh)
    set({ userData: fresh })
    scheduleUpload(get)
  },

  exportJson: () => exportUserDataJson(get().userData),

  importJson: (json) => {
    get().setUserData(importUserDataJson(json))
  },

  signInGoogle: () => {
    const fn = (window as unknown as { __eveGoogleSignIn?: () => void }).__eveGoogleSignIn
    if (fn) fn()
    else if (isGoogleConfigured()) initGoogleSignIn(() => get().syncNow())
  },

  signOutGoogle: () => {
    googleSignOut()
    set({ syncStatus: { mode: 'local', state: 'synced', lastSyncedAt: get().syncStatus.lastSyncedAt } })
  },

  syncNow: async () => {
    if (!navigator.onLine) {
      set({ syncStatus: { mode: 'drive', state: 'offline', lastSyncedAt: get().syncStatus.lastSyncedAt } })
      return
    }
    set({ syncStatus: { ...get().syncStatus, state: 'syncing' } })
    try {
      const remote = await downloadUserData()
      if (remote) {
        const merged = mergeUserData(get().userData, remote)
        saveUserDataToLocal(merged)
        set({ userData: merged })
      }
      await uploadUserData(get().userData)
      set({
        syncStatus: { mode: 'drive', state: 'synced', lastSyncedAt: new Date().toISOString() },
      })
    } catch (e) {
      set({
        syncStatus: {
          mode: get().syncStatus.mode,
          state: 'error',
          lastSyncedAt: get().syncStatus.lastSyncedAt,
          message: e instanceof Error ? e.message : 'Sync failed',
        },
      })
    }
  },

  clearPriceCache: () => {
    clearPriceCacheStorage()
  },
}))
