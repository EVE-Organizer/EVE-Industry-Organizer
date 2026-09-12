import type { PlanSetupBreakdown } from '@/pages/Plan/planProfit'
import { formatDuration, formatGraphQuantity, formatIsk, formatQuantity } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'
import { PriceSourceBadge } from '@/components/PriceSourceBadge'

interface PlanRootSetupModalProps {
  breakdown: PlanSetupBreakdown | null
  onClose: () => void
}

function TotalRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-2 text-sm ${muted ? 'opacity-70' : ''}`}
    >
      <span>{label}</span>
      <span className="tabular-nums font-mono">{formatIsk(value)}</span>
    </div>
  )
}

function sourceLabel(source: 'build' | 'buy' | 'packaged'): string {
  if (source === 'build') return 'Build'
  if (source === 'packaged') return 'Packaged'
  return 'Buy'
}

export function PlanRootSetupModal({ breakdown, onClose }: PlanRootSetupModalProps) {
  if (!breakdown) return null

  const buyTotal = breakdown.buyLines.reduce((sum, line) => sum + line.cost, 0)
  const isBuyRoot = breakdown.rootMode === 'buy'
  const haulCharged = breakdown.haulExcluded ? 0 : breakdown.haulIn
  const otherChain = Math.max(0, breakdown.buildChainCost - breakdown.jobFeeTotal)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-3xl p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-eve-border">
          <div className="flex items-start gap-3 min-w-0">
            <EveImage id={breakdown.productTypeId} size={40} framed alt="" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg">Setup cost breakdown</h3>
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
          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Total setup</p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">
            {formatIsk(breakdown.totalSetupCost)}
          </p>
          <p className="text-xs opacity-60 mt-1">
            {formatQuantity(breakdown.runs)} runs → {formatGraphQuantity(breakdown.outputQty)} units
            {isBuyRoot ? ' · buy finished product' : ' · build/buy chain'}
            {breakdown.haulExcluded ? ' · haul excluded' : null}
          </p>
          {breakdown.facilityNote ? (
            <p className="text-xs opacity-70 mt-1">Facility: {breakdown.facilityNote}</p>
          ) : null}
        </div>

        <div className="px-5 py-4 max-h-[min(70dvh,36rem)] overflow-y-auto space-y-5">
          {breakdown.rootMaterials.length > 0 ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">Root recipe (after ME)</h4>
              <p className="text-xs opacity-60 mb-2">
                Inputs for this job. Built children are not a market buy — cash is in the job-fee
                and buy tables below.
              </p>
              <div className="overflow-x-auto border border-eve-border rounded-lg">
                <table className="table table-compact w-full">
                  <thead className="bg-base-300/80">
                    <tr className="text-xs">
                      <th>Material</th>
                      <th>Source</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Market value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.rootMaterials.map((line) => (
                      <tr key={line.typeId} className="text-sm">
                        <td className="max-w-[14rem] truncate">{line.name}</td>
                        <td>
                          <span className="badge badge-ghost badge-xs">
                            {sourceLabel(line.source)}
                          </span>
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatGraphQuantity(line.quantity)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatIsk(line.unitPrice)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatIsk(line.lineCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {breakdown.buildJobs.length > 0 ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">Industry jobs</h4>
              <p className="text-xs opacity-60 mb-2">
                Installation fees only (EIV × cost index × facility). Materials you buy are in the
                market table.
              </p>
              <div className="overflow-x-auto border border-eve-border rounded-lg">
                <table className="table table-compact w-full">
                  <thead className="bg-base-300/80">
                    <tr className="text-xs">
                      <th>Job</th>
                      <th className="text-right">Runs</th>
                      <th className="text-right">ME / TE</th>
                      <th className="text-right">Time</th>
                      <th className="text-right">Job fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.buildJobs.map((job) => (
                      <tr key={job.productTypeId} className="text-sm">
                        <td className="max-w-[14rem]">
                          <span className="truncate block">{job.name}</span>
                          <span className="text-[11px] opacity-60">
                            {job.recipeKind === 'reaction' ? 'Reaction' : 'Manufacturing'}
                            {job.meBonusPercent > 0 || job.teBonusPercent > 0
                              ? ` · facility ME −${job.meBonusPercent.toFixed(1)}% / TE −${job.teBonusPercent.toFixed(1)}%`
                              : null}
                          </span>
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatQuantity(job.runs)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {job.me} / {job.te}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatDuration(job.jobTimeSeconds)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {formatIsk(job.jobCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-base-300/40">
                    <tr className="text-sm font-medium">
                      <td colSpan={4}>Job fees</td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {formatIsk(breakdown.jobFeeTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {otherChain > 0.5 ? (
                <p className="text-xs opacity-60 mt-2">
                  Other chain cost (invention / rounding): {formatIsk(otherChain)}
                </p>
              ) : null}
            </section>
          ) : !isBuyRoot ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">Build chain</h4>
              <p className="text-sm font-mono">
                Build chain: <strong>{formatIsk(breakdown.buildChainCost)}</strong>
              </p>
            </section>
          ) : null}

          {breakdown.buyLines.length > 0 ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">Buy from market</h4>
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
                              line.priceSource ?? (line.unitPrice > 0 ? 'window_avg' : 'missing')
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
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {formatIsk(buyTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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

          {breakdown.haulIn > 0 || breakdown.haulExcluded ? (
            <section>
              <h4 className="font-semibold text-sm mb-2">
                Haul in
                {breakdown.haulExcluded ? (
                  <span className="badge badge-ghost badge-xs ml-1">excluded</span>
                ) : null}
              </h4>
              <p className="text-sm font-mono">
                Materials to build system:{' '}
                <strong>{formatIsk(breakdown.haulExcluded ? 0 : breakdown.haulIn)}</strong>
                {breakdown.haulExcluded && breakdown.haulIn > 0 ? (
                  <span className="opacity-70"> (estimate {formatIsk(breakdown.haulIn)})</span>
                ) : null}
              </p>
            </section>
          ) : null}

          <section className="rounded-lg border border-eve-border bg-base-300/30 px-4 py-3 space-y-1.5">
            <TotalRow label="Market buys" value={buyTotal} muted />
            {!isBuyRoot ? <TotalRow label="Job fees" value={breakdown.jobFeeTotal} muted /> : null}
            {otherChain > 0.5 ? <TotalRow label="Other chain" value={otherChain} muted /> : null}
            {breakdown.packagedBuyCost > 0 ? (
              <TotalRow label="Packaged input" value={breakdown.packagedBuyCost} muted />
            ) : null}
            <TotalRow label="Haul in" value={haulCharged} muted />
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1 border-t border-eve-border/60">
              <span className="font-semibold text-sm">Total setup</span>
              <span className="text-lg font-bold tabular-nums">
                {formatIsk(breakdown.totalSetupCost)}
              </span>
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 text-[11px] opacity-60">
          Material prices use the selected time window average when history exists; otherwise spot
          sell orders. Product revenue is in the profit breakdown (broker and sales tax).
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  )
}
