import { useEffect, useMemo, useState, startTransition, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { useMiningData } from '@/hooks/useMiningData'
import {
  buildBuyPriceMap,
  buildPriceMap,
  buildTypeMap,
  getHubMarket,
} from '@/services/data/sdeLoader'
import { getBuyPricesForTypes, getAvgVolumesForTypes } from '@/services/market/marketService'
import {
  MINING_SPACES,
  MINING_SUBTYPES,
  collectMiningPriceTypeIds,
  DEFAULT_MINING_IPH_SORT_KEY,
  MINING_IPH_PATHS,
  miningDisplayVolume,
  miningPathDisplayIph,
  miningVolumeLabel,
  rankMiningIph,
  sortMiningRows,
  type MiningIphFocusPath,
} from '@/lib/miningIph'
import {
  normalizeMiningShipId,
  normalizeMiningBoostSpace,
  normalizeMiningFleetSize,
  inferMiningBoostSpace,
  toggleMiningBuffId,
  resolveUserMiningM3PerHr,
} from '@/lib/miningShipPresets'
import { formatIsk, formatQuantity } from '@/lib/profit'
import { buildWindowPriceMap } from '@/lib/ranking'
import { appRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'
import { GLOBAL_SETTING_TOOLTIPS } from '@/lib/globalSettingsFields'
import { hubDisplayName } from '@/lib/hubDisplay'
import { HUBS, DEFAULT_SETTINGS, type MiningBuffId, type MiningIphSortKey, type MiningRankedRow, type MiningShipId, type MiningSpaceClass, type MiningSubtype, type TimeRange } from '@/types'
import { PageHeader, LoadingState } from '@/components/Layout'
import { EveImage } from '@/components/EveImage'
import { InfoTooltip } from '@/components/InfoTooltip'
import { MiningIphBreakdownModal } from '@/components/MiningIphBreakdownModal'
import { MiningSpaceBadges, MiningSpaceDot } from '@/components/MiningSpaceBadges'
import { CopyNameButton } from '@/components/CopyNameButton'
import { Tooltip } from '@/components/Tooltip'
import { MiningSetupFilterSection } from '@/components/MiningSetupFilterSection'
import { FilterSection } from '@/components/EconomicsFilterSection'
import { FormFieldLabel } from '@/components/FormFieldLabel'

const TIME_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']

const PRICE_METHODS = [
  { id: 'sell_orders' as const, label: 'Sell' },
  { id: 'buy_orders' as const, label: 'Buy' },
]

/** Representative type icons for subtype tiles (Veldspar, Bitumens, Clear Icicle, Amber Cytoserocin). */
const SUBTYPE_ICON_IDS: Record<MiningSubtype, number> = {
  ore: 1230,
  moon: 45490,
  ice: 16262,
  gas: 25275,
}

const SUBTYPE_HINT = 'Moon goo, belt ore, ice, or harvestable gas.'
const FOUND_IN_HINT =
  'Item must spawn in every selected space (AND). None selected = all spaces.'
const MATERIAL_HINT =
  'Rank ores by how much of one reprocess output you get per hour (e.g. Mexallon/hr). All = total reprocess ISK/hr.'
const PRICE_METHOD_HINT =
  'Sell = hub average for the selected window. Buy = instant sell to buy orders (window applies to reprocess minerals only).'

function FiltersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/** Primary pickers: same category-chip language as Blueprints tier tiles. */
function CategoryChip({
  active,
  onClick,
  children,
  tall = false,
  className = '',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tall?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`category-chip ${active ? 'btn-primary' : 'btn-ghost'} ${
        tall ? 'flex-col gap-1.5 min-h-[4.5rem] py-2.5' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Compact segmented control like Plan price window / economics bar. */
function SegmentChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`mining-filters__seg${active ? ' mining-filters__seg--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function FilterLabel({
  label,
  hint,
}: {
  label: string
  hint?: string
}) {
  return (
    <span className="mining-filters__label">
      {label}
      {hint ? <InfoTooltip text={hint} /> : null}
    </span>
  )
}

function SortHeader({
  label,
  tooltip,
  active,
  onClick,
  align = 'right',
}: {
  label: string
  tooltip?: string
  active: boolean
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th className={align === 'right' ? 'text-right' : undefined}>
      <div className={`flex items-center gap-0.5 ${align === 'right' ? 'justify-end' : ''}`}>
        <button
          type="button"
          className={`font-semibold ${active ? 'text-primary' : 'opacity-70 hover:opacity-100'}`}
          onClick={onClick}
        >
          {label}
          {active ? ' ▾' : ''}
        </button>
        {tooltip ? <InfoTooltip text={tooltip} placement="top" /> : null}
      </div>
    </th>
  )
}

function BreakdownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="3.5" cy="4" r="1.75" strokeWidth="1.5" />
      <circle cx="12.5" cy="4" r="1.75" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="1.75" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeWidth="1.5" d="M5 5.2 6.8 10.5M11 5.2 9.2 10.5" />
    </svg>
  )
}

function IphCell({
  value,
  onClick,
  ariaLabel,
}: {
  value: number | null | undefined
  onClick?: () => void
  ariaLabel?: string
}) {
  const empty = value == null || value <= 0
  const className = `text-right tabular-nums ${empty ? 'opacity-40' : ''}`

  if (empty || !onClick) {
    return (
      <td className={className}>
        {empty ? '—' : formatIsk(value)}
      </td>
    )
  }

  return (
    <td className={className}>
      <button
        type="button"
        className={textLinkClass('tabular-nums')}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {formatIsk(value)}
      </button>
    </td>
  )
}

function QtyPerHrCell({ value }: { value: number | null | undefined }) {
  const empty = value == null || value <= 0
  return (
    <td className={`text-right tabular-nums ${empty ? 'opacity-40' : ''}`}>
      {empty ? '—' : formatQuantity(value)}
    </td>
  )
}

function MiningItemName({
  row,
  onOpenBreakdown,
}: {
  row: MiningRankedRow
  onOpenBreakdown: () => void
}) {
  const itemHref = appRoute(`item/${row.item.typeId}`)
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <EveImage id={row.item.typeId} size={28} framed alt="" className="shrink-0" />
      <CopyNameButton text={row.item.name} />
      <a
        href={itemHref}
        target="_blank"
        rel="noopener noreferrer"
        className={textLinkClass('text-sm truncate leading-snug min-w-0')}
        title={`${row.item.name} (market)`}
      >
        {row.item.name}
      </a>
      <Tooltip text="Open ISK/hr breakdown" placement="top">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square shrink-0 min-h-0 h-6 w-6 opacity-70 hover:opacity-100"
          aria-label={`Open ISK/hr breakdown for ${row.item.name}`}
          onClick={onOpenBreakdown}
        >
          <BreakdownIcon className="size-3.5" />
        </button>
      </Tooltip>
    </div>
  )
}

