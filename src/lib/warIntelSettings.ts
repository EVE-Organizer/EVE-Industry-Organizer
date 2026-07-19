import {
  DEFAULT_WAR_INTEL_ANCHOR,
  DEFAULT_WAR_INTEL_RADIUS,
  DEFAULT_WAR_INTEL_WINDOW,
  WAR_INTEL_RADIUS_OPTIONS,
  WAR_INTEL_WINDOW_OPTIONS,
  type WarIntelAnchor,
  type WarIntelRadius,
  type WarIntelWindow,
} from '@/types/map'

const STORAGE_KEY = 'eveio:warIntelSettings'

export interface WarIntelSettings {
  anchor: WarIntelAnchor
  radius: WarIntelRadius
  window: WarIntelWindow
  /** Last map center used when anchor is mapCenter (war scan origin). */
  mapCenterSystemId: number | null
}

export const DEFAULT_WAR_INTEL_SETTINGS: WarIntelSettings = {
  anchor: DEFAULT_WAR_INTEL_ANCHOR,
  radius: DEFAULT_WAR_INTEL_RADIUS,
  window: DEFAULT_WAR_INTEL_WINDOW,
  mapCenterSystemId: null,
}

function isWarIntelAnchor(value: unknown): value is WarIntelAnchor {
  return value === 'factory' || value === 'mapCenter'
}

function isWarIntelRadius(value: unknown): value is WarIntelRadius {
  return (
    typeof value === 'number' &&
    (WAR_INTEL_RADIUS_OPTIONS as readonly number[]).includes(value)
  )
}

function isWarIntelWindow(value: unknown): value is WarIntelWindow {
  return (
    typeof value === 'string' &&
    (WAR_INTEL_WINDOW_OPTIONS as readonly string[]).includes(value)
  )
}

function parseMapCenterSystemId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function loadWarIntelSettings(): WarIntelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WAR_INTEL_SETTINGS }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_WAR_INTEL_SETTINGS }

    const record = parsed as Record<string, unknown>
    return {
      anchor: isWarIntelAnchor(record.anchor)
        ? record.anchor
        : DEFAULT_WAR_INTEL_SETTINGS.anchor,
      radius: isWarIntelRadius(record.radius)
        ? record.radius
        : DEFAULT_WAR_INTEL_SETTINGS.radius,
      window: isWarIntelWindow(record.window)
        ? record.window
        : DEFAULT_WAR_INTEL_SETTINGS.window,
      mapCenterSystemId: parseMapCenterSystemId(record.mapCenterSystemId),
    }
  } catch {
    return { ...DEFAULT_WAR_INTEL_SETTINGS }
  }
}

export function saveWarIntelSettings(settings: WarIntelSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage full or unavailable
  }
}
