import type { PlanProfitSummary } from '@/lib/planProfit'
import type { GlobalSettings } from '@/types'
import { formatDecimal, formatIsk, formatPercent } from '@/lib/profit'
import { ScoreBar } from '@/components/ScoreBar'

interface PlanProfitSummaryProps {
  summary: PlanProfitSummary
  buyHubName: string
  sellHubName: string
  priceMethod: GlobalSettings['priceMethod']
  includeHaulCost: boolean
  haulApplicable: boolean
}

function ProfitMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'success' | 'error' | 'neutral'
}) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-base-content/90'

  return (
    <div className="plan-profit-metric">
      <dt className="plan-profit-metric__label">{label}</dt>
      <dd className={`plan-profit-metric__value ${toneClass}`}>{value}</dd>
      {hint ? <p className="plan-profit-metric__hint">{hint}</p> : null}
    </div>
  )
}

export function PlanProfitSummaryPanel({
  summary,
  buyHubName,
  sellHubName,
  priceMethod,
  includeHaulCost,
  haulApplicable,
}: PlanProfitSummaryProps) {
  if (summary.rootRows.length === 0) return null

  const profitTone = summary.netProfit >= 0 ? 'success' : 'error'
  const marginCap = 100
  const marginDisplay = Math.min(marginCap, Math.max(-marginCap, summary.margin))
  const priceLabel = priceMethod === 'buy_orders' ? 'buy orders' : 'sell orders'
  const haulLabel = !haulApplicable
    ? 'haul n/a (build in market system)'
    : includeHaulCost
      ? 'haul included'
      : 'haul excluded'
  const hubLabel =
    buyHubName === sellHubName
      ? `${buyHubName} hub`
      : `buy ${buyHubName} · sell ${sellHubName}`
  const profitHint =
    haulApplicable && includeHaulCost ? 'Revenue − setup − haul out' : 'Revenue − setup'

  return (
    <section className="plan-profit-panel" aria-label="Plan profit summary">
      <div className="plan-profit-panel__header">
        <div>
          <h2 className="plan-profit-panel__title">Plan economics</h2>
          <p className="plan-profit-panel__subtitle">
            {hubLabel} · {priceLabel} · {haulLabel}
          </p>
        </div>
        {!summary.hasPrices ? (
          <span className="badge badge-warning badge-sm badge-outline">Missing price data</span>
        ) : null}
      </div>

      <dl className="plan-profit-panel__grid">
        <ProfitMetric label="Setup cost" value={formatIsk(summary.setupCost)} hint="Materials + jobs" />
        <ProfitMetric label="Revenue" value={formatIsk(summary.netRevenue)} hint="After broker & tax" />
        <ProfitMetric
          label="Profit"
          value={formatIsk(summary.netProfit)}
          tone={profitTone}
          hint={profitHint}
        />
        <ProfitMetric
          label="Margin"
          value={formatPercent(summary.margin)}
          tone={profitTone}
          hint="Profit ÷ setup"
        />
        <ProfitMetric
          label="ISK/hr"
          value={formatIsk(summary.iph)}
          tone={profitTone}
          hint={`${formatDecimal(summary.jobHours, 1)} h scheduled`}
        />
      </dl>

      {summary.hasPrices ? (
        <div className="plan-profit-panel__margin">
          <ScoreBar
            value={Math.abs(marginDisplay)}
            max={marginCap}
            label={summary.margin >= 0 ? 'Return on setup' : 'Loss vs setup'}
            accent={summary.margin >= 0 ? 'bg-success' : 'bg-error'}
          />
        </div>
      ) : (
        <p className="plan-profit-panel__empty">
          Add hub prices or pick products with market data to see profit and margin.
        </p>
      )}
    </section>
  )
}
