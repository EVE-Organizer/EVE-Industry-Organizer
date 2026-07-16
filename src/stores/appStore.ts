import { create } from 'zustand'
import type { GlobalSettings, ManufacturingPlanTemplate, PlanRootEntry, UserData, WatchlistItem } from '@/types'
import {
  createDefaultPlanTemplate,
  createDefaultUserData,
  createPlanTemplateId,
  loadUserDataFromLocal,
  normalizeGlobalSettings,
  saveUserDataToLocal,
} from '@/services/sync/types'
import { clearPriceCache as clearPriceCacheStorage } from '@/services/cache/cacheStore'

interface AppStore {
  userData: UserData
  hydrated: boolean
  selectedPlanTemplateId: string | null
  hydrate: () => void
  setUserData: (data: UserData) => void
  updateSettings: (settings: Partial<GlobalSettings>) => void
  toggleWatchlist: (productTypeId: number) => void
  resetAll: () => void
  clearPriceCache: () => void
  setSelectedPlanTemplateId: (id: string | null) => void
  addPlanTemplate: (name?: string) => ManufacturingPlanTemplate
  updatePlanTemplate: (id: string, patch: Partial<ManufacturingPlanTemplate>) => void
  deletePlanTemplate: (id: string) => void
  duplicatePlanTemplate: (id: string) => ManufacturingPlanTemplate | null
  addRootToPlanTemplate: (templateId: string, root: PlanRootEntry) => void
  removeRootFromPlanTemplate: (templateId: string, productTypeId: number) => void
}

function touchTemplates(
  userData: UserData,
  updater: (templates: ManufacturingPlanTemplate[]) => ManufacturingPlanTemplate[],
): UserData {
  return {
    ...userData,
    planTemplates: updater(userData.planTemplates ?? []),
    updatedAt: new Date().toISOString(),
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  userData: createDefaultUserData(),
  hydrated: false,
  selectedPlanTemplateId: null,

  hydrate: () => {
    const userData = loadUserDataFromLocal()
    const firstId = userData.planTemplates?.[0]?.id ?? null
    set({ userData, hydrated: true, selectedPlanTemplateId: firstId })
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
    set({ userData: fresh, selectedPlanTemplateId: null })
  },

  clearPriceCache: () => {
    clearPriceCacheStorage()
  },

  setSelectedPlanTemplateId: (id) => set({ selectedPlanTemplateId: id }),

  addPlanTemplate: (name) => {
    const template = createDefaultPlanTemplate(name)
    const userData = touchTemplates(get().userData, (templates) => [...templates, template])
    get().setUserData(userData)
    set({ selectedPlanTemplateId: template.id })
    return template
  },

  updatePlanTemplate: (id, patch) => {
    const userData = touchTemplates(get().userData, (templates) =>
      templates.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    )
    get().setUserData(userData)
  },

  deletePlanTemplate: (id) => {
    const userData = touchTemplates(get().userData, (templates) => templates.filter((t) => t.id !== id))
    get().setUserData(userData)
    if (get().selectedPlanTemplateId === id) {
      set({ selectedPlanTemplateId: userData.planTemplates[0]?.id ?? null })
    }
  },

  duplicatePlanTemplate: (id) => {
    const source = get().userData.planTemplates.find((t) => t.id === id)
    if (!source) return null
    const now = new Date().toISOString()
    const copy: ManufacturingPlanTemplate = {
      ...source,
      id: createPlanTemplateId(),
      name: `${source.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      roots: source.roots.map((r) => ({ ...r })),
      modeOverrides: { ...source.modeOverrides },
      nodeOverrides: { ...source.nodeOverrides },
    }
    const userData = touchTemplates(get().userData, (templates) => [...templates, copy])
    get().setUserData(userData)
    set({ selectedPlanTemplateId: copy.id })
    return copy
  },

  addRootToPlanTemplate: (templateId, root) => {
    const userData = touchTemplates(get().userData, (templates) =>
      templates.map((t) => {
        if (t.id !== templateId) return t
        if (t.roots.some((r) => r.productTypeId === root.productTypeId)) return t
        return {
          ...t,
          roots: [...t.roots, root],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
    get().setUserData(userData)
  },

  removeRootFromPlanTemplate: (templateId, productTypeId) => {
    const userData = touchTemplates(get().userData, (templates) =>
      templates.map((t) =>
        t.id === templateId
          ? {
              ...t,
              roots: t.roots.filter((r) => r.productTypeId !== productTypeId),
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
    )
    get().setUserData(userData)
  },
}))
