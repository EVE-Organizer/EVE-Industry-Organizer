import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { HUBS } from '@/types'
import {
  queryToSearchParams,
  searchParamsToQuery,
  type BlueprintQuery,
} from '@/lib/blueprintQuery'

const SLIDER_DEBOUNCE_MS = 400

/**
 * Syncs all Top Blueprints filter state to the URL via useSearchParams.
 *
 * Budget, batch size, and min volume are held in local state for immediate visual
 * feedback and debounced before writing to the URL so dragging does not flood the
 * router. All other filter writes hit the URL immediately with replace:true so the
 * back button is not flooded.
 *
 * Hub and Mfg system are also mirrored to Zustand settings so they persist
 * as defaults after the URL params are cleared.
 */
export function useBlueprintQuery(): {
  query: BlueprintQuery
  setQuery: (patch: Partial<BlueprintQuery>) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const settings = useAppStore((s) => s.userData.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  // Derive the non-slider portion of the query from the URL.
  const urlQuery = useMemo(
    () => searchParamsToQuery(searchParams, settings),
    // Only re-derive when URL or the settings-sourced defaults change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, settings.primaryHub, settings.manufacturingSystemId, settings.priceMethod],
  )

  // Local slider state for immediate thumb feedback (no lag while dragging).
  const [localMinSlider, setLocalMinSlider] = useState(urlQuery.budgetMinSlider)
  const [localMaxSlider, setLocalMaxSlider] = useState(urlQuery.budgetMaxSlider)
  const [localBatchSize, setLocalBatchSize] = useState(urlQuery.batchSize)
  const [localMinVolume, setLocalMinVolume] = useState(urlQuery.minVolume)

  // Refs always hold the latest deferred values so the debounce callback can read them.
  // Updated via useEffect (not during render) to satisfy the react-hooks/refs lint rule.
  const minSliderRef = useRef(localMinSlider)
  const maxSliderRef = useRef(localMaxSlider)
  const batchSizeRef = useRef(localBatchSize)
  const minVolumeRef = useRef(localMinVolume)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef(settings)
  const urlQueryRef = useRef(urlQuery)

  useEffect(() => { minSliderRef.current = localMinSlider }, [localMinSlider])
  useEffect(() => { maxSliderRef.current = localMaxSlider }, [localMaxSlider])
  useEffect(() => { batchSizeRef.current = localBatchSize }, [localBatchSize])
  useEffect(() => { minVolumeRef.current = localMinVolume }, [localMinVolume])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { urlQueryRef.current = urlQuery }, [urlQuery])

  // When URL changes externally (back/forward nav), sync local slider state.
  const prevSearchParams = useRef(searchParams)
  useEffect(() => {
    if (prevSearchParams.current !== searchParams) {
      prevSearchParams.current = searchParams
      setLocalMinSlider(urlQuery.budgetMinSlider)
      setLocalMaxSlider(urlQuery.budgetMaxSlider)
      setLocalBatchSize(urlQuery.batchSize)
      setLocalMinVolume(urlQuery.minVolume)
    }
  }, [searchParams, urlQuery.budgetMinSlider, urlQuery.budgetMaxSlider, urlQuery.batchSize, urlQuery.minVolume])

  // Expose live slider positions on top of the URL-derived query.
  const query = useMemo<BlueprintQuery>(
    () => ({
      ...urlQuery,
      budgetMinSlider: localMinSlider,
      budgetMaxSlider: localMaxSlider,
      batchSize: localBatchSize,
      minVolume: localMinVolume,
    }),
    [urlQuery, localMinSlider, localMaxSlider, localBatchSize, localMinVolume],
  )

  const commitDeferredToUrl = useCallback(
    (effectivePatch: Partial<BlueprintQuery>) => {
      const merged: BlueprintQuery = {
        ...urlQueryRef.current,
        ...effectivePatch,
        budgetMinSlider: minSliderRef.current,
        budgetMaxSlider: maxSliderRef.current,
        batchSize: batchSizeRef.current,
        minVolume: minVolumeRef.current,
      }
      setSearchParams(queryToSearchParams(merged, settingsRef.current), { replace: true })
    },
    [setSearchParams],
  )

  const DEFERRED_QUERY_KEYS = [
    'budgetMinSlider',
    'budgetMaxSlider',
    'batchSize',
    'minVolume',
  ] as const satisfies readonly (keyof BlueprintQuery)[]

  const setQuery = useCallback(
    (patch: Partial<BlueprintQuery>) => {
      const hasDeferred = DEFERRED_QUERY_KEYS.some((key) => key in patch)
      const hasOther = Object.keys(patch).some(
        (k) => !DEFERRED_QUERY_KEYS.includes(k as (typeof DEFERRED_QUERY_KEYS)[number]),
      )

      if ('budgetMinSlider' in patch) setLocalMinSlider(patch.budgetMinSlider!)
      if ('budgetMaxSlider' in patch) setLocalMaxSlider(patch.budgetMaxSlider!)
      if ('batchSize' in patch) setLocalBatchSize(patch.batchSize!)
      if ('minVolume' in patch) setLocalMinVolume(patch.minVolume!)

      // Persist hub/mfg system to settings so they become the next defaults.
      if ('hub' in patch || 'mfgSystem' in patch) {
        const s: Parameters<typeof updateSettings>[0] = {}
        if (patch.hub) {
          s.primaryHub = patch.hub
          if (!('mfgSystem' in patch)) {
            const hub = HUBS.find((h) => h.id === patch.hub)
            if (hub) s.manufacturingSystemId = hub.buildSystemId
          }
        }
        if (patch.mfgSystem !== undefined) s.manufacturingSystemId = patch.mfgSystem
        updateSettings(s)
      }

      // Tier change always resets group.
      const effectivePatch: Partial<BlueprintQuery> =
        'tiers' in patch && !('groups' in patch) ? { ...patch, groups: [] } : patch

      if (hasOther) {
        const merged: BlueprintQuery = {
          ...urlQueryRef.current,
          budgetMinSlider: minSliderRef.current,
          budgetMaxSlider: maxSliderRef.current,
          batchSize: batchSizeRef.current,
          minVolume: minVolumeRef.current,
          ...effectivePatch,
        }
        setSearchParams(queryToSearchParams(merged, settingsRef.current), { replace: true })
      }

      if (hasDeferred) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          commitDeferredToUrl(effectivePatch)
        }, SLIDER_DEBOUNCE_MS)
      }
    },
    [setSearchParams, updateSettings, commitDeferredToUrl],
  )

  return { query, setQuery }
}

