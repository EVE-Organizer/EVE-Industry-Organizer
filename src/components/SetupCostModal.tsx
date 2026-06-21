import type { BlueprintCostBreakdown, RankedBlueprintRow, SetupCostBreakdown, TypeInfo } from '@/types'
import { formatAvgVolume, formatDecimal, formatIsk, formatNumber, formatPercent, formatQuantity } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'

interface SetupCostModalProps {
  row: RankedBlueprintRow | null
  typeMap: Map<number, TypeInfo>
  haulInLabel: string
  onClose: () => void
}

function typeName(typeMap: Map<number, TypeInfo>, typeId: number): string {
  return typeMap.get(typeId)?.name ?? `Type ${typeId}`
}

function RunsExplanation({ breakdown }: { breakdown: SetupCostBreakdown }) {
  const { batchSizeSetting, productQuantity, avgVolume, volumeCapDays, runs, outputQty } = breakdown

  if (avgVolume <= 0) {
    return (
      <p className="text-sm">
        No volume history for this window, so rankings use your full batch setting:{' '}
        <strong>{runs}</strong> run{runs === 1 ? '' : 's'} × {productQuantity} ={' '}
        <strong>{formatQuantity(outputQty)}</strong> units.
      </p>
    )
  }

  const maxRuns = Math.floor((avgVolume * volumeCapDays) / productQuantity)

  return (
    <ol className="text-sm space-y-1 list-decimal list-inside">
      <li>
        Settings batch size: <strong>{batchSizeSetting}</strong> runs
      </li>
      <li>
        Hub avg volume/day ({volumeCapDays}-day cap):{' '}
        <strong>{formatAvgVolume(avgVolume)}</strong> units/day
      </li>
      <li>
        Max runs for market: floor({formatAvgVolume(avgVolume)} × {volumeCapDays} ÷{' '}
        {productQuantity}) = <strong>{maxRuns}</strong>
      </li>
      <li>
        Runs used: min({batchSizeSetting}, {maxRuns}) = <strong>{runs}</strong>
      </li>
      <li>
        Output qty: {runs} × {productQuantity} = <strong>{formatQuantity(outputQty)}</strong>{' '}
        units
      </li>
    </ol>
  )
}

