import type { PlanSetupBreakdown } from '@/lib/planProfit'
import { formatGraphQuantity, formatIsk, formatQuantity } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'
import { PriceSourceBadge } from '@/components/PriceSourceBadge'

interface PlanRootSetupModalProps {
  breakdown: PlanSetupBreakdown | null
  onClose: () => void
}

export function PlanRootSetupModal({ breakdown, onClose }: PlanRootSetupModalProps) {
  if (!breakdown) return null

  const buyTotal = breakdown.buyLines.reduce((sum, line) => sum + line.cost, 0)
  const isBuyRoot = breakdown.buildChainCost <= 0 && breakdown.buyLines.length === 1

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-2xl p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-eve-border">
          <div className="flex items-start gap-3 min-w-0">
            <EveImage id={breakdown.productTypeId} size={40} framed alt="" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg">Setup cost breakdown</h3>
              <p className="text-sm opacity-70 truncate">{breakdown.productName}</p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[min(70dvh,32rem)] overflow-y-auto space-y-5">
          <section>
            <h4 className="font-semibold text-sm mb-2">1. Batch</h4>
            <p className="text-sm">
              <strong>{formatQuantity(breakdown.runs)}</strong> runs →{' '}
              <strong>{formatGraphQuantity(breakdown.outputQty)}</strong> units output
            </p>
            <p className="text-xs opacity-60 mt-1">
              {isBuyRoot
                ? 'Root is set to buy finished product from the hub (no copy, invention, or manufacture).'
                : "Setup includes your build/buy choices for this root's supply chain (same sell-side material prices as Blueprints)."}
            </p>
          </section>

          {breakdown.buyLines.length > 0 ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">2. Buy from market</h4>
              <div className="overflow-x-auto border border-eve-border rounded-lg">
                <table className="table table-compact w-full">
                  <thead className="bg-base-300/80">
                    <tr className="text-xs">
                      <th>Item</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.buyLines.map((line) => (
                      <tr key={line.productTypeId} className="text-sm">
                        <td className="max-w-[14rem] truncate">
                          {line.name}
                          <PriceSourceBadge
                            source={
                              line.priceSource ??
                              (line.unitPrice > 0 ? 'window_avg' : 'missing')
                            }
                          />
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatGraphQuantity(line.qty)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatIsk(line.unitPrice)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatIsk(line.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-base-300/40">
                    <tr className="text-sm font-medium">
                      <td colSpan={3}>Market subtotal</td>
                      <td className="text-right tabular-nums whitespace-nowrap">{formatIsk(buyTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ) : null}

          {!isBuyRoot ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">
                {breakdown.buyLines.length > 0 ? '3' : '2'}. Build chain
              </h4>
              <p className="text-xs opacity-60 mb-2">
                Materials and job fees for components you build in-plan (rolled up from sub-blueprints).
                Flat single-recipe setup matches the Blueprints ranking modal when the chain is minerals only.
              </p>
              <div className="font-mono text-sm">
                Build chain: <strong>{formatIsk(breakdown.buildChainCost)}</strong>
              </div>
            </section>
          ) : null}

          {breakdown.haulIn > 0 ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">Haul in</h4>
              <p className="text-sm font-mono">
                Materials to build system: <strong>{formatIsk(breakdown.haulIn)}</strong>
              </p>
            </section>
          ) : null}

          {breakdown.packagedBuyCost > 0 ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">Packaged self-input</h4>
              <p className="text-sm font-mono">
                Market buy: <strong>{formatIsk(breakdown.packagedBuyCost)}</strong>
              </p>
            </section>
          ) : null}

          <section className="rounded-lg border border-eve-border bg-base-300/30 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-sm">Total setup</span>
              <span className="text-lg font-bold tabular-nums">{formatIsk(breakdown.totalSetupCost)}</span>
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 text-[11px] opacity-60">
          Material prices use the selected time window average when history exists; otherwise spot sell
          orders. Product revenue follows price method (same rules as Blueprints).
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  )
}
