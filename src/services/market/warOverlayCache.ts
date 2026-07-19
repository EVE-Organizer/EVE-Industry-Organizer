import type { WarActivityResult, WarTheater, WarIntelAnchor, WarIntelWindow } from '@/types/map'
import type { HubId } from '@/types'
import { WAR_INTEL_RADIUS_OPTIONS } from '@/types/map'
import type { KillmailDetails, ZkillKillRef } from '@/services/market/zkillService'
import { cacheKey, getCached, setCached, TTL } from '@/services/cache/cacheStore'

export interface WarOverlayPayload {
  warResults: WarActivityResult[]
  warTheaters: WarTheater[]
  killsFetchedAt: number
  /** Raw zKill refs per system for incremental gap refresh. */
  refsBySystem?: Record<number, ZkillKillRef[]>
  /** @deprecated ESI enrich happens on modal open; kept for old cache entries. */
  killDetailsById?: Record<number, KillmailDetails>
}

export interface WarOverlayCacheParams {
  scanSystemId: number
  radius: number
  window: WarIntelWindow
  sellHubId: HubId
  manufacturingSystemId: number
}

export function buildWarOverlayCacheParams(input: {
  warIntelAnchor: WarIntelAnchor
  manufacturingSystemId: number
  centerSystemId: number
  warIntelRadius: number
  warIntelWindow: WarIntelWindow
  sellHubId: HubId
}): WarOverlayCacheParams {
  const scanSystemId =
    input.warIntelAnchor === 'factory' && input.manufacturingSystemId
      ? input.manufacturingSystemId
      : input.centerSystemId
  return {
    scanSystemId,
    radius: input.warIntelRadius,
    window: input.warIntelWindow,
    sellHubId: input.sellHubId,
    manufacturingSystemId: input.manufacturingSystemId,
  }
}

function overlayKey(params: WarOverlayCacheParams): string {
  return cacheKey('war', 'overlay', { ...params })
}

export function getWarOverlayCached(
  params: WarOverlayCacheParams,
): { data: WarOverlayPayload; stale: boolean; fetchedAt: number } | null {
  return getCached<WarOverlayPayload>(overlayKey(params))
}

/**
 * When widening scan radius, reuse the largest cached overlay from a smaller radius
 * so inner-ring intel stays visible while the outer ring is fetched.
 */
export function getWarOverlaySeedFromSmallerRadius(
  params: WarOverlayCacheParams,
): { data: WarOverlayPayload; stale: boolean; fetchedAt: number } | null {
  const smallerRadii = WAR_INTEL_RADIUS_OPTIONS.filter((r) => r < params.radius).sort(
    (a, b) => b - a,
  )
  for (const radius of smallerRadii) {
    const cached = getWarOverlayCached({ ...params, radius })
    if (cached) return cached
  }
  return null
}

/** Exact cache for this radius, or the best smaller-radius cache as a seed. */
export function getWarOverlayBase(
  params: WarOverlayCacheParams,
): {
  overlay: { data: WarOverlayPayload; stale: boolean; fetchedAt: number }
  exact: boolean
} | null {
  const exact = getWarOverlayCached(params)
  if (exact) return { overlay: exact, exact: true }
  const seed = getWarOverlaySeedFromSmallerRadius(params)
  if (seed) return { overlay: seed, exact: false }
  return null
}

/** Gap-refresh only after the fresh TTL (10 min); manual refresh always refetches. */
export function shouldRefreshWarOverlay(cached: { stale: boolean } | null): boolean {
  if (!cached) return true
  return cached.stale
}

export function setWarOverlayCached(params: WarOverlayCacheParams, payload: WarOverlayPayload): void {
  try {
    setCached(
      overlayKey(params),
      payload,
      'war',
      TTL.warOverlay.fresh,
      TTL.warOverlay.stale,
    )
  } catch {
    // localStorage full or unavailable; skip persisting overlay
  }
}

function emptyOverlayState(): {
  warResults: WarActivityResult[]
  warTheaters: WarTheater[]
  killsFetchedAt: number | null
  warLoading: boolean
} {
  return {
    warResults: [],
    warTheaters: [],
    killsFetchedAt: null,
    warLoading: false,
  }
}

export function initialWarOverlayState(params: WarOverlayCacheParams): {
  warResults: WarActivityResult[]
  warTheaters: WarTheater[]
  killsFetchedAt: number | null
  warLoading: boolean
} {
  const base = getWarOverlayBase(params)
  if (!base) {
    return { ...emptyOverlayState(), warLoading: true }
  }
  return {
    warResults: base.overlay.data.warResults,
    warTheaters: base.overlay.data.warTheaters,
    killsFetchedAt: base.overlay.data.killsFetchedAt,
    warLoading: !base.exact,
  }
}