export function MiningIskHrPage() {
  const settings = useAppStore((s) => s.userData.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const { data: mining, isLoading: miningLoading, error: miningError } = useMiningData()

  const [subtype, setSubtype] = useState<MiningSubtype>('ore')
  const [foundIn, setFoundIn] = useState<MiningSpaceClass[]>([])
  const [focusTypeId, setFocusTypeId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<MiningIphSortKey>(DEFAULT_MINING_IPH_SORT_KEY)
  const [breakdown, setBreakdown] = useState<{
    row: MiningRankedRow
    focusPath: MiningIphFocusPath
  } | null>(null)

  const hub = settings.primaryHub
  const hubName = hubDisplayName(hub)
  const priceWindow = settings.priceWindow ?? DEFAULT_SETTINGS.priceWindow

  const focusOptions = useMemo(() => {
    if (!mining || subtype === 'gas') return []
    return mining.focusOutputs[subtype] ?? []
  }, [mining, subtype])

  useEffect(() => {
    if (subtype === 'gas') {
      setFocusTypeId(null)
      setSortKey((prev) => (prev === 'focus' ? DEFAULT_MINING_IPH_SORT_KEY : prev))
      return
    }
    if (focusTypeId == null) return
    if (!focusOptions.some((o) => o.typeId === focusTypeId)) {
      setFocusTypeId(null)
      setSortKey((prev) => (prev === 'focus' ? DEFAULT_MINING_IPH_SORT_KEY : prev))
    }
  }, [subtype, focusOptions, focusTypeId])

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const hubMarket = useMemo(() => (sde ? getHubMarket(sde.market, hub) : null), [sde, hub])
  const staticSpot = useMemo(() => (hubMarket ? buildPriceMap(hubMarket) : null), [hubMarket])
  const staticBuy = useMemo(() => (hubMarket ? buildBuyPriceMap(hubMarket) : null), [hubMarket])

  const miningTypeIds = useMemo(
    () => (mining ? collectMiningPriceTypeIds(mining, subtype) : []),
    [mining, subtype],
  )

  const missingBuyIds = useMemo(() => {
    if (settings.priceMethod !== 'buy_orders' || !miningTypeIds.length) return [] as number[]
    return miningTypeIds.filter((id) => !(staticBuy?.get(id) && staticBuy.get(id)! > 0))
  }, [settings.priceMethod, miningTypeIds, staticBuy])

  const { data: liveBuyPrices } = useQuery({
    queryKey: ['mining-live-buy', hub, missingBuyIds.join(',')],
    queryFn: () => getBuyPricesForTypes(missingBuyIds, hub),
    enabled: missingBuyIds.length > 0,
    staleTime: 5 * 60_000,
  })

  /** Hub window averages — same path as Blueprints / Plan (buildWindowPriceMap on static hub data). */
  const windowSell = useMemo(() => {
    if (!hubMarket) return null
    return buildWindowPriceMap(hubMarket, priceWindow, buildPriceMap(hubMarket))
  }, [hubMarket, priceWindow])

  const buyPrices = useMemo(() => {
    const base = staticBuy ?? new Map<number, number>()
    if (!liveBuyPrices?.size) return base
    const merged = new Map(base)
    for (const [id, price] of liveBuyPrices) {
      if (price > 0) merged.set(id, price)
    }
    return merged
  }, [staticBuy, liveBuyPrices])

  // Compressed ores trade at hubs; static market.json often lacks their ESI history.
  const missingVolumeIds = useMemo(() => {
    if (!mining || !hubMarket) return [] as number[]
    const ids: number[] = []
    for (const item of mining.items) {
      if (item.subtype !== subtype) continue
      if (item.compressedTypeId == null) continue
      if (!hubMarket.products[String(item.compressedTypeId)]) {
        ids.push(item.compressedTypeId)
      }
    }
    return [...new Set(ids)]
  }, [mining, hubMarket, subtype])

  const { data: liveVolumes } = useQuery({
    queryKey: ['mining-live-vol', hub, priceWindow, missingVolumeIds.join(',')],
    queryFn: () => getAvgVolumesForTypes(missingVolumeIds, hub, priceWindow),
    enabled: missingVolumeIds.length > 0,
    staleTime: 30 * 60_000,
  })

  const hubMarketWithVolumes = useMemo(() => {
    if (!hubMarket) return null
    if (!liveVolumes?.size) return hubMarket
    const products = { ...hubMarket.products }
    let changed = false
    for (const [typeId, avgVolume] of liveVolumes) {
      if (!(avgVolume > 0)) continue
      const key = String(typeId)
      const existing = products[key] ?? {}
      const prev = existing[priceWindow]
      products[key] = {
        ...existing,
        [priceWindow]: {
          avgPrice: prev?.avgPrice ?? 0,
          avgVolume,
          high: prev?.high ?? 0,
          low: prev?.low ?? 0,
        },
      }
      changed = true
    }
    return changed ? { ...hubMarket, products } : hubMarket
  }, [hubMarket, liveVolumes, priceWindow])

  useEffect(() => {
    const current = settings.miningShipId ?? 'retriever'
    const normalized = normalizeMiningShipId(current, subtype)
    if (normalized !== current) {
      updateSettings({ miningShipId: normalized })
    }
  }, [subtype, settings.miningShipId, updateSettings])

  const miningShipId = normalizeMiningShipId(settings.miningShipId, subtype)
  const miningBuffIds = settings.miningBuffIds ?? []
  const miningFleetSize = normalizeMiningFleetSize(settings.miningFleetSize)
  const miningBoostSpace = inferMiningBoostSpace(
    miningBuffIds,
    normalizeMiningBoostSpace(settings.miningBoostSpace),
  )
  const m3PerHr = resolveUserMiningM3PerHr(
    subtype,
    miningShipId,
    miningBuffIds,
    miningBoostSpace,
    miningFleetSize,
  )

  const rankedRows = useMemo(() => {
    if (!mining || !hubMarketWithVolumes || !windowSell) return []
    return rankMiningIph(mining, hubMarketWithVolumes, staticSpot ?? new Map(), buyPrices, typeMap, {
      subtype,
      foundIn,
      focusTypeId,
      window: priceWindow,
      priceMethod: settings.priceMethod,
      sellPrices: windowSell,
      reprocessYield: mining.defaults.reprocessYield,
      m3PerHr,
    })
  }, [
    mining,
    hubMarketWithVolumes,
    windowSell,
    staticSpot,
    buyPrices,
    typeMap,
    subtype,
    foundIn,
    focusTypeId,
    priceWindow,
    settings.priceMethod,
    m3PerHr,
  ])

  const rows = useMemo(
    () => sortMiningRows(rankedRows, sortKey, true),
    [rankedRows, sortKey],
  )

  const breakdownRow = useMemo(() => {
    if (!breakdown) return null
    return rows.find((r) => r.item.typeId === breakdown.row.item.typeId) ?? breakdown.row
  }, [breakdown, rows])

  const focusName =
    focusTypeId != null ? focusOptions.find((o) => o.typeId === focusTypeId)?.name ?? null : null

  const reprocessYield = mining?.defaults.reprocessYield ?? 0.5
  const volLabel = miningVolumeLabel(priceWindow)

  const subtitleParts = [
    focusName ? `Best for ${focusName}` : 'Ranked by ISK/hr',
    hubName,
    settings.priceMethod === 'buy_orders' ? 'buy orders' : 'sell orders',
    `window ${priceWindow}`,
    `${Math.round(reprocessYield * 100)}% reprocess · ${m3PerHr.toLocaleString()} m³/hr`,
  ]

  function toggleFound(space: MiningSpaceClass) {
    startTransition(() => {
      setFoundIn((prev) =>
        prev.includes(space) ? prev.filter((s) => s !== space) : [...prev, space],
      )
    })
  }

  function onPriceWindowChange(next: TimeRange) {
    if (next === priceWindow) return
    setBreakdown(null)
    updateSettings({ priceWindow: next })
  }

  function onPriceMethodChange(next: (typeof PRICE_METHODS)[number]['id']) {
    startTransition(() => updateSettings({ priceMethod: next }))
  }

  function onSubtypeChange(next: MiningSubtype) {
    startTransition(() => setSubtype(next))
  }

  function onSort(key: MiningIphSortKey) {
    startTransition(() => setSortKey(key))
  }

  function onFocusChange(next: number | null) {
    startTransition(() => {
      setFocusTypeId(next)
      setSortKey(next != null ? 'focus' : DEFAULT_MINING_IPH_SORT_KEY)
    })
  }

  function openBreakdown(row: MiningRankedRow, focusPath: MiningIphFocusPath = 'raw') {
    setBreakdown({ row, focusPath })
  }

  function onMiningFleetSizeChange(next: number) {
    startTransition(() => updateSettings({ miningFleetSize: normalizeMiningFleetSize(next) }))
  }

  function onMiningShipChange(next: MiningShipId) {
    startTransition(() => updateSettings({ miningShipId: next }))
  }

  function onMiningBuffToggle(id: MiningBuffId) {
    startTransition(() => {
      const prev = settings.miningBuffIds ?? []
      const next = toggleMiningBuffId(prev, id)
      updateSettings({
        miningBuffIds: next,
        miningBoostSpace: inferMiningBoostSpace(
          next,
          normalizeMiningBoostSpace(settings.miningBoostSpace),
        ),
      })
    })
  }

  if (sdeLoading || miningLoading) return <LoadingState />

  if (miningError || !mining) {
    return (
      <div>
        <PageHeader title="Mining" subtitle="Failed to load mining data" />
        <p className="text-sm opacity-70">
          Run <code className="text-primary">pnpm run rebuild-mining</code> to generate{' '}
          <code>public/data/mining.json</code>.
        </p>
      </div>
    )
  }

  const sortLabel =
    sortKey === 'focus' && focusName
      ? `${focusName}/hr`
      : sortKey === 'raw'
        ? MINING_IPH_PATHS.raw.label
        : sortKey === 'compressed'
          ? MINING_IPH_PATHS.compressed.label
          : sortKey === 'vol'
            ? volLabel
            : sortKey === 'minerals'
              ? MINING_IPH_PATHS.minerals.label
              : MINING_IPH_PATHS.raw.label

  return (
    <div>
      <PageHeader title="Mining" subtitle={subtitleParts.join(' · ')} />

      <section className="blueprint-filters" aria-label="Mining filters">
        <header className="blueprint-filters__header">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mining-filters__header-icon shrink-0" aria-hidden>
              <FiltersIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="blueprint-filters__title">Filters</h2>
              <p className="blueprint-filters__subtitle">
                What to mine, market window, and reprocess focus
              </p>
            </div>
          </div>
          <span className="badge badge-primary badge-sm badge-outline border-primary/30 tabular-nums font-normal shrink-0">
            {rows.length} shown · {sortLabel}
          </span>
        </header>

        <div className="blueprint-filters__body">
          <FilterSection
            title="What to mine"
            hint="Ore, moon goo, ice, or gas"
            className="blueprint-filters__card"
          >
            <div className="mining-filters__section">
              <FormFieldLabel label="Type" tooltip={SUBTYPE_HINT} size="sm" />
              <div
                role="group"
                aria-label="Mining subtype"
                className="mining-filters__type-grid"
              >
                {MINING_SUBTYPES.map((s) => (
                  <CategoryChip
                    key={s.id}
                    tall
                    active={subtype === s.id}
                    onClick={() => onSubtypeChange(s.id)}
                    className="min-w-0 justify-center"
                  >
                    <span className="rounded-md bg-base-100/90 p-1 shadow-sm">
                      <EveImage
                        id={SUBTYPE_ICON_IDS[s.id]}
                        size={40}
                        framed
                        alt=""
                        lazy={false}
                      />
                    </span>
                    <span className="text-xs font-medium">{s.label}</span>
                  </CategoryChip>
                ))}
              </div>
            </div>
          </FilterSection>

          <div className="blueprint-filters__market">
            <div className="blueprint-filters__market-head">
              <h3 className="text-sm font-semibold leading-tight">Market pricing</h3>
              <p className="text-xs opacity-50 hidden sm:block">Hub is in the navbar</p>
            </div>

            <div className="mining-filters__market-group">
              <FilterLabel label="Window" hint={GLOBAL_SETTING_TOOLTIPS.priceWindow} />
              <div role="group" aria-label="Price window" className="mining-filters__seg-group">
                {TIME_WINDOWS.map((w) => (
                  <SegmentChip
                    key={w}
                    active={priceWindow === w}
                    onClick={() => onPriceWindowChange(w)}
                  >
                    {w}
                  </SegmentChip>
                ))}
              </div>
            </div>

            <div className="mining-filters__market-group">
              <FilterLabel label="Price" hint={PRICE_METHOD_HINT} />
              <div role="group" aria-label="Price method" className="mining-filters__seg-group">
                {PRICE_METHODS.map((m) => (
                  <SegmentChip
                    key={m.id}
                    active={settings.priceMethod === m.id}
                    onClick={() => onPriceMethodChange(m.id)}
                  >
                    {m.label}
                  </SegmentChip>
                ))}
              </div>
            </div>

            <div className="mining-filters__market-group mining-filters__market-group--end">
              <FilterLabel label="Found in" hint={FOUND_IN_HINT} />
              <div role="group" aria-label="Found in" className="mining-filters__seg-group">
                {MINING_SPACES.map((s) => (
                  <SegmentChip
                    key={s.id}
                    active={foundIn.includes(s.id)}
                    onClick={() => toggleFound(s.id)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <MiningSpaceDot space={s.id} />
                      {s.label}
                    </span>
                  </SegmentChip>
                ))}
              </div>
            </div>
          </div>

          {subtype !== 'gas' ? (
            <FilterSection
              title="Reprocess focus"
              hint="Rank by one output mineral, or All for total ISK/hr"
              className="blueprint-filters__card"
            >
              <div className="mining-filters__section">
                <FormFieldLabel label="Material" tooltip={MATERIAL_HINT} size="sm" />
                <div
                  role="group"
                  aria-label="Reprocess material focus"
                  className="mining-filters__material-row"
                >
                  <CategoryChip
                    active={focusTypeId == null}
                    onClick={() => onFocusChange(null)}
                  >
                    All
                  </CategoryChip>
                  {focusOptions.map((o) => (
                    <CategoryChip
                      key={o.typeId}
                      active={focusTypeId === o.typeId}
                      onClick={() => onFocusChange(o.typeId)}
                    >
                      <EveImage id={o.typeId} size={20} framed alt="" lazy={false} />
                      {o.name}
                    </CategoryChip>
                  ))}
                </div>
              </div>
            </FilterSection>
          ) : null}

          <MiningSetupFilterSection
            subtype={subtype}
            shipId={miningShipId}
            buffIds={miningBuffIds}
            boostSpace={miningBoostSpace}
            fleetSize={miningFleetSize}
            onShipChange={onMiningShipChange}
            onBuffToggle={onMiningBuffToggle}
            onFleetSizeChange={onMiningFleetSizeChange}
          />
        </div>
      </section>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-eve-border/90 bg-base-200/70 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.04),0_8px_24px_-12px_rgb(0_0_0_/_0.55)]">
        <table className="table table-compact table-striped w-full">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Name</th>
              <th>Found</th>
              <SortHeader
                label={MINING_IPH_PATHS.raw.label}
                tooltip={MINING_IPH_PATHS.raw.tooltip}
                active={sortKey === 'raw'}
                onClick={() => onSort('raw')}
              />
              <SortHeader
                label={MINING_IPH_PATHS.compressed.label}
                tooltip={MINING_IPH_PATHS.compressed.tooltip}
                active={sortKey === 'compressed'}
                onClick={() => onSort('compressed')}
              />
              <SortHeader
                label={MINING_IPH_PATHS.minerals.label}
                tooltip={MINING_IPH_PATHS.minerals.tooltip}
                active={sortKey === 'minerals'}
                onClick={() => onSort('minerals')}
              />
              {focusTypeId != null && focusName ? (
                <SortHeader
                  label={`${focusName}/hr`}
                  active={sortKey === 'focus'}
                  onClick={() => onSort('focus')}
                />
              ) : null}
              <SortHeader label={volLabel} active={sortKey === 'vol'} onClick={() => onSort('vol')} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.item.typeId} className="hover:bg-base-200/80">
                <td className="tabular-nums opacity-60">{index + 1}</td>
                <td>
                  <MiningItemName row={row} onOpenBreakdown={() => openBreakdown(row)} />
                </td>
                <td>
                  <MiningSpaceBadges spaces={row.item.foundIn} />
                </td>
                <IphCell
                  value={miningPathDisplayIph('raw', row)}
                  onClick={() => openBreakdown(row, 'raw')}
                  ariaLabel={`Raw ISK per hour breakdown for ${row.item.name}`}
                />
                <IphCell
                  value={miningPathDisplayIph('compressed', row)}
                  onClick={() => openBreakdown(row, 'compressed')}
                  ariaLabel={`Compressed ISK per hour breakdown for ${row.item.name}`}
                />
                <IphCell
                  value={miningPathDisplayIph('minerals', row)}
                  onClick={() => openBreakdown(row, 'minerals')}
                  ariaLabel={`Reprocess ISK per hour breakdown for ${row.item.name}`}
                />
                {focusTypeId != null ? <QtyPerHrCell value={row.focusQtyPerHr} /> : null}
                <td className="text-right tabular-nums text-xs opacity-70">
                  {formatQuantity(miningDisplayVolume(row, sortKey))}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={focusTypeId != null ? 8 : 7} className="text-center opacity-60 py-8">
                  No items match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden flex flex-col gap-2">
        {rows.map((row, index) => (
          <article
            key={row.item.typeId}
            className="rounded-xl border border-eve-border/90 bg-gradient-to-br from-base-200/90 to-base-300/20 p-3 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.04),0_4px_14px_-8px_rgb(0_0_0_/_0.5)]"
          >
            <div className="flex items-center gap-2 min-w-0 mb-2">
              <span className="text-xs opacity-50 tabular-nums">#{index + 1}</span>
              <MiningItemName row={row} onOpenBreakdown={() => openBreakdown(row)} />
            </div>
            <p className="text-[11px] opacity-60 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1">
                Found <MiningSpaceBadges spaces={row.item.foundIn} />
              </span>
              <span>
                · {volLabel} {formatQuantity(miningDisplayVolume(row, sortKey))}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <MobileIph
                label={MINING_IPH_PATHS.raw.label}
                value={miningPathDisplayIph('raw', row)}
                onClick={() => openBreakdown(row, 'raw')}
              />
              <MobileIph
                label={MINING_IPH_PATHS.compressed.label}
                value={miningPathDisplayIph('compressed', row)}
                onClick={() => openBreakdown(row, 'compressed')}
              />
              <MobileIph
                label={MINING_IPH_PATHS.minerals.label}
                value={miningPathDisplayIph('minerals', row)}
                onClick={() => openBreakdown(row, 'minerals')}
              />
              {focusTypeId != null && focusName ? (
                <MobileQty label={focusName} value={row.focusQtyPerHr} />
              ) : null}
            </div>
          </article>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-8">No items match these filters.</p>
        ) : null}
      </div>

      <MiningIphBreakdownModal
        row={breakdownRow}
        initialFocusPath={breakdown?.focusPath ?? 'raw'}
        m3PerHr={m3PerHr}
        reprocessYield={reprocessYield}
        focusTypeId={focusTypeId}
        window={priceWindow}
        priceMethod={settings.priceMethod}
        typeMap={typeMap}
        onClose={() => setBreakdown(null)}
      />
    </div>
  )
}

function MobileIph({
  label,
  value,
  onClick,
}: {
  label: string
  value: number | null | undefined
  onClick?: () => void
}) {
  const empty = value == null || value <= 0
  const formatted = empty ? '—' : formatIsk(value)

  return (
    <div className={`flex justify-between gap-2 ${empty ? 'opacity-40' : ''}`}>
      <span className="opacity-60 text-xs">{label}</span>
      {empty || !onClick ? (
        <span className="tabular-nums font-medium">{formatted}</span>
      ) : (
        <button
          type="button"
          className={textLinkClass('tabular-nums font-medium')}
          onClick={onClick}
          aria-label={`${label} breakdown`}
        >
          {formatted}
        </button>
      )}
    </div>
  )
}

function MobileQty({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  const empty = value == null || value <= 0
  return (
    <div className={`flex justify-between gap-2 ${empty ? 'opacity-40' : ''}`}>
      <span className="opacity-60 text-xs">{label}/hr</span>
      <span className="tabular-nums font-medium">{empty ? '—' : formatQuantity(value)}</span>
    </div>
  )
}
