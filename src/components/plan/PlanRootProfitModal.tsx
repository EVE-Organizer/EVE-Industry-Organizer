import type { PlanProfitBreakdown } from '@/lib/planProfit'
import { formatDecimal, formatGraphQuantity, formatIsk, formatPercent, formatQuantity } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'

interface PlanRootProfitModalProps {
  breakdown: PlanProfitBreakdown | null
  onClose: () => void
}

export function PlanRootProfitModal({ breakdown, onClose }: PlanRootProfitModalProps) {
  if (!breakdown) return null

  const usesBuyOrders = breakdown.priceMethod === 'buy_orders'
  const priceLabel = usesBuyOrders ? 'Buy order price' : 'Sell / avg price'
  const revenueTitle = usesBuyOrders ? 'Buy order revenue' : 'Sell revenue'
  const profitTone = breakdown.netProfit >= 0 ? 'text-success' : 'text-error'

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-2xl p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-eve-border">
          <div className="flex items-start gap-3 min-w-0">
            <EveImage id={breakdown.productTypeId} size={40} framed alt="" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg">Profit breakdown</h3>
              <p className="text-sm opacity-70 truncate">{breakdown.productName}</p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={`px-5 py-4 border-b border-eve-border bg-base-300/20 ${profitTone}`}>
          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Net profit</p>
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${profitTone}`}>
            {formatIsk(breakdown.netProfit)}
          </p>
          <p className="text-xs opacity-60 mt-1">
            {formatPercent(breakdown.margin)} margin · {formatIsk(breakdown.iph)}/hr over{' '}
            {formatDecimal(breakdown.jobTimeHours, 1)} h scheduled
          </p>
        </div>

        <div className="px-5 py-4 max-h-[min(70dvh,32rem)] overflow-y-auto space-y-5">
          <section>
            <h4 className="font-semibold text-sm mb-2">1. Output</h4>
            <p className="text-sm font-mono leading-relaxed">
              {formatQuantity(breakdown.runs)} runs × output ={' '}
              <strong>{formatGraphQuantity(breakdown.outputQty)} units</strong>
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2">2. {revenueTitle}</h4>
            <p className="text-xs opacity-60 mb-2">
              {usesBuyOrders
                ? 'Instant sell into hub buy orders. No broker fee.'
                : 'Hub window price with broker fee and sales tax.'}
            </p>
            <div className="space-y-1 text-sm font-mono">
              <div>
                {formatIsk(breakdown.sellPricePerUnit)}/unit ({priceLabel}) ×{' '}
                {formatGraphQuantity(breakdown.outputQty)} ={' '}
                <strong>{formatIsk(breakdown.grossRevenue)}</strong>
              </div>
              {!usesBuyOrders && breakdown.brokerFee > 0 ? (
                <div className="opacity-70">Broker fee: −{formatIsk(breakdown.brokerFee)}</div>
              ) : null}
              {breakdown.salesTax > 0 ? (
                <div className="opacity-70">Sales tax: −{formatIsk(breakdown.salesTax)}</div>
              ) : null}
              <div className="pt-1">
                Net revenue: <strong>{formatIsk(breakdown.netRevenue)}</strong>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2">3. Setup cost</h4>
            <p className="text-sm font-mono">
              Rolled-up build/buy chain: <strong>{formatIsk(breakdown.setupCost)}</strong>
            </p>
          </section>

          <section className="rounded-lg border border-eve-border bg-base-300/30 px-4 py-3 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-mono">
              <span>{formatIsk(breakdown.netRevenue)} − {formatIsk(breakdown.setupCost)}</span>
              <span className={`font-bold tabular-nums ${profitTone}`}>
                = {formatIsk(breakdown.netProfit)}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs opacity-70">
              <span>Margin (profit ÷ setup)</span>
              <span className={`tabular-nums ${profitTone}`}>{formatPercent(breakdown.margin)}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs opacity-70">
              <span>ISK/hr (profit ÷ scheduled hours)</span>
              <span className={`tabular-nums ${profitTone}`}>{formatIsk(breakdown.iph)}/hr</span>
            </div>
          </section>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  )
}
