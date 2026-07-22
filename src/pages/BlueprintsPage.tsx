import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { RankedBlueprintRow, ManufacturingSettings, SkillLevels } from '@/types'
import { HUBS } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { useHaulRouteRisk } from '@/hooks/useHaulRouteRisk'
import {
  buildProductGroupTree,
  buildTypeMap,
} from '@/services/data/sdeLoader'
import {
  BlueprintQueryFilters,
  type BlueprintQueryFiltersHandle,
} from '@/components/BlueprintQueryFilters'
import { defaultQuery, formatGroupFilterSubtitle, type BlueprintQuery } from '@/lib/blueprintQuery'
import {
  MAX_DAYS_TO_CLEAR,
  TOP_N,
  rankBlueprintsFromMarket,
  setupBudgetFromSlider,
  type BlueprintSortKey,
} from '@/lib/ranking'
import { PageHeader, LoadingState } from '@/components/Layout'
import type { RouteDangerResult } from '@/lib/routeDanger'
import { HaulRiskModal } from '@/components/HaulRiskModal'
import { SetupCostModal } from '@/components/SetupCostModal'
import { IphBreakdownModal } from '@/components/IphBreakdownModal'
import { InfoTooltip } from '@/components/InfoTooltip'
import { productionGraphRoute } from '@/lib/paths'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { FavoriteItemsSection } from '@/components/FavoriteItemsSection'
import { BlueprintRow, BlueprintMobileRow } from '@/components/BlueprintRow'


