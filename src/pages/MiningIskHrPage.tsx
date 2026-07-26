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
import { getBuyPricesForTypes, getAvgVolumesForTypes, getPricesForTypes } from '@/services/market/marketService'
import {
  MINING_SPACES,
  MINING_SUBTYPES,
  collectMiningPriceTypeIds,
  miningVolumeLabel,
  rankMiningIph,
  sortMiningRows,
  spaceLabel,
} from '@/lib/miningIph'
import { formatIsk, formatQuantity } from '@/lib/profit'
import { appRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'
import { HUBS, type MiningIphSortKey, type MiningRankedRow, type MiningSpaceClass, type MiningSubtype, type TimeRange } from '@/types'
import { PageHeader, LoadingState } from '@/components/Layout'
import { EveImage } from '@/components/EveImage'
import { FilterSection } from '@/components/EconomicsFilterSection'
import { MiningIphBreakdownModal } from '@/components/MiningIphBreakdownModal'
import { CopyNameButton } from '@/components/CopyNameButton'
import { Tooltip } from '@/components/Tooltip'

const TIME_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']

const PRICE_METHODS = [
  { id: 'sell_orders' as const, label: 'Sell' },
  { id: 'buy_orders' as const, label: 'Buy' },
]

function FilterChip({
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
      className={`category-chip ${active ? 'btn-primary' : 'btn-ghost border border-eve-border'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SortHeader({
  label,
  active,
  onClick,
  align = 'right',
}: {
  label: string
  active: boolean
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        className={`font-semibold ${active ? 'text-primary' : 'opacity-70 hover:opacity-100'}`}
        onClick={onClick}
      >
        {label}
        {active ? ' ▾' : ''}
      </button>
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

function IphCell({ value }: { value: number | null | undefined }) {
  const empty = value == null || value <= 0
  return (
    <td className={`text-right tabular-nums ${empty ? 'opacity-40' : ''}`}>
      {empty ? '—' : formatIsk(value)}
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
  const [window, setWindow] = useState<TimeRange>(settings.priceWindow)
  const [sortKey, setSortKey] = useState<MiningIphSortKey>('raw')
  const [breakdown, setBreakdown] = useState<MiningRankedRow | null>(null)

  const hub = settings.primaryHub
  const hubName = HUBS.find((h) => h.id === hub)?.name ?? hub

  useEffect(() => {
    setWindow(settings.priceWindow)
  }, [settings.priceWindow])

  const focusOptions = useMemo(() => {
    if (!mining || subtype === 'gas') return []
    return mining.focusOutputs[subtype] ?? []
  }, [mining, subtype])

  useEffect(() => {
    if (subtype === 'gas') {
      setFocusTypeId(null)
      setSortKey((prev) => (prev === 'focus' ? 'raw' : prev))
      return
    }
    if (focusTypeId == null) return
    if (!focusOptions.some((o) => o.typeId === focusTypeId)) {
      setFocusTypeId(null)
      setSortKey((prev) => (prev === 'focus' ? 'raw' : prev))
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

  const missingSellIds = useMemo(() => {
    if (!staticSpot || !miningTypeIds.length) return [] as number[]
    return miningTypeIds.filter((id) => !(staticSpot.get(id) && staticSpot.get(id)! > 0))
  }, [staticSpot, miningTypeIds])

  const missingBuyIds = useMemo(() => {
    if (settings.priceMethod !== 'buy_orders' || !miningTypeIds.length) return [] as number[]
    return miningTypeIds.filter((id) => !(staticBuy?.get(id) && staticBuy.get(id)! > 0))
  }, [settings.priceMethod, miningTypeIds, staticBuy])

  const { data: liveSellPrices } = useQuery({
    queryKey: ['mining-live-sell', hub, missingSellIds.join(',')],
    queryFn: () => getPricesForTypes(missingSellIds, hub),
    enabled: missingSellIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const { data: liveBuyPrices } = useQuery({
    queryKey: ['mining-live-buy', hub, missingBuyIds.join(',')],
    queryFn: () => getBuyPricesForTypes(missingBuyIds, hub),
    enabled: missingBuyIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const spotPrices = useMemo(() => {
    if (!staticSpot) return null
    if (!liveSellPrices?.size) return staticSpot
    const merged = new Map(staticSpot)
    for (const [id, price] of liveSellPrices) {
      if (price > 0) merged.set(id, price)
    }
    return merged
  }, [staticSpot, liveSellPrices])

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
    queryKey: ['mining-live-vol', hub, window, missingVolumeIds.join(',')],
    queryFn: () => getAvgVolumesForTypes(missingVolumeIds, hub, window),
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
      const prev = existing[window]
      products[key] = {
        ...existing,
        [window]: {
          avgPrice: prev?.avgPrice ?? 0,
          avgVolume,
          high: prev?.high ?? 0,
          low: prev?.low ?? 0,
        },
      }
      changed = true
    }
    return changed ? { ...hubMarket, products } : hubMarket
  }, [hubMarket, liveVolumes, window])

  // Economics only — ignore sortKey so header clicks stay cheap.
  const rankedRows = useMemo(() => {
    if (!mining || !hubMarketWithVolumes || !spotPrices) return []
    return rankMiningIph(mining, hubMarketWithVolumes, spotPrices, buyPrices, typeMap, {
      subtype,
      foundIn,
      focusTypeId,
      window,
      priceMethod: settings.priceMethod,
      m3PerHr: mining.defaults.m3PerHr,
      reprocessYield: mining.defaults.reprocessYield,
    })
  }, [
    mining,
    hubMarketWithVolumes,
    spotPrices,
    buyPrices,
    typeMap,
    subtype,
    foundIn,
    focusTypeId,
    window,
    settings.priceMethod,
  ])

  const rows = useMemo(
    () => sortMiningRows(rankedRows, sortKey, true),
    [rankedRows, sortKey],
  )

  const focusName =
    focusTypeId != null ? focusOptions.find((o) => o.typeId === focusTypeId)?.name ?? null : null

  const m3PerHr = mining?.defaults.m3PerHr ?? 40_000
  const reprocessYield = mining?.defaults.reprocessYield ?? 0.5
  const volLabel = miningVolumeLabel(window)

  const subtitleParts = [
    focusName ? `Best for ${focusName}` : 'Ranked by ISK/hr',
    hubName,
    settings.priceMethod === 'buy_orders' ? 'buy orders' : 'sell orders',
    `window ${window}`,
    `${Math.round(reprocessYield * 100)}% reprocess · ${m3PerHr.toLocaleString()} m³/hr`,
  ]

  function toggleFound(space: MiningSpaceClass) {
    startTransition(() => {
      setFoundIn((prev) =>
        prev.includes(space) ? prev.filter((s) => s !== space) : [...prev, space],
      )
    })
  }

  function onWindowChange(next: TimeRange) {
    startTransition(() => {
      setWindow(next)
      updateSettings({ priceWindow: next })
    })
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
      setSortKey(next != null ? 'focus' : 'raw')
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

  return (
    <div>
      <PageHeader title="Mining" subtitle={subtitleParts.join(' · ')} />

      <div className="flex flex-col gap-4 mb-4">
        <FilterSection title="Subtype" hint="Moon goo, belt ore, ice, or harvestable gas.">
          <div className="flex flex-wrap gap-2">
            {MINING_SUBTYPES.map((s) => (
              <FilterChip
                key={s.id}
                active={subtype === s.id}
                onClick={() => onSubtypeChange(s.id)}
              >
                {s.label}
              </FilterChip>
            ))}
          </div>
        </FilterSection>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FilterSection title="Window" hint="Price history window (same as Blueprints).">
            <div className="flex flex-wrap gap-2">
              {TIME_WINDOWS.map((w) => (
                <FilterChip key={w} active={window === w} onClick={() => onWindowChange(w)}>
                  {w}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          <FilterSection
            title="Price"
            hint="Sell = window average. Buy = instant sell to buy orders."
          >
            <div className="flex flex-wrap gap-2">
              {PRICE_METHODS.map((m) => (
                <FilterChip
                  key={m.id}
                  active={settings.priceMethod === m.id}
                  onClick={() => onPriceMethodChange(m.id)}
                >
                  {m.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Found in" hint="Filter by where the item can spawn. None selected = all.">
            <div className="flex flex-wrap gap-2">
              {MINING_SPACES.map((s) => (
                <FilterChip
                  key={s.id}
                  active={foundIn.includes(s.id)}
                  onClick={() => toggleFound(s.id)}
                >
                  {s.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>
        </div>

        {subtype !== 'gas' ? (
          <FilterSection
            title="Material"
            hint="Rank by one reprocess output (e.g. Mexallon). All = total reprocess ISK/hr."
          >
            <div className="flex flex-wrap gap-2">
              <FilterChip active={focusTypeId == null} onClick={() => onFocusChange(null)}>
                All
              </FilterChip>
              {focusOptions.map((o) => (
                <FilterChip
                  key={o.typeId}
                  active={focusTypeId === o.typeId}
                  onClick={() => onFocusChange(o.typeId)}
                >
                  {o.name}
                </FilterChip>
              ))}
            </div>
          </FilterSection>
        ) : null}
      </div>

      <p className="text-xs opacity-60 mb-2">
        {rows.length} shown · sorted by{' '}
        {sortKey === 'focus' && focusName
          ? `${focusName} ISK/hr`
          : sortKey === 'raw'
            ? 'Raw ISK/hr'
            : sortKey === 'compressed'
              ? 'Compressed ISK/hr'
              : sortKey === 'vol'
                ? volLabel
                : 'Minerals ISK/hr'}
      </p>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-eve-border">
        <table className="table table-compact w-full">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Name</th>
              <th>Found</th>
              <SortHeader label="Raw ISK/hr" active={sortKey === 'raw'} onClick={() => onSort('raw')} />
              <SortHeader
                label="Comp ISK/hr"
                active={sortKey === 'compressed'}
                onClick={() => onSort('compressed')}
              />
              <SortHeader
                label="Mins ISK/hr"
                active={sortKey === 'minerals'}
                onClick={() => onSort('minerals')}
              />
              {focusTypeId != null && focusName ? (
                <SortHeader
                  label={`${focusName} ISK/hr`}
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
                  <MiningItemName row={row} onOpenBreakdown={() => setBreakdown(row)} />
                </td>
                <td>
                  <span className="text-xs opacity-70 whitespace-nowrap">
                    {row.item.foundIn.map(spaceLabel).join(' ')}
                  </span>
                </td>
                <IphCell value={row.rawIph} />
                <IphCell value={row.compressedIph} />
                <IphCell value={row.mineralsIph} />
                {focusTypeId != null ? <IphCell value={row.focusIph} /> : null}
                <td className="text-right tabular-nums text-xs opacity-70">
                  {formatQuantity(row.volDay)}
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
            className="rounded-lg border border-eve-border bg-base-200/40 p-3"
          >
            <div className="flex items-center gap-2 min-w-0 mb-2">
              <span className="text-xs opacity-50 tabular-nums">#{index + 1}</span>
              <MiningItemName row={row} onOpenBreakdown={() => setBreakdown(row)} />
            </div>
            <p className="text-[11px] opacity-60 mb-2">
              Found {row.item.foundIn.map(spaceLabel).join(' ')} · {volLabel}{' '}
              {formatQuantity(row.volDay)}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <MobileIph label="Raw" value={row.rawIph} />
              <MobileIph label="Comp" value={row.compressedIph} />
              <MobileIph label="Mins" value={row.mineralsIph} />
              {focusTypeId != null && focusName ? (
                <MobileIph label={focusName} value={row.focusIph} />
              ) : null}
            </div>
          </article>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-8">No items match these filters.</p>
        ) : null}
      </div>

      <MiningIphBreakdownModal
        row={breakdown}
        m3PerHr={m3PerHr}
        reprocessYield={reprocessYield}
        focusTypeId={focusTypeId}
        window={window}
        onClose={() => setBreakdown(null)}
      />
    </div>
  )
}

function MobileIph({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  const empty = value == null || value <= 0
  return (
    <div className={`flex justify-between gap-2 ${empty ? 'opacity-40' : ''}`}>
      <span className="opacity-60 text-xs">{label}</span>
      <span className="tabular-nums font-medium">{empty ? '—' : formatIsk(value)}</span>
    </div>
  )
}
