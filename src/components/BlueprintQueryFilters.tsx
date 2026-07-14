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

function sliderSnapshot(query: BlueprintQuery): string {
  return JSON.stringify({
    budgetMinSlider: query.budgetMinSlider,
    budgetMaxSlider: query.budgetMaxSlider,
    batchSize: query.batchSize,
  })
}

function nonSliderQuery(query: BlueprintQuery): Omit<
  BlueprintQuery,
  'budgetMinSlider' | 'budgetMaxSlider' | 'batchSize'
> {
  const { budgetMinSlider, budgetMaxSlider, batchSize, ...rest } = query
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

  const debouncedSliders = useDebouncedValue(sliderSnapshot(query), SLIDER_DEBOUNCE_MS)
  const isRankingPending = sliderSnapshot(query) !== debouncedSliders

  const stableNonSlider = useMemo(
    () => nonSliderQuery(query),
    [
      query.hub,
      query.mfgSystem,
      query.tiers,
      query.groups,
      query.window,
      query.priceMethod,
      query.buildableOnly,
      query.includeHaul,
      query.minVolume,
      query.sortBy,
      query.sortDir,
    ],
  )

  useEffect(() => {
    const sliders = JSON.parse(debouncedSliders) as Pick<
      BlueprintQuery,
      'budgetMinSlider' | 'budgetMaxSlider' | 'batchSize'
    >
    onRankingQueryChange({ ...stableNonSlider, ...sliders })
  }, [debouncedSliders, stableNonSlider, onRankingQueryChange])

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