const SORT_LABELS: Record<BlueprintSortKey, string> = {
  setupCost: 'Setup',
  netProfit: 'Profit',
  iph: 'ISK/hr',
  margin: 'Margin',
  avgVolume: 'Vol/day',
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  children,
}: {
  label: string
  sortKey: BlueprintSortKey
  activeKey: BlueprintSortKey
  direction: 'asc' | 'desc'
  onSort: (key: BlueprintSortKey) => void
  children?: ReactNode
}) {
  const active = activeKey === sortKey
  return (
    <th>
      <button
        type="button"
        className={`inline-flex items-center gap-1 font-semibold hover:text-primary transition-colors ${
          active ? 'text-primary' : ''
        }`}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        {children ? (
          <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
            {children}
          </span>
        ) : null}
        <span className="inline-block w-3 text-[10px] opacity-70" aria-hidden>
          {active ? (direction === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  )
}

export function BlueprintsPage() {
  const settings = useAppStore((s) => s.userData.settings)
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist)
  const watchlist = useAppStore((s) => s.userData.watchlist)
  const { data: sde, isLoading } = useSdeData()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const filtersRef = useRef<BlueprintQueryFiltersHandle>(null)
  const [rankingQuery, setRankingQuery] = useState<BlueprintQuery>(() => defaultQuery(settings))
  const handleRankingQueryChange = useCallback((query: BlueprintQuery) => {
    setRankingQuery(query)
  }, [])

  const manufacturingSettings = useMemo(
    (): ManufacturingSettings => ({
      ...settings,
      batchSize: rankingQuery.batchSize,
      priceMethod: rankingQuery.priceMethod,
      manufacturingSystemId: rankingQuery.mfgSystem,
    }),
    [settings, rankingQuery.batchSize, rankingQuery.priceMethod, rankingQuery.mfgSystem],
  )

  const [haulRiskOpen, setHaulRiskOpen] = useState(false)
  const [setupDetailRow, setSetupDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [iphDetailRow, setIphDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [graphRow, setGraphRow] = useState<RankedBlueprintRow | null>(null)

  const openGraph = useCallback((row: RankedBlueprintRow) => {
    setGraphRow(row)
  }, [])

  const openGraphPage = useCallback(
    (productTypeId: number) => {
      const rankedRow =
        graphRow?.blueprint.productTypeId === productTypeId ? graphRow : undefined
      navigate(
        { pathname: productionGraphRoute(productTypeId), search: searchParams.toString() },
        { state: rankedRow ? { rankedRow } : undefined },
      )
      setGraphRow(null)
    },
    [navigate, searchParams, graphRow],
  )

  const activeHub = HUBS.find((h) => h.id === rankingQuery.hub)

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const productGroupTree = useMemo(() => {
    if (!sde) return []
    return buildProductGroupTree(sde.registry.blueprints, rankingQuery.tiers, typeMap)
  }, [sde, rankingQuery.tiers, typeMap])

  const watchlistIds = useMemo(
    () => new Set(watchlist.map((w) => w.productTypeId)),
    [watchlist],
  )

  const {
    haulIn: haulInDanger,
    haulOut: haulOutDanger,
    error: haulDangerError,
    loading: dangerLoading,
    labels: haulLabels,
  } = useHaulRouteRisk({
    sde,
    primaryHub: rankingQuery.hub,
    manufacturingSystemId: rankingQuery.mfgSystem,
    hubName: activeHub?.name ?? rankingQuery.hub,
  })

  const minSetupCost = useMemo(
    () => setupBudgetFromSlider(rankingQuery.budgetMinSlider),
    [rankingQuery.budgetMinSlider],
  )
  const maxSetupCost = useMemo(
    () => setupBudgetFromSlider(rankingQuery.budgetMaxSlider),
    [rankingQuery.budgetMaxSlider],
  )

  const rows = useMemo(() => {
    if (!sde) return []
    return rankBlueprintsFromMarket(
      sde.registry,
      sde.market,
      sde.regions,
      typeMap,
      rankingQuery.hub,
      rankingQuery.window,
      manufacturingSettings,
      {
        minSetupCost,
        maxSetupCost,
        buildableOnly: rankingQuery.buildableOnly,
        includeHaulCost: rankingQuery.includeHaul,
        minVolume: rankingQuery.minVolume,
        tiers: rankingQuery.tiers,
        productGroups: rankingQuery.groups.length > 0 ? rankingQuery.groups : undefined,
        sortBy: rankingQuery.sortBy,
        sortDirection: rankingQuery.sortDir,
      },
      sde.systems,
    )
  }, [
    sde,
    typeMap,
    manufacturingSettings,
    rankingQuery.hub,
    rankingQuery.window,
    rankingQuery.priceMethod,
    rankingQuery.batchSize,
    minSetupCost,
    maxSetupCost,
    rankingQuery.buildableOnly,
    rankingQuery.includeHaul,
    rankingQuery.minVolume,
    rankingQuery.tiers,
    rankingQuery.groups,
    rankingQuery.sortBy,
    rankingQuery.sortDir,
  ])

  const favoriteEntries = useMemo(() => {
    if (!sde || watchlist.length === 0) return []
    const productTypeIds = watchlist.map((w) => w.productTypeId)
    const ranked = rankBlueprintsFromMarket(
      sde.registry,
      sde.market,
      sde.regions,
      typeMap,
      rankingQuery.hub,
      rankingQuery.window,
      manufacturingSettings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.POSITIVE_INFINITY,
        buildableOnly: false,
        includeHaulCost: rankingQuery.includeHaul,
        minVolume: 0,
        productTypeIds,
        limit: productTypeIds.length,
      },
      sde.systems,
    )
    const byProductId = new Map(ranked.map((r) => [r.blueprint.productTypeId, r]))
    return [...watchlist].reverse().map((w) => ({
      productTypeId: w.productTypeId,
      name: typeMap.get(w.productTypeId)?.name ?? `Type ${w.productTypeId}`,
      row: byProductId.get(w.productTypeId) ?? null,
    }))
  }, [
    sde,
    watchlist,
    typeMap,
    rankingQuery.hub,
    rankingQuery.window,
    rankingQuery.includeHaul,
    manufacturingSettings,
  ])

  function handleSort(nextKey: BlueprintSortKey) {
    if (nextKey === rankingQuery.sortBy) {
      filtersRef.current?.setQuery({ sortDir: rankingQuery.sortDir === 'desc' ? 'asc' : 'desc' })
      return
    }
    filtersRef.current?.setQuery({
      sortBy: nextKey,
      sortDir: nextKey === 'setupCost' ? 'asc' : 'desc',
    })
  }

  const marketUpdated = sde?.market.generatedAt
    ? new Date(sde.market.generatedAt).toLocaleString()
    : undefined

  if (isLoading) return <LoadingState />

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Top Blueprints"
        subtitle={`Top ${TOP_N}${formatGroupFilterSubtitle(rankingQuery.groups)} by ${SORT_LABELS[rankingQuery.sortBy]} · sized to ${MAX_DAYS_TO_CLEAR} days of hub volume${marketUpdated ? ` · market ${marketUpdated}` : ''}`}
      />

      <BlueprintQueryFilters
        ref={filtersRef}
        sde={sde}
        productGroupTree={productGroupTree}
        resultCount={rows.length}
        onRankingQueryChange={handleRankingQueryChange}
      />

      <FavoriteItemsSection
        entries={favoriteEntries}
        skills={settings.skills}
        haulIn={haulInDanger}
        haulOut={haulOutDanger}
        haulError={haulDangerError}
        dangerLoading={dangerLoading}
        onToggle={toggleWatchlist}
        onOpenGraph={openGraph}
        onOpenSetup={setSetupDetailRow}
        onOpenIph={setIphDetailRow}
        onOpenHaulRisk={() => {
          if (!haulDangerError) setHaulRiskOpen(true)
        }}
      />

      {rows.length === 0 && (
        <p className="text-sm opacity-60 mb-4">
          No blueprints match filters. Try widening the setup budget, lowering min volume, changing hub/region, picking another group, relaxing tier filters
          {rankingQuery.window !== 'all'
            ? ', or switch window to All to rank by current sell price when history is missing.'
            : '.'}
        </p>
      )}

      {rows.length > 0 && (
        <BlueprintResults
          rows={rows}
          rankingQuery={rankingQuery}
          settings={settings}
          watchlistIds={watchlistIds}
          toggleWatchlist={toggleWatchlist}
          haulInDanger={haulInDanger}
          haulOutDanger={haulOutDanger}
          haulDangerError={haulDangerError}
          dangerLoading={dangerLoading}
          onSort={handleSort}
          onOpenGraph={openGraph}
          onOpenSetup={setSetupDetailRow}
          onOpenIph={setIphDetailRow}
          onOpenHaulRisk={() => {
            if (!haulDangerError) setHaulRiskOpen(true)
          }}
        />
      )}


      <SetupCostModal
        row={setupDetailRow}
        typeMap={typeMap}
        haulInLabel={haulLabels.haulInLabel}
        onClose={() => setSetupDetailRow(null)}
      />

      <IphBreakdownModal
        row={iphDetailRow}
        typeMap={typeMap}
        haulInLabel={haulLabels.haulInLabel}
        haulOutLabel={haulLabels.haulOutLabel}
        onClose={() => setIphDetailRow(null)}
      />

      <HaulRiskModal
        open={haulRiskOpen}
        onClose={() => setHaulRiskOpen(false)}
        haulIn={haulInDanger}
        haulOut={haulOutDanger}
        loading={dangerLoading}
        haulInLabel={haulLabels.haulInLabel}
        haulOutLabel={haulLabels.haulOutLabel}
      />

      {graphRow ? (
        <BlueprintGraphModal
          variant="modal"
          blueprint={graphRow.blueprint}
          rankedRow={graphRow}
          hub={rankingQuery.hub}
          priceWindow={rankingQuery.window}
          settings={manufacturingSettings}
          shareSearch={searchParams.toString()}
          onOpenPage={openGraphPage}
          onClose={() => setGraphRow(null)}
        />
      ) : null}
    </div>
  )
}

const BlueprintResults = memo(function BlueprintResults({
  rows,
  rankingQuery,
  settings,
  watchlistIds,
  toggleWatchlist,
  haulInDanger,
  haulOutDanger,
  haulDangerError,
  dangerLoading,
  onSort,
  onOpenGraph,
  onOpenSetup,
  onOpenIph,
  onOpenHaulRisk,
}: {
  rows: RankedBlueprintRow[]
  rankingQuery: BlueprintQuery
  settings: { skills: SkillLevels }
  watchlistIds: Set<number>
  toggleWatchlist: (productTypeId: number) => void
  haulInDanger: RouteDangerResult | null
  haulOutDanger: RouteDangerResult | null
  haulDangerError: string | null
  dangerLoading: boolean
  onSort: (key: BlueprintSortKey) => void
  onOpenGraph: (row: RankedBlueprintRow) => void
  onOpenSetup: (row: RankedBlueprintRow) => void
  onOpenIph: (row: RankedBlueprintRow) => void
  onOpenHaulRisk: () => void
}) {
  return (
    <>
      <div className="hidden lg:block overflow-x-auto border border-eve-border rounded-lg shrink-0 mb-4">
        <table className="table table-compact w-full">
          <thead className="bg-base-200 sticky top-0">
            <tr>
              <th className="w-12"></th>
              <th>Blueprint</th>
              <SortableTh
                label="Setup"
                sortKey="setupCost"
                activeKey={rankingQuery.sortBy}
                direction={rankingQuery.sortDir}
                onSort={onSort}
              />
              <SortableTh
                label="Profit"
                sortKey="netProfit"
                activeKey={rankingQuery.sortBy}
                direction={rankingQuery.sortDir}
                onSort={onSort}
              />
              <SortableTh
                label="ISK/hr"
                sortKey="iph"
                activeKey={rankingQuery.sortBy}
                direction={rankingQuery.sortDir}
                onSort={onSort}
              >
                <InfoTooltip text={`Setup cost and profit use your batch size. ISK/hr uses min(production/day, market volume/day) × profit per unit, scaled down when your production share exceeds daily hub volume (competition penalty).`} />
              </SortableTh>
              <SortableTh
                label="Margin"
                sortKey="margin"
                activeKey={rankingQuery.sortBy}
                direction={rankingQuery.sortDir}
                onSort={onSort}
              />
              <SortableTh
                label="Vol/day"
                sortKey="avgVolume"
                activeKey={rankingQuery.sortBy}
                direction={rankingQuery.sortDir}
                onSort={onSort}
              >
                <InfoTooltip text="Average daily traded volume for liquidity (batch cap, IPH, filters). With a 1y price window, volume uses the 1m average. Shows — when only spot price is available." />
              </SortableTh>
              <th>Haul risk</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <BlueprintRow
                key={row.blueprint.blueprintTypeId}
                row={row}
                rank={index + 1}
                skills={settings.skills}
                watched={watchlistIds.has(row.blueprint.productTypeId)}
                onWatch={() => toggleWatchlist(row.blueprint.productTypeId)}
                onOpenGraph={() => onOpenGraph(row)}
                onOpenSetup={() => onOpenSetup(row)}
                onOpenIph={() => onOpenIph(row)}
                onOpenHaulRisk={onOpenHaulRisk}
                haulIn={haulInDanger}
                haulOut={haulOutDanger}
                haulError={haulDangerError}
                dangerLoading={dangerLoading}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pb-4">
        {rows.map((row, index) => (
          <BlueprintMobileRow
            key={row.blueprint.blueprintTypeId}
            row={row}
            rank={index + 1}
            skills={settings.skills}
            watched={watchlistIds.has(row.blueprint.productTypeId)}
            onWatch={() => toggleWatchlist(row.blueprint.productTypeId)}
            onOpenGraph={() => onOpenGraph(row)}
            onOpenSetup={() => onOpenSetup(row)}
            onOpenIph={() => onOpenIph(row)}
            onOpenHaulRisk={onOpenHaulRisk}
            haulIn={haulInDanger}
            haulOut={haulOutDanger}
            haulError={haulDangerError}
            dangerLoading={dangerLoading}
          />
        ))}
      </div>
    </>
  )
})