function BlueprintCostSection({
  breakdown,
  runs,
}: {
  breakdown: BlueprintCostBreakdown
  runs: number
}) {
  if (breakdown.chargeExcluded) {
    return (
      <section>
        <h4 className="font-semibold text-sm mb-2">
          2. Blueprint <span className="badge badge-ghost badge-xs align-middle">charge</span>
        </h4>
        <p className="text-xs opacity-60 mb-2">
          Charges come from one cheap, reusable BPO that makes huge volume, so its cost is left out
          of the batch.
        </p>
        <div className="font-mono text-xs sm:text-sm space-y-1 break-all">
          <div>
            Charged this batch: <strong>{formatIsk(0)}</strong>
          </div>
        </div>
      </section>
    )
  }

  if (breakdown.mode === 'faction_bpc') {
    return (
      <section>
        <h4 className="font-semibold text-sm mb-2">
          2. Blueprint{' '}
          <span className="badge badge-secondary badge-xs align-middle">faction BPC</span>
        </h4>
        <p className="text-xs opacity-60 mb-2">
          Faction blueprints are copies bought from NPC LP stores or contracts, not BPOs. There is no
          BPO to buy, and the copy cost is paid in loyalty points, so no ISK acquisition cost is
          charged here.
        </p>
        <div className="font-mono text-xs sm:text-sm space-y-1 break-all">
          <div>
            Charged this batch: <strong>{formatIsk(0)}</strong>
          </div>
        </div>
      </section>
    )
  }

  if (breakdown.mode === 'invention') {
    return (
      <section>
        <h4 className="font-semibold text-sm mb-2">
          2. Blueprint{' '}
          <span className="badge badge-warning badge-xs align-middle">BPC from invention</span>
        </h4>
        <p className="text-xs opacity-60 mb-2">
          T2 has no reusable BPO. Each batch consumes invented copies, so the full invention cost is
          charged here.
        </p>
        <div className="font-mono text-xs sm:text-sm space-y-1 break-all">
          <div>
            Datacores per attempt: <strong>{formatIsk(breakdown.datacoreCost ?? 0)}</strong>
          </div>
          <div>
            Success chance: <strong>{formatPercent((breakdown.inventionChance ?? 0) * 100)}</strong>{' '}
            (skills assumed)
          </div>
          <div>
            Runs per BPC: <strong>{breakdown.runsPerBPC ?? 0}</strong>
          </div>
          <div>
            Expected runs: {formatPercent((breakdown.inventionChance ?? 0) * 100)} ×{' '}
            {breakdown.runsPerBPC ?? 0} ={' '}
            <strong>{formatDecimal(breakdown.expectedRunsPerAttempt ?? 0, 2)}</strong>
          </div>
          <div>
            Cost per run: {formatIsk(breakdown.datacoreCost ?? 0)} ÷{' '}
            {formatDecimal(breakdown.expectedRunsPerAttempt ?? 0, 2)} ={' '}
            <strong>{formatIsk(breakdown.costPerRun ?? 0)}</strong>
          </div>
          <div>
            Charged this batch: {formatIsk(breakdown.costPerRun ?? 0)} × {runs} runs ={' '}
            <strong>{formatIsk(breakdown.charged)}</strong>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h4 className="font-semibold text-sm mb-2">
        2. Blueprint <span className="badge badge-info badge-xs align-middle">BPO</span>
      </h4>
      <p className="text-xs opacity-60 mb-2">
        T1 BPOs are reusable, so the purchase price and research are spread over the blueprint
        lifetime.
      </p>
      <div className="font-mono text-xs sm:text-sm space-y-1 break-all">
        <div>
          Buy once (full price): <strong>{formatIsk(breakdown.bpoUnitPrice ?? 0)}</strong>
        </div>
        <div>
          ME/TE research (one-time, est.): <strong>{formatIsk(breakdown.researchFee ?? 0)}</strong>
        </div>
        <div>
          Lifetime: <strong>{formatQuantity(breakdown.lifetimeRuns ?? 0)}</strong> runs
        </div>
        <div>
          Charged this batch: ({formatIsk(breakdown.bpoUnitPrice ?? 0)} +{' '}
          {formatIsk(breakdown.researchFee ?? 0)}) ÷ {formatQuantity(breakdown.lifetimeRuns ?? 0)}{' '}
          × {runs} = <strong>{formatIsk(breakdown.charged)}</strong>
        </div>
        {(breakdown.bpoUnitPrice ?? 0) <= 0 ? (
          <span className="text-xs opacity-60 block">
            No hub BPO price found, so blueprint cost is treated as 0.
          </span>
        ) : null}
      </div>
    </section>
  )
}

export function SetupCostModal({ row, typeMap, haulInLabel, onClose }: SetupCostModalProps) {
  if (!row) return null

  const { setupBreakdown: b } = row

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-2xl p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-eve-border">
          <div className="flex items-start gap-3 min-w-0">
            <EveImage id={row.blueprint.productTypeId} size={40} framed alt="" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg">Setup cost breakdown</h3>
              <p className="text-sm opacity-70 truncate">{row.product.name}</p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[min(70dvh,32rem)] overflow-y-auto space-y-5">
          <section>
            <h4 className="font-semibold text-sm mb-2">1. Batch size</h4>
            <RunsExplanation breakdown={b} />
          </section>

          <BlueprintCostSection breakdown={b.blueprintCost} runs={b.runs} />

          <section>
            <h4 className="font-semibold text-sm mb-2">
              3. Materials (ME {b.me}, 1% reduction per level)
            </h4>
            <p className="text-xs opacity-60 mb-2">
              Per line: ceil(base qty × runs × (1 − ME × 1%)) × hub window price
            </p>
            <div className="overflow-x-auto border border-eve-border rounded-lg">
              <table className="table table-compact w-full">
                <thead className="bg-base-300/80">
                  <tr className="text-xs">
                    <th>Material</th>
                    <th className="text-right">Base/run</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {b.materials.map((line) => (
                    <tr key={line.typeId} className="text-sm">
                      <td className="max-w-[12rem] truncate">{typeName(typeMap, line.typeId)}</td>
                      <td className="text-right tabular-nums">{formatQuantity(line.baseQtyPerRun)}</td>
                      <td className="text-right tabular-nums">{formatQuantity(line.quantity)}</td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {formatIsk(line.unitPrice)}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {formatIsk(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-base-300/40">
                  <tr className="text-sm font-medium">
                    <td colSpan={4}>Material subtotal</td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {formatIsk(b.materialCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2">4. Job cost (NPC station)</h4>
            <p className="text-sm font-mono text-xs sm:text-sm break-all">
              {formatIsk(b.materialCost)} × {formatDecimal(b.systemCostIndex, 4)} system cost index ={' '}
              <strong>{formatIsk(b.jobCost)}</strong>
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2">
              5. Haul in ({haulInLabel})
              {b.haulExcluded ? (
                <span className="badge badge-ghost badge-xs align-middle ml-1">excluded</span>
              ) : null}
            </h4>
            {b.haulExcluded ? (
              <p className="text-xs opacity-60 mb-2">
                Include hauling is off for this ranking. The estimate below is not counted in setup
                or profit.
              </p>
            ) : null}
            <p className="text-sm font-mono text-xs sm:text-sm break-all">
              {formatDecimal(b.materialVolumeM3, 2)} m³ ×{' '}
              {formatIsk(b.haulInIskPerM3)}/m³ ={' '}
              <strong>
                {formatIsk(b.haulExcluded ? b.materialVolumeM3 * b.haulInIskPerM3 : b.haulIn)}
              </strong>
              {b.haulExcluded ? (
                <span className="opacity-70"> → charged {formatIsk(0)}</span>
              ) : null}
            </p>
          </section>

          <section className="rounded-lg border border-eve-border bg-base-300/30 px-4 py-3 space-y-1">
            <h4 className="font-semibold text-sm mb-1">Setup total (for profit)</h4>
            <p className="text-sm font-mono text-xs sm:text-sm break-all">
              {formatIsk(b.bpoCost)} + {formatIsk(b.materialCost)} + {formatIsk(b.jobCost)} +{' '}
              {formatIsk(b.haulIn)} = <strong className="text-base">{formatIsk(b.setupCost)}</strong>
            </p>
            <p className="text-xs opacity-70">
              Upfront cash to start:{' '}
              <strong className="tabular-nums">{formatIsk(b.upfrontCapital)}</strong> (full blueprint
              + this batch). The budget filter uses this.
            </p>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 text-[11px] opacity-60 space-y-1">
          <p>
            Setup = blueprint + materials + job cost
            {b.haulExcluded ? '' : ' + haul in'}. T1 blueprint cost is amortized over its lifetime; T2
            charges the full invention cost per batch; faction BPCs carry no ISK acquisition cost.
            {b.haulExcluded
              ? ' Haul in and haul out are excluded from this ranking.'
              : ` Haul out (${formatIsk(row.haulOut)}) is subtracted separately in profit, not included here.`}
          </p>
          <p>Material prices use the selected time window average when history exists; otherwise spot sell orders.</p>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}
