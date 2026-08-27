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
 * Budget, ranking time, and min volume are held in local state for immediate visual
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

  const urlQuery = useMemo(
    () => searchParamsToQuery(searchParams, settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, settings.primaryHub, settings.manufacturingSystemId, settings.priceMethod],
  )

  const [localMinSlider, setLocalMinSlider] = useState(urlQuery.budgetMinSlider)
  const [localMaxSlider, setLocalMaxSlider] = useState(urlQuery.budgetMaxSlider)
  const [localRankingTimeHours, setLocalRankingTimeHours] = useState(urlQuery.rankingTimeHours)
  const [localMinVolume, setLocalMinVolume] = useState(urlQuery.minVolume)

  const minSliderRef = useRef(localMinSlider)
  const maxSliderRef = useRef(localMaxSlider)
  const rankingTimeHoursRef = useRef(localRankingTimeHours)
  const minVolumeRef = useRef(localMinVolume)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef(settings)
  const urlQueryRef = useRef(urlQuery)

  useEffect(() => { minSliderRef.current = localMinSlider }, [localMinSlider])
  useEffect(() => { maxSliderRef.current = localMaxSlider }, [localMaxSlider])
  useEffect(() => { rankingTimeHoursRef.current = localRankingTimeHours }, [localRankingTimeHours])
  useEffect(() => { minVolumeRef.current = localMinVolume }, [localMinVolume])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { urlQueryRef.current = urlQuery }, [urlQuery])

  const prevSearchParams = useRef(searchParams)
  useEffect(() => {
    if (prevSearchParams.current !== searchParams) {
      prevSearchParams.current = searchParams
      setLocalMinSlider(urlQuery.budgetMinSlider)
      setLocalMaxSlider(urlQuery.budgetMaxSlider)
      setLocalRankingTimeHours(urlQuery.rankingTimeHours)
      setLocalMinVolume(urlQuery.minVolume)
    }
  }, [
    searchParams,
    urlQuery.budgetMinSlider,
    urlQuery.budgetMaxSlider,
    urlQuery.rankingTimeHours,
    urlQuery.minVolume,
  ])

  const query = useMemo<BlueprintQuery>(
    () => ({
      ...urlQuery,
      budgetMinSlider: localMinSlider,
      budgetMaxSlider: localMaxSlider,
      rankingTimeHours: localRankingTimeHours,
      minVolume: localMinVolume,
    }),
    [urlQuery, localMinSlider, localMaxSlider, localRankingTimeHours, localMinVolume],
  )

  const commitDeferredToUrl = useCallback(
    (effectivePatch: Partial<BlueprintQuery>) => {
      const merged: BlueprintQuery = {
        ...urlQueryRef.current,
        ...effectivePatch,
        budgetMinSlider: minSliderRef.current,
        budgetMaxSlider: maxSliderRef.current,
        rankingTimeHours: rankingTimeHoursRef.current,
        minVolume: minVolumeRef.current,
      }
      setSearchParams(queryToSearchParams(merged, settingsRef.current), { replace: true })
    },
    [setSearchParams],
  )

  const DEFERRED_QUERY_KEYS = [
    'budgetMinSlider',
    'budgetMaxSlider',
    'rankingTimeHours',
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
      if ('rankingTimeHours' in patch) setLocalRankingTimeHours(patch.rankingTimeHours!)
      if ('minVolume' in patch) setLocalMinVolume(patch.minVolume!)

      if ('hub' in patch || 'mfgSystem' in patch) {
        const s: Parameters<typeof updateSettings>[0] = {}
        if (patch.hub) {
          s.primaryHub = patch.hub
          if (!('mfgSystem' in patch) && settingsRef.current.productionLocationId == null) {
            const hub = HUBS.find((h) => h.id === patch.hub)
            if (hub) s.manufacturingSystemId = hub.buildSystemId
          }
        }
        if (patch.mfgSystem !== undefined) s.manufacturingSystemId = patch.mfgSystem
        updateSettings(s)
      }

      const effectivePatch: Partial<BlueprintQuery> =
        'tiers' in patch && !('groups' in patch) ? { ...patch, groups: [] } : patch

      if (hasOther) {
        const merged: BlueprintQuery = {
          ...urlQueryRef.current,
          budgetMinSlider: minSliderRef.current,
          budgetMaxSlider: maxSliderRef.current,
          rankingTimeHours: rankingTimeHoursRef.current,
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
