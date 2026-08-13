import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react'
import type { SdeData, ProductGroupCategoryNode } from '@/services/data/sdeLoader'
import { BlueprintFilterBar } from '@/components/BlueprintFilterBar'
import { useBlueprintQuery } from '@/hooks/useBlueprintQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { BlueprintQuery } from '@/lib/blueprintQuery'

const SLIDER_DEBOUNCE_MS = 1000

export interface BlueprintQueryFiltersHandle {
  setQuery: (patch: Partial<BlueprintQuery>) => void
}

interface BlueprintQueryFiltersProps {
  sde: SdeData | undefined
  productGroupTree: ProductGroupCategoryNode[]
  resultCount: number
  onRankingQueryChange: (query: BlueprintQuery) => void
}

function deferredRankingSnapshot(query: BlueprintQuery): string {
  return JSON.stringify({
    budgetMinSlider: query.budgetMinSlider,
    budgetMaxSlider: query.budgetMaxSlider,
    batchSize: query.batchSize,
    minVolume: query.minVolume,
  })
}

function immediateRankingQuery(
  query: BlueprintQuery,
): Omit<BlueprintQuery, 'budgetMinSlider' | 'budgetMaxSlider' | 'batchSize' | 'minVolume'> {
  const { budgetMinSlider, budgetMaxSlider, batchSize, minVolume, ...rest } = query
  return rest
}

export const BlueprintQueryFilters = forwardRef<
  BlueprintQueryFiltersHandle,
  BlueprintQueryFiltersProps
>(function BlueprintQueryFilters(
  { sde, productGroupTree, resultCount, onRankingQueryChange },
  ref,
) {
  const { query, setQuery } = useBlueprintQuery()

  useImperativeHandle(ref, () => ({ setQuery }), [setQuery])

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
      'budgetMinSlider' | 'budgetMaxSlider' | 'batchSize' | 'minVolume'
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
      resultPending={isRankingPending}
    />
  )
})
