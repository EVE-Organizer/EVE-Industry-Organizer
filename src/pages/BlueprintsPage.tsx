import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CharacterAccount, RankedBlueprintRow } from '@/types'
import { HUBS } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { useBlueprintQuery } from '@/hooks/useBlueprintQuery'
import { useHaulRouteRisk } from '@/hooks/useHaulRouteRisk'
import {
  buildProductGroupTree,
  buildTypeMap,
} from '@/services/data/sdeLoader'
import { BlueprintFilterBar } from '@/components/BlueprintFilterBar'
import {
  MAX_DAYS_TO_CLEAR,
  TOP_N,
  rankBlueprintsFromMarket,
  setupBudgetFromSlider,
  type BlueprintSortKey,
} from '@/lib/ranking'
import { formatAvgVolume, formatIsk, formatPercent } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import type { RouteDangerResult } from '@/lib/routeDanger'
import { PageHeader, LoadingState } from '@/components/Layout'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { EveImage } from '@/components/EveImage'
import { BuildSkillGapFlag } from '@/components/BuildSkillGapFlag'
import { HaulRiskModal, HaulRiskTrigger } from '@/components/HaulRiskModal'
import { SetupCostModal } from '@/components/SetupCostModal'
import { IphBreakdownModal } from '@/components/IphBreakdownModal'
import { InfoTooltip } from '@/components/InfoTooltip'
import { getMissingBuildSkills } from '@/lib/buildRequirements'


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
  const accounts = useAppStore((s) => s.userData.accounts)
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist)
  const watchlist = useAppStore((s) => s.userData.watchlist)
  const { data: sde, isLoading } = useSdeData()

  const { query, setQuery } = useBlueprintQuery()

  const [haulRiskOpen, setHaulRiskOpen] = useState(false)
  const [setupDetailRow, setSetupDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [iphDetailRow, setIphDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [graphBlueprint, setGraphBlueprint] = useState<RankedBlueprintRow['blueprint'] | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)
  const primaryAccount = accounts[0]
  const activeHub = HUBS.find((h) => h.id === query.hub)

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const productGroupTree = useMemo(() => {
    if (!sde) return []
    return buildProductGroupTree(sde.registry.blueprints, query.tiers, typeMap)
  }, [sde, query.tiers, typeMap])

  const {
    haulIn: haulInDanger,
    haulOut: haulOutDanger,
    error: haulDangerError,
    loading: dangerLoading,
    labels: haulLabels,
  } = useHaulRouteRisk({
    sde,
    primaryHub: query.hub,
    manufacturingSystemId: query.mfgSystem,
    hubName: activeHub?.name ?? query.hub,
  })

  const minSetupCost = useMemo(
    () => setupBudgetFromSlider(query.budgetMinSlider),
    [query.budgetMinSlider],
  )
  const maxSetupCost = useMemo(
    () => setupBudgetFromSlider(query.budgetMaxSlider),
    [query.budgetMaxSlider],
  )

  const rows = useMemo(() => {
    if (!sde) return []
    return rankBlueprintsFromMarket(
      sde.registry,
      sde.market,
      sde.regions,
      typeMap,
      query.hub,
      query.window,
      settings,
      {
        minSetupCost,
        maxSetupCost,
        buildableOnly: query.buildableOnly,
        includeHaulCost: query.includeHaul,
        minVolume: query.minVolume,
        account: primaryAccount,
        tiers: query.tiers,
        productGroup: query.group,
        sortBy: query.sortBy,
        sortDirection: query.sortDir,
      },
      sde.systems,
    )
  }, [
    sde,
    typeMap,
    settings,
    query.hub,
    query.window,
    minSetupCost,
    maxSetupCost,
    query.buildableOnly,
    query.includeHaul,
    query.minVolume,
    primaryAccount,
    query.tiers,
    query.group,
    query.sortBy,
    query.sortDir,
  ])

  function handleSort(nextKey: BlueprintSortKey) {
    if (nextKey === query.sortBy) {
      setQuery({ sortDir: query.sortDir === 'desc' ? 'asc' : 'desc' })
      return
    }
    setQuery({ sortBy: nextKey, sortDir: nextKey === 'setupCost' ? 'asc' : 'desc' })
  }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  })

  const marketUpdated = sde?.market.generatedAt
    ? new Date(sde.market.generatedAt).toLocaleString()
    : undefined

  if (isLoading) return <LoadingState />

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Top Blueprints"
        subtitle={`Top ${TOP_N}${query.group !== 'all' ? ` in ${query.group}` : ''} by ${SORT_LABELS[query.sortBy]} · sized to ${MAX_DAYS_TO_CLEAR} days of hub volume${marketUpdated ? ` · market ${marketUpdated}` : ''}`}
      />

      <BlueprintFilterBar
        query={query}
        onChange={setQuery}
        sde={sde}
        productGroupTree={productGroupTree}
        resultCount={rows.length}
      />

      {rows.length === 0 && (
        <p className="text-sm opacity-60 mb-4">
          No blueprints match filters. Try widening the setup budget, lowering min volume, changing hub/region, picking another group, relaxing tier filters
          {query.window !== 'all'
            ? ', or switch window to All to rank by current sell price when history is missing.'
            : '.'}
        </p>
      )}

      {rows.length > 0 && (
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
                    activeKey={query.sortBy}
                    direction={query.sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Profit"
                    sortKey="netProfit"
                    activeKey={query.sortBy}
                    direction={query.sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="ISK/hr"
                    sortKey="iph"
                    activeKey={query.sortBy}
                    direction={query.sortDir}
                    onSort={handleSort}
                  >
                    <InfoTooltip text={`Profit and ISK/hr use min(production/day, market volume/day) × profit per unit, scaled down when your production share exceeds daily market volume (competition penalty). Batch runs are capped at ${MAX_DAYS_TO_CLEAR} days of average hub volume.`} />
                  </SortableTh>
                  <SortableTh
                    label="Margin"
                    sortKey="margin"
                    activeKey={query.sortBy}
                    direction={query.sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Vol/day"
                    sortKey="avgVolume"
                    activeKey={query.sortBy}
                    direction={query.sortDir}
                    onSort={handleSort}
                  >
                    <InfoTooltip text="Average daily traded volume for the selected time window. Shows — when only spot price is available (run fetch-data for full history)." />
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
                    account={primaryAccount}
                    watched={watchlist.some((w) => w.productTypeId === row.blueprint.productTypeId)}
                    onWatch={() => toggleWatchlist(row.blueprint.productTypeId)}
                    onOpenGraph={() => setGraphBlueprint(row.blueprint)}
                    onOpenSetup={() => setSetupDetailRow(row)}
                    onOpenIph={() => setIphDetailRow(row)}
                    onOpenHaulRisk={() => {
                      if (!haulDangerError) setHaulRiskOpen(true)
                    }}
                    haulIn={haulInDanger}
                    haulOut={haulOutDanger}
                    haulError={haulDangerError}
                    dangerLoading={dangerLoading}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden flex-1 min-h-0 overflow-auto" ref={parentRef}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((v) => {
                const row = rows[v.index]!
                const watched = watchlist.some((w) => w.productTypeId === row.blueprint.productTypeId)
                const missingSkills = getMissingBuildSkills(row.blueprint, primaryAccount)
                return (
                  <div
                    key={row.blueprint.blueprintTypeId}
                    className="card bg-base-200 border border-eve-border absolute w-full"
                    style={{ transform: `translateY(${v.start}px)`, height: `${v.size}px` }}
                  >
                    <div className="card-body py-3 flex-row gap-3 items-center">
                      <EveImage
                        id={row.blueprint.productTypeId}
                        size={32}
                        framed
                        alt={row.product.name}
                      />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => setGraphBlueprint(row.blueprint)}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{row.product.name}</h3>
                          <BuildSkillGapFlag missing={missingSkills} />
                        </div>
                        <button
                          type="button"
                          className="text-xs link link-hover tabular-nums"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIphDetailRow(row)
                          }}
                          aria-label={`ISK per hour breakdown for ${row.product.name}`}
                        >
                          {formatIsk(row.iph)}/hr
                        </button>
                        <p className="text-xs opacity-70">
                          {formatPercent(row.margin)} · {formatIsk(row.netProfit)}
                        </p>
                      </button>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-sm ${watched ? 'text-primary' : ''}`}
                        onClick={() => toggleWatchlist(row.blueprint.productTypeId)}
                      >
                        {watched ? '★' : '☆'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {graphBlueprint && (
        <BlueprintGraphModal
          blueprint={graphBlueprint}
          hub={query.hub}
          settings={settings}
          onClose={() => setGraphBlueprint(null)}
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
    </div>
  )
}

function BlueprintRow({
  row,
  rank,
  account,
  watched,
  onWatch,
  onOpenGraph,
  onOpenSetup,
  onOpenIph,
  onOpenHaulRisk,
  haulIn,
  haulOut,
  haulError,
  dangerLoading,
}: {
  row: RankedBlueprintRow
  rank: number
  account?: CharacterAccount
  watched: boolean
  onWatch: () => void
  onOpenGraph: () => void
  onOpenSetup: () => void
  onOpenIph: () => void
  onOpenHaulRisk: () => void
  haulIn: RouteDangerResult | null
  haulOut: RouteDangerResult | null
  haulError: string | null
  dangerLoading: boolean
}) {
  const missingSkills = getMissingBuildSkills(row.blueprint, account)

  return (
    <tr className="hover:bg-base-200/80 cursor-pointer" onClick={onOpenGraph}>
      <td>
        <div className="flex items-center gap-1">
          <span className="text-[10px] opacity-40 w-4 tabular-nums">{rank}</span>
          <EveImage id={row.blueprint.productTypeId} size={32} framed alt={row.product.name} />
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="link link-hover truncate">{row.product.name}</span>
          <BuildSkillGapFlag missing={missingSkills} />
        </div>
        <span className="text-[10px] opacity-50 block">
          <span className="badge badge-xs badge-ghost mr-1">{tierLabel(row.blueprint.tier)}</span>
          {row.product.group}
        </span>
      </td>
      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="link link-hover tabular-nums"
          onClick={onOpenSetup}
          aria-label={`Setup cost breakdown for ${row.product.name}`}
        >
          {formatIsk(row.setupCost)}
        </button>
      </td>
      <td className={row.netProfit >= 0 ? 'text-success' : 'text-error'}>{formatIsk(row.netProfit)}</td>
      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="link link-hover tabular-nums"
          onClick={onOpenIph}
          aria-label={`ISK per hour breakdown for ${row.product.name}`}
        >
          {formatIsk(row.iph)}
        </button>
      </td>
      <td>{formatPercent(row.margin)}</td>
      <td>{formatAvgVolume(row.avgVolume)}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <HaulRiskTrigger
          haulIn={haulIn}
          haulOut={haulOut}
          error={haulError}
          loading={dangerLoading}
          onOpen={onOpenHaulRisk}
        />
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${watched ? 'text-primary' : ''}`}
          onClick={onWatch}
        >
          {watched ? '★' : '☆'}
        </button>
      </td>
    </tr>
  )
}
