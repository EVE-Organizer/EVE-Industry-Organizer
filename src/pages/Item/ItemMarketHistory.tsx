import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HubId, MarketHistoryEntry, TimeRange } from '@/types'
import { getMarketHistory } from '@/services/market/marketService'
import { filterHistoryByRange, formatDecimal, formatIsk } from '@/lib/profit'
import { LoadingState } from '@/components/layout/Layout'
import { ItemSection } from '@/pages/Item/ItemSection'
import { ItemMetric } from '@/pages/Item/ItemMetric'

const RANGES: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']
const EMPTY_HISTORY: MarketHistoryEntry[] = []

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '0.375rem',
  padding: '8px 12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
}

const CHART_TOOLTIP_LABEL_STYLE = {
  color: '#e6edf3',
  fontWeight: 600,
  marginBottom: 4,
}

const CHART_TOOLTIP_ITEM_STYLE = {
  color: '#c9d1d9',
  fontSize: 12,
  paddingTop: 2,
}

const CHART_LEGEND = [
  { key: 'high', label: 'High', hint: 'highest trade that day', swatch: 'high' },
  { key: 'low', label: 'Low', hint: 'lowest trade that day', swatch: 'low' },
  { key: 'average', label: 'Avg', hint: 'volume-weighted average', swatch: 'average' },
  { key: 'volume', label: 'Volume', hint: 'units traded', swatch: 'volume' },
] as const

type ViewMode = 'graph' | 'table'

interface ItemMarketHistoryProps {
  title?: string
  typeId: number
  hub: HubId
  className?: string
  emptyHint?: string
  embedded?: boolean
  onLoaded?: (info: { hasHistory: boolean }) => void
}

function formatChartDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ItemMarketHistory({
  title,
  typeId,
  hub,
  className,
  emptyHint,
  embedded,
  onLoaded,
}: ItemMarketHistoryProps) {
  const [range, setRange] = useState<TimeRange>('1m')
  const [view, setView] = useState<ViewMode>('graph')

  const { data, isLoading: loading } = useQuery({
    queryKey: ['market-history', typeId, hub],
    queryFn: () => getMarketHistory(typeId, hub, 'all'),
  })
  const history = data?.history ?? EMPTY_HISTORY

  useEffect(() => {
    if (!data) return
    onLoaded?.({ hasHistory: data.history.length > 0 })
  }, [data, onLoaded])

  const chartHistory = useMemo(() => filterHistoryByRange(history, range), [history, range])

  const summary = useMemo(() => {
    if (!chartHistory.length) return null
    const avgPrice = chartHistory.reduce((s, h) => s + h.average, 0) / chartHistory.length
    const avgVolume = chartHistory.reduce((s, h) => s + h.volume, 0) / chartHistory.length
    return { avgPrice, avgVolume, days: chartHistory.length }
  }, [chartHistory])

  const chartData = useMemo(
    () =>
      [...chartHistory]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((row) => ({
          date: row.date,
          label: formatChartDate(row.date),
          average: row.average,
          high: row.highest,
          low: row.lowest,
          volume: row.volume,
        })),
    [chartHistory],
  )

  const tableRows = useMemo(
    () => [...chartHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [chartHistory],
  )

  const rangeControls = (
    <div className="item-market-history__toolbar">
      <div className="plan-view-tabs__list">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`plan-view-tabs__tab plan-view-tabs__tab--sm ${range === r ? 'plan-view-tabs__tab--active' : ''}`}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="plan-view-tabs__list">
        <button
          type="button"
          className={`plan-view-tabs__tab plan-view-tabs__tab--sm ${view === 'graph' ? 'plan-view-tabs__tab--active' : ''}`}
          onClick={() => setView('graph')}
        >
          Graph
        </button>
        <button
          type="button"
          className={`plan-view-tabs__tab plan-view-tabs__tab--sm ${view === 'table' ? 'plan-view-tabs__tab--active' : ''}`}
          onClick={() => setView('table')}
        >
          Table
        </button>
      </div>
    </div>
  )

  const summaryMetrics = summary ? (
    <dl className="item-section__metrics">
      <ItemMetric
        variant="inline"
        label="Avg price"
        tone="primary"
        value={formatIsk(summary.avgPrice)}
      />
      <ItemMetric
        variant="inline"
        label="Avg volume"
        hint="per day"
        value={formatDecimal(summary.avgVolume, 1)}
      />
      <ItemMetric variant="inline" label="Window" hint="days" value={summary.days} />
    </dl>
  ) : null

  const body = (
    <>
      {loading ? (
        <LoadingState />
      ) : chartHistory.length === 0 ? (
        <p className="text-sm text-base-content/50">
          {emptyHint ?? 'No market history for this window.'}
        </p>
      ) : (
        <>
          {embedded ? (
            <div className="item-market-history__header">
              {summaryMetrics}
              {rangeControls}
            </div>
          ) : (
            summaryMetrics
          )}

          {view === 'graph' ? (
            <>
              <div
                className={`item-chart-wrap min-w-0 w-full${embedded || title ? ' item-chart-wrap--compact' : ' h-56'}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-base-content/10" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis
                      yAxisId="price"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatIsk(v).replace(' ISK', '')}
                      width={56}
                    />
                    <YAxis yAxisId="volume" orientation="right" hide />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      cursor={{ fill: 'rgb(245 166 35 / 0.08)' }}
                      formatter={(value, name) => {
                        const num = typeof value === 'number' ? value : Number(value ?? 0)
                        if (name === 'volume') return [num, 'Volume']
                        const label =
                          name === 'average'
                            ? 'Avg'
                            : name === 'high'
                              ? 'High'
                              : name === 'low'
                                ? 'Low'
                                : String(name)
                        return [formatIsk(num), label]
                      }}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as { date?: string } | undefined
                        return row?.date ?? ''
                      }}
                    />
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      fill="oklch(var(--p) / 0.25)"
                      barSize={6}
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="high"
                      stroke="oklch(var(--su) / 0.5)"
                      dot={false}
                      strokeWidth={1}
                      name="high"
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="low"
                      stroke="oklch(var(--er) / 0.5)"
                      dot={false}
                      strokeWidth={1}
                      name="low"
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="average"
                      stroke="oklch(var(--p))"
                      dot={false}
                      strokeWidth={2}
                      name="average"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ul className="item-market-history__legend" aria-label="Chart legend">
                {CHART_LEGEND.map((item) => (
                  <li key={item.key} className="item-market-history__legend-item" title={item.hint}>
                    <span
                      className={`item-market-history__legend-swatch item-market-history__legend-swatch--${item.swatch}`}
                      aria-hidden
                    />
                    <span className="item-market-history__legend-label">{item.label}</span>
                    <span className="item-market-history__legend-hint">{item.hint}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="item-data-table">
              <table className="table table-compact w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Volume</th>
                    <th>Low</th>
                    <th>Avg</th>
                    <th>High</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.orderCount}</td>
                      <td>{row.volume}</td>
                      <td>{formatIsk(row.lowest)}</td>
                      <td>{formatIsk(row.average)}</td>
                      <td>{formatIsk(row.highest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )

  if (embedded) return body

  return (
    <ItemSection
      title={title ?? 'Market history'}
      subtitle="Daily trade prices and volume at this hub (not live buy/sell orders)"
      className={className}
      actions={rangeControls}
    >
      <div className="space-y-2.5">{body}</div>
    </ItemSection>
  )
}
