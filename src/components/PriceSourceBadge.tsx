import type { PriceSourceKind } from '@/lib/blueprintEconomics'

const LABELS: Record<PriceSourceKind, string> = {
  spot: 'spot',
  window_avg: 'window avg',
  buy_max: 'best buy',
  missing: 'missing',
}

const TITLE: Record<PriceSourceKind, string> = {
  spot: 'Hub sell-order minimum (spot)',
  window_avg: 'History average for the selected price window',
  buy_max: 'Best buy order (buy.max); no order-depth check',
  missing: 'No usable price in market data',
}

export function PriceSourceBadge({ source }: { source: PriceSourceKind }) {
  const tone =
    source === 'missing'
      ? 'badge-error'
      : source === 'buy_max'
        ? 'badge-info'
        : 'badge-ghost'
  return (
    <span
      className={`badge badge-xs ${tone} ml-1 align-middle normal-case`}
      title={TITLE[source]}
    >
      {LABELS[source]}
    </span>
  )
}
