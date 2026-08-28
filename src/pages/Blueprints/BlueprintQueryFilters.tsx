import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { buildProductGroupTree, buildTypeMap, type SdeData } from '@/services/data/sdeLoader'
import { BlueprintFilterBar } from '@/pages/Blueprints/BlueprintFilterBar'
import { useBlueprintQuery } from '@/pages/Blueprints/useBlueprintQuery'
import { useDebouncedValue } from '@/pages/Blueprints/useDebouncedValue'
import type { BlueprintQuery } from '@/lib/blueprintQuery'
import { DEFAULT_RECIPE_KINDS } from '@/types'

const SLIDER_DEBOUNCE_MS = 1000

export interface BlueprintQueryFiltersHandle {
  setQuery: (patch: Partial<BlueprintQuery>) => void
}

interface BlueprintQueryFiltersProps {
  sde: SdeData | undefined
  resultCount: number
  rankingDeferPending?: boolean
  onRankingQueryChange: (query: BlueprintQuery) => void
}

function deferredRankingSnapshot(query: BlueprintQuery): string {
  return JSON.stringify({
    budgetMinSlider: query.budgetMinSlider,
    budgetMaxSlider: query.budgetMaxSlider,
    rankingTimeHours: query.rankingTimeHours,
    minVolume: query.minVolume,
  })
}

function immediateRankingQuery(
  query: BlueprintQuery,
): Omit<BlueprintQuery, 'budgetMinSlider' | 'budgetMaxSlider' | 'rankingTimeHours' | 'minVolume'> {
  const {
    budgetMinSlider: _budgetMinSlider,
    budgetMaxSlider: _budgetMaxSlider,
    rankingTimeHours: _rankingTimeHours,
    minVolume: _minVolume,
    ...rest
  } = query
  return rest
}

export const BlueprintQueryFilters = forwardRef<
  BlueprintQueryFiltersHandle,
  BlueprintQueryFiltersProps
>(function BlueprintQueryFilters(
  { sde, resultCount, rankingDeferPending = false, onRankingQueryChange },
  ref,
) {
  const { query, setQuery } = useBlueprintQuery()

  useImperativeHandle(ref, () => ({ setQuery }), [setQuery])

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const productGroupTree = useMemo(() => {
    if (!sde) return []
    return buildProductGroupTree(
      sde.registry.blueprints,
      query.tiers,
      typeMap,
      DEFAULT_RECIPE_KINDS,
    )
  }, [sde, query.tiers, typeMap])

  const debouncedRankingFields = useDebouncedValue(
    deferredRankingSnapshot(query),
    SLIDER_DEBOUNCE_MS,
  )
  const isRankingPending = deferredRankingSnapshot(query) !== debouncedRankingFields

  const stableImmediateQuery = useMemo(
    () => immediateRankingQuery(query),
    [
      query.hub,
      query.mfgSystem,
      query.tiers,
      query.groups,
      query.window,
      query.priceMethod,
      query.buildableOnly,
      query.requireBlueprintPrice,
      query.recipeKinds,
      query.includeHaul,
      query.sortBy,
      query.sortDir,
    ],
  )

  useEffect(() => {
    const deferred = JSON.parse(debouncedRankingFields) as Pick<
      BlueprintQuery,
      'budgetMinSlider' | 'budgetMaxSlider' | 'rankingTimeHours' | 'minVolume'
    >
    onRankingQueryChange({ ...stableImmediateQuery, ...deferred })
  }, [debouncedRankingFields, stableImmediateQuery, onRankingQueryChange])

  return (
    <BlueprintFilterBar
      query={query}
      onChange={setQuery}
      sde={sde}
      productGroupTree={productGroupTree}
      resultCount={resultCount}
      resultPending={isRankingPending || rankingDeferPending}
    />
  )
})
