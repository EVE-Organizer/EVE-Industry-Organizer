import { Link } from 'react-router-dom'
import { EveImage } from '@/components/EveImage'
import type { MapOpportunityRow, OpportunityTag } from '@/types/map'
import { formatIsk } from '@/lib/profit'

interface MapOpportunityPanelProps {
  factoryName: string
  factorySecurity: number | null
  buyHubName: string
  rows: MapOpportunityRow[]
  selectedProductTypeId: number | null
  warLoading?: boolean
  noFactory: boolean
  onSelect: (productTypeId: number) => void
  onSetSellHub: (hubId: MapOpportunityRow['sellHubId']) => void
  onClose?: () => void
  compact?: boolean
}

const TAG_STYLE: Record<OpportunityTag, { label: string; className: string }> = {
  'WAR+SPIKE': { label: 'War + spike', className: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/35' },
  WAR: { label: 'War', className: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30' },
  SPIKE: { label: 'Spike', className: 'bg-amber-500/20 text-amber-200 border-amber-400/35' },
  IPH: { label: 'Top IPH', className: 'bg-slate-500/20 text-slate-200 border-slate-400/30' },
}

export function MapOpportunityPanel({
  factoryName,
  factorySecurity,
  buyHubName,
  rows,
  selectedProductTypeId,
  warLoading: _warLoading = false,
  noFactory,
  onSelect,
  onSetSellHub,
  onClose,
  compact = false,
}: MapOpportunityPanelProps) {
  if (noFactory) {
    return (
      <section className="rounded-xl border border-eve-border/80 bg-gradient-to-br from-base-300/80 to-base-200/40 p-3">
        <PanelHeader onClose={onClose} />
        <div className="mt-3 rounded-lg border border-dashed border-eve-border/70 bg-base-300/40 p-4 text-center">
          <p className="text-2xl leading-none">🏭</p>
          <p className="mt-2 text-xs opacity-80">Set a manufacturing system to rank opportunities on the map.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Link to="/plan" className="btn btn-xs btn-primary">
              Open plan
            </Link>
            <Link to="/settings" className="btn btn-xs btn-ghost">
              Settings
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2 min-w-0">
      <div className="rounded-xl border border-eve-border/80 bg-gradient-to-br from-sky-500/10 via-base-300/50 to-base-200/30 p-2.5">
        <PanelHeader onClose={onClose} count={rows.length} />
        <p className="mt-1 text-[10px] opacity-65 truncate">
          🏭 {factoryName}
          {factorySecurity !== null ? ` · ${factorySecurity.toFixed(2)}` : ''}
          <span className="opacity-50"> · </span>
          🛒 buy {buyHubName}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-eve-border/70 bg-base-300/40 px-3 py-4 text-center text-xs opacity-70">
          No opportunities match current filters.
        </p>
      ) : (
        <ol className="flex flex-col gap-2 list-none p-0 m-0">
          {rows.map((row, index) => (
            <OpportunityCard
              key={row.productTypeId}
              row={row}
              rank={index + 1}
              selected={row.productTypeId === selectedProductTypeId}
              compact={compact}
              onSelect={() => onSelect(row.productTypeId)}
              onSetSellHub={() => onSetSellHub(row.sellHubId)}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function PanelHeader({ onClose, count }: { onClose?: () => void; count?: number }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">✨</span>
          <h2 className="text-sm font-semibold tracking-tight">Opportunity</h2>
          {count !== undefined && count > 0 ? (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
              {count}
            </span>
          ) : null}
        </div>
        <p className="text-[10px] opacity-50 mt-0.5">Tap a row to focus the map</p>
      </div>
      {onClose ? (
        <button type="button" className="btn btn-xs btn-ghost btn-square" onClick={onClose}>
          ×
        </button>
      ) : null}
    </div>
  )
}

function OpportunityCard({
  row,
  rank,
  selected,
  compact,
  onSelect,
  onSetSellHub,
}: {
  row: MapOpportunityRow
  rank: number
  selected: boolean
  compact: boolean
  onSelect: () => void
  onSetSellHub: () => void
}) {
  const priceDelta =
    row.priceVsPrimaryPct !== 0
      ? `${row.priceVsPrimaryPct >= 0 ? '+' : ''}${row.priceVsPrimaryPct.toFixed(0)}%`
      : null

  return (
    <li>
      <article
        className={`group relative overflow-hidden rounded-xl border transition-all duration-150 ${
          selected
            ? 'border-primary/60 border-l-[3px] border-l-primary bg-primary/10'
            : 'border-eve-border/70 bg-base-300/45 hover:border-eve-border hover:bg-base-300/70'
        }`}
      >
        <button
          type="button"
          className="w-full text-left p-2.5"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <div className="flex gap-2.5">
            <div className="relative shrink-0">
              <EveImage
                id={row.productTypeId}
                variant="icon"
                size={compact ? 36 : 40}
                framed
                alt=""
                className="rounded-md"
              />
              <span
                className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  rank <= 3 ? 'bg-primary text-primary-content' : 'bg-base-content/15 text-base-content/80'
                }`}
              >
                {rank}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-xs leading-snug line-clamp-2">{row.productName}</p>
                {selected ? (
                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
                    Focus
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1">
                {row.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${TAG_STYLE[tag].className}`}
                  >
                    {TAG_STYLE[tag].label}
                  </span>
                ))}
              </div>

              <p className="mt-1.5 text-[10px] opacity-70 truncate">
                🏪 {row.sellHubName}
                {priceDelta ? <span className="text-emerald-300/90"> · {priceDelta}</span> : null}
              </p>

              <div className="mt-2 grid grid-cols-3 gap-1">
                <Metric label="IPH" value={formatIsk(row.iph)} accent />
                <Metric label="Margin" value={`${row.margin.toFixed(0)}%`} />
                <Metric
                  label="Route"
                  value={row.haulOutJumps !== null ? `${row.haulOutJumps}j` : '?'}
                  warn={row.campOnHaulOut}
                />
              </div>

              {!compact && row.warTheaterSystemNames.length > 0 ? (
                <p className="mt-1.5 text-[10px] text-fuchsia-300/90 truncate">
                  ⚔️{' '}
                  {row.warTheaterSystemNames.length > 1
                    ? `${row.warTheaterSystemNames[0]} +${row.warTheaterSystemNames.length - 1}`
                    : row.warSystemName}
                  {row.restockHubJumps !== null ? ` · restock ${row.restockHubJumps}j` : ''}
                </p>
              ) : null}
            </div>
          </div>
        </button>

        <div className="flex gap-1 border-t border-eve-border/50 px-2 py-1.5 opacity-80 group-hover:opacity-100">
          <Link
            to={`/item/${row.productTypeId}`}
            className="btn btn-xs btn-ghost h-6 min-h-6 flex-1 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            Item page
          </Link>
          <button
            type="button"
            className="btn btn-xs btn-outline h-6 min-h-6 flex-1 px-2"
            onClick={(e) => {
              e.stopPropagation()
              onSetSellHub()
            }}
          >
            Sell hub
          </button>
        </div>
      </article>
    </li>
  )
}

function Metric({
  label,
  value,
  accent = false,
  warn = false,
}: {
  label: string
  value: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-md px-1.5 py-1 text-center ${
        warn ? 'bg-warning/15' : accent ? 'bg-sky-500/10' : 'bg-base-content/5'
      }`}
    >
      <p className="text-[8px] uppercase tracking-wide opacity-50">{label}</p>
      <p
        className={`text-[10px] font-semibold tabular-nums truncate ${
          warn ? 'text-warning' : accent ? 'text-sky-200' : ''
        }`}
      >
        {value}
        {warn ? ' ⚠' : ''}
      </p>
    </div>
  )
}
