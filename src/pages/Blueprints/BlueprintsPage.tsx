import {
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { HubId, RankedBlueprintRow, ManufacturingSettings, SkillLevels } from '@/types'
import { hubDisplayName } from '@/lib/hubDisplay'
import { HUBS, DEFAULT_RECIPE_KINDS } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { buildTypeMap, getHubMarket, type SdeData } from '@/services/data/sdeLoader'
import {
  BlueprintQueryFilters,
  type BlueprintQueryFiltersHandle,
} from '@/pages/Blueprints/BlueprintQueryFilters'
import {
  defaultQuery,
  formatGroupFilterSubtitle,
  recipeKindsEqual,
  type BlueprintQuery,
} from '@/lib/blueprintQuery'
import {
  MAX_DAYS_TO_CLEAR,
  TOP_N,
  rankBlueprintsFromMarket,
  setupBudgetFromSlider,
  type BlueprintSortKey,
} from '@/lib/ranking'
import { buildBlueprintRankingSettings } from '@/lib/structureSettings'
import { planExpansionSettingsKey } from '@/lib/planExpansionSettings'
import { PageHeader, LoadingState } from '@/components/layout/Layout'
import { SetupCostModal } from '@/pages/Blueprints/SetupCostModal'
import { IphBreakdownModal } from '@/pages/Blueprints/IphBreakdownModal'
import { InfoTooltip } from '@/components/InfoTooltip'
import { productionGraphRoute } from '@/lib/paths'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { FavoriteItemsSection } from '@/pages/Blueprints/FavoriteItemsSection'
import { BlueprintRow, BlueprintMobileRow } from '@/pages/Blueprints/BlueprintRow'

function haulCostRouteLabels(
  sde: SdeData | undefined,
  buyHub: HubId,
  sellHub: HubId,
  manufacturingSystemId: number,
  buyHubFallback: string,
) {
  const buildName =
    sde?.systems.find((s) => s.systemId === manufacturingSystemId)?.name ??
    `System ${manufacturingSystemId}`
  const buyMarketId = sde ? getHubMarket(sde.market, buyHub)?.marketSystemId : undefined
  const sellMarketId = sde ? getHubMarket(sde.market, sellHub)?.marketSystemId : undefined
  const buyName =
    (buyMarketId != null
      ? sde?.systems.find((s) => s.systemId === buyMarketId)?.name
      : undefined) ?? buyHubFallback
  const sellName =
    (sellMarketId != null
      ? sde?.systems.find((s) => s.systemId === sellMarketId)?.name
      : undefined) ?? hubDisplayName(sellHub)
  return {
    haulInLabel: `${buyName} → ${buildName}`,
    haulOutLabel: `${buildName} → ${sellName}`,
  }
}

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
  const deferredRankingQuery = useDeferredValue(rankingQuery)
  const rankingDeferPending = rankingQuery !== deferredRankingQuery

  const handleRankingQueryChange = useCallback((query: BlueprintQuery) => {
    startTransition(() => setRankingQuery(query))
  }, [])

  const facilitySettingsKey = planExpansionSettingsKey(settings)

  const manufacturingSettings = useMemo(
    (): ManufacturingSettings =>
      buildBlueprintRankingSettings(settings, sde?.systems, {
        mfgSystem: deferredRankingQuery.mfgSystem,
        rankingTimeHours: deferredRankingQuery.rankingTimeHours,
        priceMethod: deferredRankingQuery.priceMethod,
      }),
    [
      settings,
      facilitySettingsKey,
      deferredRankingQuery.rankingTimeHours,
      deferredRankingQuery.priceMethod,
      deferredRankingQuery.mfgSystem,
      sde?.systems,
    ],
  )

  const [setupDetailRow, setSetupDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [iphDetailRow, setIphDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [graphRow, setGraphRow] = useState<RankedBlueprintRow | null>(null)

  const openGraph = useCallback((row: RankedBlueprintRow) => {
    setGraphRow(row)
  }, [])

  const openGraphPage = useCallback(
    (productTypeId: number) => {
      const rankedRow = graphRow?.blueprint.productTypeId === productTypeId ? graphRow : undefined
      navigate(
        { pathname: productionGraphRoute(productTypeId), search: searchParams.toString() },
        { state: rankedRow ? { rankedRow } : undefined },
      )
      setGraphRow(null)
    },
    [navigate, searchParams, graphRow],
  )

  const activeHub = HUBS.find((h) => h.id === deferredRankingQuery.hub)

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const watchlistIds = useMemo(() => new Set(watchlist.map((w) => w.productTypeId)), [watchlist])

  const haulLabels = haulCostRouteLabels(
    sde,
    deferredRankingQuery.hub,
    settings.sellHubId ?? deferredRankingQuery.hub,
    deferredRankingQuery.mfgSystem,
    activeHub ? hubDisplayName(activeHub.id) : deferredRankingQuery.hub,
  )

  const minSetupCost = useMemo(
    () => setupBudgetFromSlider(deferredRankingQuery.budgetMinSlider),
    [deferredRankingQuery.budgetMinSlider],
  )
  const maxSetupCost = useMemo(
    () => setupBudgetFromSlider(deferredRankingQuery.budgetMaxSlider),
    [deferredRankingQuery.budgetMaxSlider],
  )

  const rows = useMemo(() => {
    if (!sde) return []
    return rankBlueprintsFromMarket(
      sde.registry,
      sde.market,
      sde.regions,
      typeMap,
      deferredRankingQuery.hub,
      deferredRankingQuery.window,
      manufacturingSettings,
      {
        minSetupCost,
        maxSetupCost,
        buildableOnly: deferredRankingQuery.buildableOnly,
        requireBlueprintPrice: deferredRankingQuery.requireBlueprintPrice,
        recipeKinds: deferredRankingQuery.recipeKinds,
        includeHaulCost: deferredRankingQuery.includeHaul,
        minVolume: deferredRankingQuery.minVolume,
        tiers: deferredRankingQuery.tiers,
        productGroups:
          deferredRankingQuery.groups.length > 0 ? deferredRankingQuery.groups : undefined,
        sortBy: deferredRankingQuery.sortBy,
        sortDirection: deferredRankingQuery.sortDir,
      },
      sde.systems,
      sde.contracts,
    )
  }, [
    sde,
    typeMap,
    manufacturingSettings,
    deferredRankingQuery.hub,
    deferredRankingQuery.window,
    deferredRankingQuery.priceMethod,
    deferredRankingQuery.rankingTimeHours,
    minSetupCost,
    maxSetupCost,
    deferredRankingQuery.buildableOnly,
    deferredRankingQuery.requireBlueprintPrice,
    deferredRankingQuery.recipeKinds,
    deferredRankingQuery.includeHaul,
    deferredRankingQuery.minVolume,
    deferredRankingQuery.tiers,
    deferredRankingQuery.groups,
    deferredRankingQuery.sortBy,
    deferredRankingQuery.sortDir,
  ])

  const favoriteEntries = useMemo(() => {
    if (!sde || watchlist.length === 0) return []
    const productTypeIds = watchlist.map((w) => w.productTypeId)
    const ranked = rankBlueprintsFromMarket(
      sde.registry,
      sde.market,
      sde.regions,
      typeMap,
      deferredRankingQuery.hub,
      deferredRankingQuery.window,
      manufacturingSettings,
      {
        minSetupCost: 0,
        maxSetupCost: Number.POSITIVE_INFINITY,
        buildableOnly: false,
        recipeKinds: ['manufacturing', 'reaction'],
        includeHaulCost: deferredRankingQuery.includeHaul,
        minVolume: 0,
        productTypeIds,
        limit: productTypeIds.length,
      },
      sde.systems,
      sde.contracts,
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
    deferredRankingQuery.hub,
    deferredRankingQuery.window,
    deferredRankingQuery.includeHaul,
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

  const rankingBothKinds = recipeKindsEqual(deferredRankingQuery.recipeKinds, DEFAULT_RECIPE_KINDS)
  const rankingLimitLabel = rankingBothKinds ? `Top ${TOP_N} per recipe type` : `Top ${TOP_N}`

  if (isLoading) return <LoadingState />

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Top Blueprints"
        subtitle={`${rankingLimitLabel}${formatGroupFilterSubtitle(deferredRankingQuery.groups)} by ${SORT_LABELS[deferredRankingQuery.sortBy]} · sized to ${MAX_DAYS_TO_CLEAR} days of hub volume${marketUpdated ? ` · market ${marketUpdated}` : ''}`}
      />

      <BlueprintQueryFilters
        ref={filtersRef}
        sde={sde}
        resultCount={rows.length}
        rankingDeferPending={rankingDeferPending}
        onRankingQueryChange={handleRankingQueryChange}
      />

      <FavoriteItemsSection
        entries={favoriteEntries}
        skills={settings.skills}
        onToggle={toggleWatchlist}
        onOpenGraph={openGraph}
        onOpenSetup={setSetupDetailRow}
        onOpenIph={setIphDetailRow}
      />

      {rows.length === 0 && (
        <p className="text-sm opacity-60 mb-4">
          No blueprints match filters. Try widening the setup budget, lowering min volume, changing
          hub/region, picking another group, relaxing tier filters, or turning off Require BPO/BPC
          price
          {deferredRankingQuery.window !== 'all'
            ? ', or switch window to All to rank by current sell price when history is missing.'
            : '.'}
        </p>
      )}

      {rows.length > 0 && (
        <BlueprintResults
          rows={rows}
          rankingQuery={deferredRankingQuery}
          settings={settings}
          watchlistIds={watchlistIds}
          toggleWatchlist={toggleWatchlist}
          onSort={handleSort}
          onOpenGraph={openGraph}
          onOpenSetup={setSetupDetailRow}
          onOpenIph={setIphDetailRow}
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

      {graphRow ? (
        <BlueprintGraphModal
          variant="modal"
          blueprint={graphRow.blueprint}
          rankedRow={graphRow}
          buyHub={deferredRankingQuery.hub}
          sellHub={settings.sellHubId ?? deferredRankingQuery.hub}
          priceWindow={deferredRankingQuery.window}
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
  onSort,
  onOpenGraph,
  onOpenSetup,
  onOpenIph,
}: {
  rows: RankedBlueprintRow[]
  rankingQuery: BlueprintQuery
  settings: { skills: SkillLevels }
  watchlistIds: Set<number>
  toggleWatchlist: (productTypeId: number) => void
  onSort: (key: BlueprintSortKey) => void
  onOpenGraph: (row: RankedBlueprintRow) => void
  onOpenSetup: (row: RankedBlueprintRow) => void
  onOpenIph: (row: RankedBlueprintRow) => void
}) {
  return (
    <>
      <div className="hidden lg:block overflow-hidden border border-eve-border/90 rounded-xl shrink-0 mb-4 bg-base-200/70 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.04),0_8px_24px_-12px_rgb(0_0_0_/_0.55)]">
        <div className="overflow-x-auto">
          <table className="table table-compact blueprint-ranking-table w-full">
            <thead>
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
                  <InfoTooltip
                    text={`Setup cost and profit use runs derived from your job time filter. ISK/hr uses min(production/day, market volume/day) × profit per unit, scaled down when your production share exceeds daily hub volume (competition penalty).`}
                  />
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
                />
              ))}
            </tbody>
          </table>
        </div>
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
          />
        ))}
      </div>
    </>
  )
})
