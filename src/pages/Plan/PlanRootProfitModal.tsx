import type { PlanProfitBreakdown } from '@/pages/Plan/planProfit'
import {
  formatDecimal,
  formatGraphQuantity,
  formatIsk,
  formatPercent,
  formatQuantity,
} from '@/lib/profit'
import { EveImage } from '@/components/EveImage'
import { PriceSourceBadge } from '@/components/PriceSourceBadge'

interface PlanRootProfitModalProps {
  breakdown: PlanProfitBreakdown | null
  onClose: () => void
}

function Line({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'error'
}) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'tabular-nums'
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="opacity-70">{label}</span>
      <span className={`font-mono ${toneClass}`}>{value}</span>
    </div>
  )
}

export function PlanRootProfitModal({ breakdown, onClose }: PlanRootProfitModalProps) {
  if (!breakdown) return null

  const usesBuyOrders = breakdown.priceMethod === 'buy_orders'
  const priceLabel = usesBuyOrders ? 'Buy order price' : 'Sell / avg price'
  const revenueTitle = usesBuyOrders ? 'Buy order revenue' : 'Sell revenue'
  const profitTone = breakdown.netProfit >= 0 ? 'text-success' : 'text-error'
  const haulOutCharged = breakdown.haulExcluded ? 0 : breakdown.haulOut
  const buyTotal = breakdown.setup.buyLines.reduce((sum, line) => sum + line.cost, 0)
  const otherChain = Math.max(0, breakdown.setup.buildChainCost - breakdown.setup.jobFeeTotal)

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
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost shrink-0"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 border-b border-eve-border bg-base-300/20">
          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Net profit</p>
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${profitTone}`}>
            {formatIsk(breakdown.netProfit)}
          </p>
          <p className="text-xs opacity-60 mt-1">
            {formatPercent(breakdown.margin)} margin · {formatIsk(breakdown.iph)}/hr over{' '}
            {formatDecimal(breakdown.jobTimeHours, 1)} h scheduled
            {usesBuyOrders ? (
              <>
                {' '}
                <PriceSourceBadge source="buy_max" />
              </>
            ) : (
              <>
                {' '}
                <PriceSourceBadge source="window_avg" />
              </>
            )}
          </p>
        </div>

        <div className="px-5 py-4 max-h-[min(70dvh,32rem)] overflow-y-auto space-y-5">
          <section>
            <h4 className="font-semibold text-sm mb-2">Output</h4>
            <p className="text-sm font-mono leading-relaxed">
              {formatQuantity(breakdown.runs)} runs × output ={' '}
              <strong>{formatGraphQuantity(breakdown.outputQty)} units</strong>
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2">{revenueTitle}</h4>
            <p className="text-xs opacity-60 mb-2">
              {usesBuyOrders
                ? 'Instant sell into hub buy orders. No broker fee. Sales tax still applies (Accounting).'
                : 'Hub window price minus Broker Relations fee and Accounting sales tax.'}
            </p>
            <div className="space-y-1.5">
              <Line
                label={`${formatIsk(breakdown.sellPricePerUnit)}/unit (${priceLabel}) × ${formatGraphQuantity(breakdown.outputQty)}`}
                value={formatIsk(breakdown.grossRevenue)}
              />
              <Line
                label={
                  usesBuyOrders
                    ? 'Broker fee (buy orders)'
                    : `Broker fee (${formatDecimal(breakdown.brokerFeePercent, 1)}%)`
                }
                value={usesBuyOrders ? 'not charged' : `−${formatIsk(breakdown.brokerFee)}`}
              />
              <Line
                label={`Sales tax (${formatDecimal(breakdown.salesTaxPercent, 2)}%)`}
                value={`−${formatIsk(breakdown.salesTax)}`}
              />
              <Line label="Net revenue" value={formatIsk(breakdown.netRevenue)} />
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2">Setup composition</h4>
            <p className="text-xs opacity-60 mb-2">
              Same numbers as the setup modal. Job fees are installation only; materials you buy are
              listed separately.
            </p>
            <div className="space-y-1.5">
              <Line
                label={`Market buys (${breakdown.setup.buyLines.length} line${breakdown.setup.buyLines.length === 1 ? '' : 's'})`}
                value={formatIsk(buyTotal)}
              />
              {breakdown.setup.buildJobs.length > 0 ? (
                <Line
                  label={`Job fees (${breakdown.setup.buildJobs.length} job${breakdown.setup.buildJobs.length === 1 ? '' : 's'})`}
                  value={formatIsk(breakdown.setup.jobFeeTotal)}
                />
              ) : null}
              {otherChain > 0.5 ? (
                <Line label="Other chain (invention)" value={formatIsk(otherChain)} />
              ) : null}
              {breakdown.setup.packagedBuyCost > 0 ? (
                <Line
                  label="Packaged self-input"
                  value={formatIsk(breakdown.setup.packagedBuyCost)}
                />
              ) : null}
              <Line
                label={breakdown.haulExcluded ? 'Haul in (excluded)' : 'Haul in (in setup)'}
                value={formatIsk(breakdown.haulExcluded ? 0 : breakdown.haulIn)}
              />
              <Line label="Total setup" value={formatIsk(breakdown.setupCost)} />
              <Line
                label={
                  breakdown.haulExcluded ? 'Haul out (excluded)' : 'Haul out (products to hub)'
                }
                value={formatIsk(haulOutCharged)}
              />
            </div>
            {breakdown.setup.buildJobs.length > 0 ? (
              <div className="overflow-x-auto border border-eve-border rounded-lg mt-3">
                <table className="table table-compact w-full">
                  <thead className="bg-base-300/80">
                    <tr className="text-xs">
                      <th>Job</th>
                      <th className="text-right">Runs</th>
                      <th className="text-right">ME / TE</th>
                      <th className="text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.setup.buildJobs.map((job) => (
                      <tr key={job.productTypeId} className="text-sm">
                        <td className="max-w-[14rem] truncate">{job.name}</td>
                        <td className="text-right tabular-nums">{formatQuantity(job.runs)}</td>
                        <td className="text-right tabular-nums">
                          {job.me} / {job.te}
                        </td>
                        <td className="text-right tabular-nums">{formatIsk(job.jobCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-eve-border bg-base-300/30 px-4 py-3 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-mono">
              <span>
                {formatIsk(breakdown.netRevenue)} − {formatIsk(breakdown.setupCost)}
                {haulOutCharged > 0 ? ` − ${formatIsk(haulOutCharged)}` : ''}
              </span>
              <span className={`font-bold tabular-nums ${profitTone}`}>
                = {formatIsk(breakdown.netProfit)}
              </span>
            </div>
            <Line
              label="Margin (profit ÷ setup)"
              value={formatPercent(breakdown.margin)}
              tone={breakdown.netProfit >= 0 ? 'success' : 'error'}
            />
            <Line
              label="ISK/hr (profit ÷ scheduled hours)"
              value={`${formatIsk(breakdown.iph)}/hr`}
              tone={breakdown.netProfit >= 0 ? 'success' : 'error'}
            />
          </section>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  )
}
