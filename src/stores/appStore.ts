import { create } from 'zustand'
import type { GlobalSettings, ManufacturingPlanTemplate, PlanRootEntry, UserData, WatchlistItem } from '@/types'
import {
  createDefaultPlanTemplate,
  createDefaultUserData,
  createPlanRootId,
  createPlanTemplateId,
  loadUserDataFromLocal,
  migratePlanTemplates,
  normalizeGlobalSettings,
  saveUserDataToLocal,
} from '@/services/sync/types'
import { mergeSharedSettingsForImport, sharedTemplateToSavedTemplate } from '@/lib/planShare'
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
  importSharedPlan: (
    template: ManufacturingPlanTemplate,
    settings: GlobalSettings,
  ) => ManufacturingPlanTemplate
  addRootToPlanTemplate: (templateId: string, root: PlanRootEntry) => void
  removeRootFromPlanTemplate: (templateId: string, rootId: string) => void
}

function touchTemplates(
  userData: UserData,
  updater: (templates: ManufacturingPlanTemplate[]) => ManufacturingPlanTemplate[],
): UserData {
  return {
    ...userData,
    planTemplates: migratePlanTemplates(updater(userData.planTemplates ?? [])),
    updatedAt: new Date().toISOString(),
  }
}

function resolveSelectedPlanTemplateId(
  templates: ManufacturingPlanTemplate[],
  preferredId: string | null | undefined,
): string | null {
  if (preferredId && templates.some((t) => t.id === preferredId)) return preferredId
  return templates[0]?.id ?? null
}

function persistSelectedPlanTemplateId(
  get: () => AppStore,
  set: (partial: Partial<AppStore>) => void,
  id: string | null,
) {
  const userData = {
    ...get().userData,
    selectedPlanTemplateId: id,
    updatedAt: new Date().toISOString(),
  }
  get().setUserData(userData)
  set({ selectedPlanTemplateId: id })
}

export const useAppStore = create<AppStore>((set, get) => ({
  userData: createDefaultUserData(),
  hydrated: false,
  selectedPlanTemplateId: null,

  hydrate: () => {
    const userData = loadUserDataFromLocal()
    const templates = userData.planTemplates ?? []
    const selectedPlanTemplateId = resolveSelectedPlanTemplateId(
      templates,
      userData.selectedPlanTemplateId,
    )
    set({ userData, hydrated: true, selectedPlanTemplateId })
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

  setSelectedPlanTemplateId: (id) => persistSelectedPlanTemplateId(get, set, id),

  addPlanTemplate: (name) => {
    const template = createDefaultPlanTemplate(name)
    const userData = touchTemplates(get().userData, (templates) => [...templates, template])
    get().setUserData(userData)
    persistSelectedPlanTemplateId(get, set, template.id)
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
      persistSelectedPlanTemplateId(
        get,
        set,
        resolveSelectedPlanTemplateId(userData.planTemplates, null),
      )
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
      roots: (source.roots ?? []).map((r) => ({ ...r, id: createPlanRootId() })),
      modeOverrides: { ...(source.modeOverrides ?? {}) },
      nodeOverrides: { ...(source.nodeOverrides ?? {}) },
    }
    const userData = touchTemplates(get().userData, (templates) => [...templates, copy])
    get().setUserData(userData)
    persistSelectedPlanTemplateId(get, set, copy.id)
    return copy
  },

  importSharedPlan: (template, settings) => {
    const saved = sharedTemplateToSavedTemplate(template)
    const userData = touchTemplates(get().userData, (templates) => [...templates, saved])
    get().setUserData({
      ...userData,
      settings: mergeSharedSettingsForImport(userData.settings, settings),
    })
    persistSelectedPlanTemplateId(get, set, saved.id)
    return saved
  },

  addRootToPlanTemplate: (templateId, root) => {
    const entry: PlanRootEntry = { ...root, id: root.id ?? createPlanRootId() }
    const userData = touchTemplates(get().userData, (templates) =>
      templates.map((t) => {
        if (t.id !== templateId) return t
        return {
          ...t,
          roots: [...(t.roots ?? []), entry],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
    get().setUserData(userData)
  },

  removeRootFromPlanTemplate: (templateId, rootId) => {
    const userData = touchTemplates(get().userData, (templates) =>
      templates.map((t) =>
        t.id === templateId
          ? {
              ...t,
              roots: (t.roots ?? []).filter((r) => r.id !== rootId),
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
    )
    get().setUserData(userData)
  },
}))
