const STORAGE_KEY = 'eveio:recentItemSearch'
export const MAX_RECENT_ITEM_SEARCHES = 5

export function loadRecentItemSearchIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
      .slice(0, MAX_RECENT_ITEM_SEARCHES)
  } catch {
    return []
  }
}

/** Most recent first; returns the updated list. */
export function recordRecentItemSearch(typeId: number): number[] {
  const prev = loadRecentItemSearchIds().filter((id) => id !== typeId)
  const next = [typeId, ...prev].slice(0, MAX_RECENT_ITEM_SEARCHES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
