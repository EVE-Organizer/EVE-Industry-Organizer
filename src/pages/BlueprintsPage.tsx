import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { BlueprintFilterTier, CharacterAccount, RankedBlueprintRow, TimeRange } from '@/types'
import { HUBS } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useHaulRouteRisk } from '@/hooks/useHaulRouteRisk'
import {
  buildProductGroupTree,
  buildTypeMap,
} from '@/services/data/sdeLoader'
import { ProductGroupPicker } from '@/components/ProductGroupPicker'
import { ManufacturingSystemPicker } from '@/components/ManufacturingSystemPicker'
import {
  defaultMaxSetupCost,
  defaultMinSetupCost,
  MAX_DAYS_TO_CLEAR,
  TOP_N,
  rankBlueprintsFromMarket,
  setupBudgetFromSlider,
  setupBudgetToSlider,
  type BlueprintSortKey,
} from '@/lib/ranking'
import { formatAvgVolume, formatIsk, formatPercent } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import type { RouteDangerResult } from '@/lib/routeDanger'
import { PageHeader, LoadingState } from '@/components/Layout'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { EveImage } from '@/components/EveImage'
import { TIER_FILTER_LABELS, TIER_TYPE_IDS } from '@/lib/eveImages'
import { SetupBudgetRange } from '@/components/SetupBudgetRange'
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
  const updateSettings = useAppStore((s) => s.updateSettings)
  const accounts = useAppStore((s) => s.userData.accounts)
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist)
  const watchlist = useAppStore((s) => s.userData.watchlist)
  const { data: sde, isLoading } = useSdeData()

  const [tier, setTier] = useState<BlueprintFilterTier>('t1')
  const [productGroup, setProductGroup] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('1w')
  const [budgetMinSlider, setBudgetMinSlider] = useState(() =>
    setupBudgetToSlider(defaultMinSetupCost()),
  )
  const [budgetMaxSlider, setBudgetMaxSlider] = useState(() =>
    setupBudgetToSlider(defaultMaxSetupCost()),
  )
  const debouncedMinSlider = useDebouncedValue(budgetMinSlider, 400)
  const debouncedMaxSlider = useDebouncedValue(budgetMaxSlider, 400)
  const minSetupCost = useMemo(
    () => setupBudgetFromSlider(debouncedMinSlider),
    [debouncedMinSlider],
  )
  const maxSetupCost = useMemo(
    () => setupBudgetFromSlider(debouncedMaxSlider),
    [debouncedMaxSlider],
  )

  function setBudgetRange(minSlider: number, maxSlider: number) {
    setBudgetMinSlider(minSlider)
    setBudgetMaxSlider(maxSlider)
  }
  const [buildableOnly, setBuildableOnly] = useState(false)
  const [includeHaulCost, setIncludeHaulCost] = useState(true)
  const [sortKey, setSortKey] = useState<BlueprintSortKey>('iph')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [haulRiskOpen, setHaulRiskOpen] = useState(false)
  const [setupDetailRow, setSetupDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [iphDetailRow, setIphDetailRow] = useState<RankedBlueprintRow | null>(null)
  const [graphBlueprint, setGraphBlueprint] = useState<RankedBlueprintRow['blueprint'] | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)
  const primaryAccount = accounts[0]
  const activeHub = HUBS.find((h) => h.id === settings.primaryHub)

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const productGroupTree = useMemo(() => {
    if (!sde) return []
    return buildProductGroupTree(sde.registry.blueprints, tier, typeMap)
  }, [sde, tier, typeMap])

  useEffect(() => {
    setProductGroup('all')
  }, [tier])

  const {
    haulIn: haulInDanger,
    haulOut: haulOutDanger,
    error: haulDangerError,
    loading: dangerLoading,
    labels: haulLabels,
  } = useHaulRouteRisk({
    sde,
    primaryHub: settings.primaryHub,
    manufacturingSystemId: settings.manufacturingSystemId,
    hubName: activeHub?.name ?? settings.primaryHub,
  })

  const rows = useMemo(() => {
    if (!sde) return []
    return rankBlueprintsFromMarket(
      sde.registry,
      sde.market,
      sde.regions,
      typeMap,
      settings.primaryHub,
      timeRange,
      settings,
      {
        minSetupCost,
        maxSetupCost,
        buildableOnly,
        includeHaulCost,
        account: primaryAccount,
        tier,
        productGroup,
        sortBy: sortKey,
        sortDirection,
      },
      sde.systems,
    )
  }, [
    sde,
    typeMap,
    settings,
    timeRange,
    debouncedMinSlider,
    debouncedMaxSlider,
    buildableOnly,
    includeHaulCost,
    primaryAccount,
    tier,
    productGroup,
    sortKey,
    sortDirection,
  ])

  function handleSort(nextKey: BlueprintSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((dir) => (dir === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'setupCost' ? 'asc' : 'desc')
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
        subtitle={`Top ${TOP_N}${productGroup !== 'all' ? ` in ${productGroup}` : ''} by ${SORT_LABELS[sortKey]} · sized to ${MAX_DAYS_TO_CLEAR} days of hub volume${marketUpdated ? ` · market ${marketUpdated}` : ''}`}
      />

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          Hub
          <select
            className="select select-bordered select-sm"
            value={settings.primaryHub}
            onChange={(e) => {
              const hub = HUBS.find((h) => h.id === e.target.value)
              updateSettings({
                primaryHub: e.target.value as typeof settings.primaryHub,
                ...(hub ? { manufacturingSystemId: hub.buildSystemId } : {}),
              })
            }}
          >
            {HUBS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        {sde && (
          <label className="flex items-center gap-2 text-sm">
            Mfg system
            <ManufacturingSystemPicker
              value={settings.manufacturingSystemId}
              onChange={(systemId) => updateSettings({ manufacturingSystemId: systemId })}
              systems={sde.systems}
              regions={sde.regions}
            />
          </label>
        )}

        <span className="text-xs opacity-50">Window:</span>
        {(['1d', '1w', '1m', '1y', 'all'] as TimeRange[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`btn btn-xs ${timeRange === r ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setTimeRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {(['t1', 't2', 'faction', 'all'] as BlueprintFilterTier[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`category-chip ${tier === t ? 'btn-primary' : 'btn-ghost border border-eve-border'}`}
            onClick={() => setTier(t)}
          >
            {t !== 'all' ? <EveImage id={TIER_TYPE_IDS[t]} size={20} framed alt="" /> : null}
            {TIER_FILTER_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <label className="flex items-center gap-2 text-sm min-w-0">
          Group
          <ProductGroupPicker
            value={productGroup}
            onChange={setProductGroup}
            tree={productGroupTree}
          />
          <InfoTooltip text="Search by group, category, or item name. Rankings reset to All groups when you change tier." />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <SetupBudgetRange
          minSlider={budgetMinSlider}
          maxSlider={budgetMaxSlider}
          onChange={setBudgetRange}
          className="flex-1 min-w-[min(100%,20rem)] max-w-xl"
        />

        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={buildableOnly}
            onChange={(e) => setBuildableOnly(e.target.checked)}
          />
          <span className="label-text text-sm">Only buildable</span>
          <InfoTooltip text="Checks Industry and other skills you entered on your account." />
        </label>

        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={includeHaulCost}
            onChange={(e) => setIncludeHaulCost(e.target.checked)}
          />
          <span className="label-text text-sm">Include hauling</span>
          <InfoTooltip text="Haul in (materials to build system) is added to setup cost; haul out (products to hub) is subtracted from profit. Turn off if you build and sell locally or haul on your own." />
        </label>

        <span className="text-xs opacity-60 ml-auto">{rows.length} shown</span>
      </div>

      {rows.length === 0 && (
        <p className="text-sm opacity-60 mb-4">
          No blueprints match filters. Try widening the setup budget, changing hub/region, picking another group, relaxing tier filters
          {timeRange !== 'all'
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
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Profit"
                    sortKey="netProfit"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="ISK/hr"
                    sortKey="iph"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  >
                    <InfoTooltip text={`Profit and ISK/hr use min(production/day, market volume/day) × profit per unit, scaled down when your production share exceeds daily market volume (competition penalty). Batch runs are capped at ${MAX_DAYS_TO_CLEAR} days of average hub volume.`} />
                  </SortableTh>
                  <SortableTh
                    label="Margin"
                    sortKey="margin"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Vol/day"
                    sortKey="avgVolume"
                    activeKey={sortKey}
                    direction={sortDirection}
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
          hub={settings.primaryHub}
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
