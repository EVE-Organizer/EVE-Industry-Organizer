import { create } from 'zustand'

export type RefreshScope = 'characters' | 'prices-live' | 'static' | 'all'

export type SourceRefreshStatus =
  | 'loading'
  | 'updated'
  | 'unchanged'
  | 'not-yet-updated-by-esi'
  | 'failed'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface SourceStatus {
  id: string
  label: string
  status: SourceRefreshStatus
  checkedAt: number
  nextUpdateAt?: number
  error?: string
  detail?: string
  /** SSO character id when this row is per-character. */
  characterId?: number
}

export interface ToastItem {
  id: string
  text: string
  tone: ToastTone
  persistent?: boolean
}

export interface ChangedPrice {
  previous: number
  at: number
}

const EMPTY_REFRESHING: Record<RefreshScope, boolean> = {
  characters: false,
  'prices-live': false,
  static: false,
  all: false,
}

interface DataStatusStore {
  sources: Record<string, SourceStatus>
  refreshing: Record<RefreshScope, boolean>
  toasts: ToastItem[]
  changedPrices: Record<number, ChangedPrice>
  setSource: (status: SourceStatus) => void
  setSourcesLoading: (ids: string[], labelById?: Record<string, string>) => void
  setChangedPrices: (changes: { typeId: number; before: number }[]) => void
  beginRefresh: (scope: RefreshScope) => string
  endRefresh: (
    scope: RefreshScope,
    loadingToastId: string,
    summary: { parts: string[]; statuses: SourceRefreshStatus[] },
  ) => void
  pushToast: (text: string, opts?: { tone?: ToastTone; persistent?: boolean }) => string
  dismissToast: (id: string) => void
}

let toastSeq = 0

/** Worst status wins for the summary toast tone. */
export function worstSourceStatus(statuses: SourceRefreshStatus[]): ToastTone {
  if (statuses.some((s) => s === 'failed')) return 'error'
  if (statuses.some((s) => s === 'not-yet-updated-by-esi')) return 'warning'
  if (statuses.some((s) => s === 'updated')) return 'success'
  return 'info'
}

export const useDataStatusStore = create<DataStatusStore>((set, get) => ({
  sources: {},
  refreshing: { ...EMPTY_REFRESHING },
  toasts: [],
  changedPrices: {},

  setSource: (status) => set((state) => ({ sources: { ...state.sources, [status.id]: status } })),

  setSourcesLoading: (ids, labelById) => {
    const now = Date.now()
    set((state) => {
      const sources = { ...state.sources }
      for (const id of ids) {
        const prev = sources[id]
        sources[id] = {
          id,
          label: labelById?.[id] ?? prev?.label ?? id,
          status: 'loading',
          checkedAt: now,
          characterId: prev?.characterId,
        }
      }
      return { sources }
    })
  },

  setChangedPrices: (changes) => {
    const at = Date.now()
    set({
      changedPrices: Object.fromEntries(changes.map((c) => [c.typeId, { previous: c.before, at }])),
    })
  },

  beginRefresh: (scope) => {
    const id = `toast-${++toastSeq}`
    set((state) => ({
      refreshing: { ...state.refreshing, [scope]: true },
      toasts: [...state.toasts, { id, text: 'Refreshing…', tone: 'info', persistent: true }],
    }))
    return id
  },

  endRefresh: (scope, loadingToastId, summary) => {
    const tone = worstSourceStatus(summary.statuses.length ? summary.statuses : ['unchanged'])
    set((state) => ({
      refreshing: { ...state.refreshing, [scope]: false },
      toasts: state.toasts.filter((t) => t.id !== loadingToastId),
    }))
    const text = summary.parts.length ? `Refreshed · ${summary.parts.join(' · ')}` : 'Refreshed'
    get().pushToast(text, { tone })
  },

  pushToast: (text, opts) => {
    const id = `toast-${++toastSeq}`
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id,
          text,
          tone: opts?.tone ?? 'info',
          persistent: opts?.persistent,
        },
      ],
    }))
    return id
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
