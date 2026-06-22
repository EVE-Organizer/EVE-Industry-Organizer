import type { ReactNode } from 'react'
import type { RankedBlueprintRow, SetupCostBreakdown, TypeInfo } from '@/types'
import { formatAvgVolume, formatDecimal, formatIsk, formatNumber, formatPercent, formatQuantity } from '@/lib/profit'
import { EveImage } from '@/components/EveImage'
import { JobCostFormula, jobCostStepTitle } from '@/components/JobCostFormula'
import { isPlayerStructure } from '@/lib/structureSettings'

interface IphBreakdownModalProps {
  row: RankedBlueprintRow | null
  typeMap: Map<number, TypeInfo>
  haulInLabel: string
  haulOutLabel: string
  onClose: () => void
}

function typeName(typeMap: Map<number, TypeInfo>, typeId: number): string {
  return typeMap.get(typeId)?.name ?? `Type ${typeId}`
}

function formatDuration(seconds: number): string {
  if (seconds >= 86400) return `${formatDecimal(seconds / 86400, 2)} days`
  if (seconds >= 3600) return `${formatDecimal(seconds / 3600, 2)} hr`
  if (seconds >= 60) return `${formatDecimal(seconds / 60, 1)} min`
  return `${formatNumber(seconds, 0)} sec`
}

function PhaseHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</p>
      <p className="text-sm opacity-75 mt-1">{description}</p>
    </div>
  )
}

function StepCard({
  step,
  title,
  note,
  result,
  resultLabel = 'Result',
  children,
}: {
  step: number
  title: string
  note?: string
  result?: string
  resultLabel?: string
  children: ReactNode
}) {
  return (
    <article className="rounded-lg border border-eve-border bg-base-200/40 overflow-hidden">
      <header className="flex items-start gap-3 px-4 py-3 border-b border-eve-border/70 bg-base-300/25">
        <span className="badge badge-neutral badge-sm shrink-0 tabular-nums font-semibold">
          {step}
        </span>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm leading-snug">{title}</h4>
          {note ? <p className="text-xs opacity-60 mt-1 leading-relaxed">{note}</p> : null}
        </div>
      </header>
      <div className="px-4 py-3 space-y-2">{children}</div>
      {result ? (
        <footer className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 border-t border-eve-border/70 bg-base-300/20">
          <span className="text-xs font-medium opacity-70">{resultLabel}</span>
          <span className="font-semibold tabular-nums">{result}</span>
        </footer>
      ) : null}
    </article>
  )
}

function CalcStep({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-eve-border/50 bg-base-300/20 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-50 mb-1">{label}</p>
      <div className="text-sm font-mono leading-relaxed break-all">{children}</div>
    </div>
  )
}

function SkillTile({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-md border border-eve-border/50 bg-base-300/20 px-3 py-3 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-50">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
      <p className="text-[11px] opacity-60 mt-1 leading-snug">{detail}</p>
    </div>
  )
}

function BatchSteps({ breakdown }: { breakdown: SetupCostBreakdown }) {
  const { batchSizeSetting, productQuantity, avgVolume, volumeCapDays, runs, outputQty } = breakdown

  if (avgVolume <= 0) {
    return (
      <>
        <CalcStep label="No hub volume for this window">
          Use full batch from settings: <strong>{runs}</strong> runs
        </CalcStep>
        <CalcStep label="Output quantity">
          {runs} runs × {productQuantity} units/run ={' '}
          <strong>{formatQuantity(outputQty)} units</strong>
        </CalcStep>
      </>
    )
  }

  const maxRuns = Math.floor((avgVolume * volumeCapDays) / productQuantity)

  return (
    <>
      <CalcStep label="Your batch setting">{batchSizeSetting} runs</CalcStep>
      <CalcStep label="Hub average volume">
        {formatAvgVolume(avgVolume)} units/day (capped at {volumeCapDays} days of volume)
      </CalcStep>
      <CalcStep label="Max runs the market can absorb">
        floor({formatAvgVolume(avgVolume)} × {volumeCapDays} ÷ {productQuantity}) ={' '}
        <strong>{maxRuns} runs</strong>
      </CalcStep>
      <CalcStep label="Runs used for this row">
        min({batchSizeSetting}, {maxRuns}) = <strong>{runs} runs</strong>
      </CalcStep>
      <CalcStep label="Output quantity">
        {runs} runs × {productQuantity} units/run ={' '}
        <strong>{formatQuantity(outputQty)} units</strong>
      </CalcStep>
    </>
  )
}

export function IphBreakdownModal({
  row,
  typeMap,
  haulInLabel,
  haulOutLabel,
  onClose,
}: IphBreakdownModalProps) {
  if (!row) return null

  const b = row.setupBreakdown
  const iph = row.iphBreakdown
  const jobHours = iph.jobTimeSeconds / 3600
  const usesBuyOrders = iph.priceMethod === 'buy_orders'
  const priceUnitLabel = usesBuyOrders ? 'Buy order price' : 'Sell/avg price'
  const revenueTitle = usesBuyOrders ? 'Buy order revenue' : 'Sell revenue'
  const revenueNote = usesBuyOrders
    ? 'Instant sell into the best hub buy order. No broker fee.'
    : 'Window average when history exists. Otherwise current sell orders.'
  const revenuePhaseDescription = usesBuyOrders
    ? 'What you earn when the batch sells instantly into hub buy orders.'
    : 'What you earn when the batch sells at the hub window price.'

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-3xl p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-eve-border">
          <div className="flex items-start gap-3 min-w-0">
            <EveImage id={row.blueprint.productTypeId} size={40} framed alt="" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg">How ISK/hr is calculated</h3>
              <p className="text-sm opacity-70 truncate">{row.product.name}</p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 border-b border-eve-border bg-success/10">
          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Final rate</p>
          <p className="text-2xl font-bold tabular-nums text-success mt-0.5">
            {formatIsk(iph.iph)}/hr
          </p>
          <p className="text-xs opacity-60 mt-1">
            Follow each section below. Every step feeds the next until you reach this number.
          </p>
        </div>

        <div className="px-5 py-4 max-h-[min(75dvh,36rem)] overflow-y-auto space-y-6 scrollbar-thin">
          <PhaseHeader
            title="Part 1 · Inputs"
            description="Skills, batch size, and job time set how much you make and how long it takes."
          />

          <div className="space-y-4">
            <StepCard
              step={1}
              title="Blueprint skills"
              note="From global settings. Per-BPO and character skills are not applied in rankings yet."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <SkillTile label="ME" value={iph.me} detail="1% less material per level" />
                <SkillTile label="TE" value={iph.te} detail="4% faster jobs per level" />
                <SkillTile
                  label="Adv. Industry"
                  value={iph.advancedIndustry}
                  detail="3% faster jobs per level"
                />
              </div>
              {isPlayerStructure(iph.structureType) ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <SkillTile
                    label="Struct. ME"
                    value={`${formatDecimal(iph.structureMeBonusPercent, 1)}%`}
                    detail="Extra material reduction"
                  />
                  <SkillTile
                    label="Struct. TE"
                    value={`${formatDecimal(iph.structureTeBonusPercent, 1)}%`}
                    detail="Extra job time reduction"
                  />
                  <SkillTile
                    label="Owner tax"
                    value={`${formatDecimal(iph.structureTaxPercent, 1)}%`}
                    detail="Manufacturing tax on job fee"
                  />
                </div>
              ) : null}
            </StepCard>

            <StepCard
              step={2}
              title="Batch size"
              note="Runs are capped so output fits within 7 days of average hub volume."
              result={`${formatQuantity(iph.outputQty)} units`}
              resultLabel="Units in this batch"
            >
              <BatchSteps breakdown={b} />
            </StepCard>

            <StepCard
              step={3}
              title="Job time"
              note="Longer jobs mean fewer units per day, which lowers ISK/hr even if batch profit is high."
              result={`${formatDuration(iph.jobTimeSeconds)} (${formatDecimal(jobHours, 2)} hr)`}
              resultLabel="Total job duration"
            >
              <CalcStep label="Base time per run">
                {formatDuration(iph.baseTimePerRunSeconds)}
              </CalcStep>
              <CalcStep label="TE factor">
                1 − ({iph.te} × 4%) = <strong>{formatDecimal(iph.teTimeFactor, 4)}</strong>
              </CalcStep>
              {isPlayerStructure(iph.structureType) && iph.structureTeBonusPercent > 0 ? (
                <CalcStep label="Structure TE factor">
                  1 − {formatDecimal(iph.structureTeBonusPercent, 1)}% ={' '}
                  <strong>{formatDecimal(iph.structureTeTimeFactor, 4)}</strong>
                </CalcStep>
              ) : null}
              <CalcStep label="Advanced Industry factor">
                1 − ({iph.advancedIndustry} × 3%) ={' '}
                <strong>{formatDecimal(iph.advancedIndustryTimeFactor, 4)}</strong>
              </CalcStep>
              <CalcStep label="Multiply">
                {formatDuration(iph.baseTimePerRunSeconds)} × {iph.runs} runs ×{' '}
                {formatDecimal(iph.teTimeFactor, 4)}
                {isPlayerStructure(iph.structureType) && iph.structureTeBonusPercent > 0
                  ? ` × ${formatDecimal(iph.structureTeTimeFactor, 4)}`
                  : ''}{' '}
                × {formatDecimal(iph.advancedIndustryTimeFactor, 4)}
              </CalcStep>
            </StepCard>
          </div>

          <PhaseHeader
            title="Part 2 · Revenue"
            description={revenuePhaseDescription}
          />

          <StepCard
            step={4}
            title={revenueTitle}
            note={revenueNote}
            result={formatIsk(iph.netRevenue)}
            resultLabel="Net revenue after fees"
          >
            <CalcStep label="Gross sale">
              {formatIsk(iph.sellPricePerUnit)}/unit ({priceUnitLabel}) ×{' '}
              {formatQuantity(iph.outputQty)} units = <strong>{formatIsk(iph.grossRevenue)}</strong>
            </CalcStep>
            {usesBuyOrders ? (
              <CalcStep label="Broker fee">
                Not charged on instant buy-order sales
              </CalcStep>
            ) : (
              <CalcStep label="Broker fee">
                {iph.brokerFeePercent}% of gross = −{formatIsk(iph.brokerFee)}
              </CalcStep>
            )}
            <CalcStep label="Sales tax">
              {iph.salesTaxPercent}%
              {usesBuyOrders ? ' of gross' : ' after broker'} = −{formatIsk(iph.salesTax)}
            </CalcStep>
          </StepCard>

          <PhaseHeader
            title="Part 3 · Costs & profit"
            description="BPO purchase, recipe materials, job fees, and hauling."
          />

          <div className="space-y-4">
            {iph.blueprintCost.chargeExcluded ? (
              <StepCard
                step={5}
                title="Blueprint (charge, excluded)"
                note="Charges come from one cheap, reusable BPO that makes huge volume, so its cost is left out."
                result={formatIsk(0)}
                resultLabel="Blueprint cost"
              >
                <CalcStep label="Charged this batch">
                  <strong>{formatIsk(0)}</strong>
                </CalcStep>
              </StepCard>
            ) : iph.blueprintCost.mode === 'faction_bpc' ? (
              <StepCard
                step={5}
                title="Blueprint (faction BPC)"
                note="Faction blueprints are copies from NPC LP stores or contracts, not BPOs. The copy is paid in loyalty points, so no ISK acquisition cost is charged."
                result={formatIsk(0)}
                resultLabel="Blueprint cost"
              >
                <CalcStep label="Charged this batch">
                  <strong>{formatIsk(0)}</strong>
                </CalcStep>
              </StepCard>
            ) : iph.blueprintCost.mode === 'invention' ? (
              <StepCard
                step={5}
                title="Blueprint (BPC from invention)"
                note="T2 has no reusable BPO. Each batch consumes invented copies, so the full invention cost is charged."
                result={formatIsk(iph.bpoCost)}
                resultLabel="Invention cost"
              >
                <CalcStep label="Datacores ÷ (chance × runs per BPC)">
                  {formatIsk(iph.blueprintCost.datacoreCost ?? 0)} ÷ (
                  {formatPercent((iph.blueprintCost.inventionChance ?? 0) * 100)} ×{' '}
                  {iph.blueprintCost.runsPerBPC ?? 0}) ={' '}
                  {formatIsk(iph.blueprintCost.costPerRun ?? 0)}/run
                </CalcStep>
                <CalcStep label="Charged this batch">
                  {formatIsk(iph.blueprintCost.costPerRun ?? 0)} × {iph.runs} runs ={' '}
                  <strong>{formatIsk(iph.bpoCost)}</strong>
                </CalcStep>
              </StepCard>
            ) : (
              <StepCard
                step={5}
                title="Blueprint (BPO, amortized)"
                note="T1 BPOs are reusable, so the price and research are spread over the blueprint lifetime."
                result={formatIsk(iph.bpoCost)}
                resultLabel="BPO cost"
              >
                <CalcStep label="(Price + research) ÷ lifetime × runs">
                  ({formatIsk(iph.blueprintCost.bpoUnitPrice ?? 0)} +{' '}
                  {formatIsk(iph.blueprintCost.researchFee ?? 0)}) ÷{' '}
                  {formatQuantity(iph.blueprintCost.lifetimeRuns ?? 0)} × {iph.runs} ={' '}
                  <strong>{formatIsk(iph.bpoCost)}</strong>
                </CalcStep>
              </StepCard>
            )}

            <StepCard
              step={6}
              title="Material cost"
              note={
                isPlayerStructure(iph.structureType) && iph.structureMeBonusPercent > 0
                  ? `ME ${iph.me} + ${formatDecimal(iph.structureMeBonusPercent, 1)}% structure: ceil(base qty × runs × (1 − ME × 1%) × (1 − structure bonus)) × hub price`
                  : `ME ${iph.me}: ceil(base qty × runs × (1 − ME × 1%)) × hub price`
              }
              result={formatIsk(iph.materialCost)}
              resultLabel="Material subtotal"
            >
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
                        <td className="text-right tabular-nums">
                          {formatQuantity(line.baseQtyPerRun)}
                        </td>
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
                </table>
              </div>
            </StepCard>

            <StepCard
              step={7}
              title={jobCostStepTitle(iph)}
              result={formatIsk(iph.jobCost)}
              resultLabel="Industry tax"
            >
              <JobCostFormula breakdown={iph} />
            </StepCard>

            <StepCard
              step={8}
              title={`Haul in · ${haulInLabel}${iph.haulExcluded ? ' (excluded)' : ''}`}
              note={
                iph.haulExcluded
                  ? 'Include hauling is off for this ranking. The estimate below is not counted in setup or profit.'
                  : undefined
              }
              result={formatIsk(iph.haulIn)}
              resultLabel="Haul in cost"
            >
              <CalcStep label="Material volume × route rate">
                {formatDecimal(iph.materialVolumeM3, 2)} m³ ×{' '}
                {formatIsk(iph.haulInIskPerM3)}/m³ ={' '}
                <strong>
                  {formatIsk(
                    iph.haulExcluded
                      ? iph.materialVolumeM3 * iph.haulInIskPerM3
                      : iph.haulIn,
                  )}
                </strong>
                {iph.haulExcluded ? (
                  <>
                    {' '}
                    → charged <strong>{formatIsk(0)}</strong>
                  </>
                ) : null}
              </CalcStep>
            </StepCard>

            <StepCard
              step={9}
              title="Setup cost"
              note={
                iph.haulExcluded
                  ? 'Blueprint cost used for profit (amortized for BPO, full for BPC). Haul in and haul out are excluded from this ranking.'
                  : 'Blueprint cost used for profit (amortized for BPO, full for BPC). Haul out is counted separately.'
              }
              result={formatIsk(iph.setupCost)}
              resultLabel="Total setup"
            >
              <CalcStep
                label={
                  iph.haulExcluded
                    ? 'Add blueprint, materials, job cost'
                    : 'Add blueprint, materials, job cost, haul in'
                }
              >
                {formatIsk(iph.bpoCost)} + {formatIsk(iph.materialCost)} + {formatIsk(iph.jobCost)}
                {iph.haulExcluded ? null : (
                  <>
                    {' '}
                    + {formatIsk(iph.haulIn)}
                  </>
                )}
              </CalcStep>
              <CalcStep label="Upfront cash to start (budget filter)">
                <strong>{formatIsk(iph.upfrontCapital)}</strong> = full blueprint + this batch
              </CalcStep>
            </StepCard>

            <StepCard
              step={10}
              title={`Haul out · ${haulOutLabel}${iph.haulExcluded ? ' (excluded)' : ''}`}
              result={formatIsk(iph.haulOut)}
              resultLabel="Haul out cost"
            >
              <CalcStep label="Product volume × route rate">
                {formatDecimal(iph.productVolumeM3, 2)} m³ ×{' '}
                {formatIsk(iph.haulOutIskPerM3)}/m³ ={' '}
                <strong>
                  {formatIsk(
                    iph.haulExcluded
                      ? iph.productVolumeM3 * iph.haulOutIskPerM3
                      : iph.haulOut,
                  )}
                </strong>
                {iph.haulExcluded ? (
                  <>
                    {' '}
                    → charged <strong>{formatIsk(0)}</strong>
                  </>
                ) : null}
              </CalcStep>
            </StepCard>

            <StepCard
              step={11}
              title="Batch profit"
              note="This is the profit pool ISK/hr spreads over time and market volume."
              result={formatIsk(iph.profitPerUnit) + '/unit'}
              resultLabel="Profit per unit"
            >
              <CalcStep label="Revenue minus all costs">
                {formatIsk(iph.netRevenue)} − {formatIsk(iph.setupCost)}
                {iph.haulExcluded ? null : <> − {formatIsk(iph.haulOut)}</>} ={' '}
                <strong>{formatIsk(iph.netProfit)}</strong>
              </CalcStep>
              <CalcStep label="Divide by output">
                {formatIsk(iph.netProfit)} ÷ {formatQuantity(iph.outputQty)} units
              </CalcStep>
            </StepCard>
          </div>

          <PhaseHeader
            title="Part 4 · ISK/hr rate"
            description="Turn batch profit into an hourly rate, then adjust for how much the market can absorb."
          />

          <div className="space-y-4">
            <StepCard
              step={12}
              title="Production rate"
              note="How many units you could finish per day at this job time."
              result={`${formatAvgVolume(iph.productionPerDay)} units/day`}
              resultLabel="Units produced per day"
            >
              <CalcStep label="Spread batch output across 24 hours">
                {formatQuantity(iph.outputQty)} units ÷ {formatDecimal(jobHours, 2)} hr × 24 hr/day
              </CalcStep>
            </StepCard>

            <StepCard
              step={13}
              title="Sellable volume"
              note="You cannot sell faster than the hub trades, even if you build faster."
              result={`${formatAvgVolume(iph.sellablePerDay)} units/day`}
              resultLabel="Units sold per day"
            >
              {iph.avgVolume > 0 ? (
                <CalcStep label="Take the lower of production and hub volume">
                  min({formatAvgVolume(iph.productionPerDay)} produced,{' '}
                  {formatAvgVolume(iph.avgVolume)} hub avg)
                </CalcStep>
              ) : (
                <CalcStep label="No volume history">
                  Sellable rate equals production: {formatAvgVolume(iph.sellablePerDay)} units/day
                </CalcStep>
              )}
            </StepCard>

            <StepCard
              step={14}
              title="Competition penalty"
              note="If your daily output is a large share of hub volume, profit is scaled down."
              result={formatDecimal(iph.competitionFactor, 4)}
              resultLabel="Competition factor"
            >
              {iph.avgVolume > 0 && iph.productionPerDay > 0 ? (
                <>
                  <CalcStep label="Your share of daily hub volume">
                    {formatAvgVolume(iph.productionPerDay)} ÷ {formatAvgVolume(iph.avgVolume)} ={' '}
                    <strong>{formatDecimal(iph.marketShare * 100, 1)}%</strong>
                  </CalcStep>
                  <CalcStep label="Penalty formula">
                    1 ÷ (1 + {formatDecimal(iph.marketShare * 100, 1)}%) ={' '}
                    <strong>{formatDecimal(iph.competitionFactor, 4)}</strong>
                  </CalcStep>
                </>
              ) : (
                <CalcStep label="No volume penalty">
                  Factor stays at <strong>{formatDecimal(iph.competitionFactor, 4)}</strong>
                </CalcStep>
              )}
            </StepCard>

            <StepCard
              step={15}
              title="Final ISK/hr"
              note="Daily profit at sellable rate, adjusted for competition, divided by 24 hours."
              result={formatIsk(iph.iph) + '/hr'}
              resultLabel="ISK per hour"
            >
              <CalcStep label="Daily profit at sellable rate">
                {formatAvgVolume(iph.sellablePerDay)} units/day × {formatIsk(iph.profitPerUnit)}/unit
                × {formatDecimal(iph.competitionFactor, 4)} ={' '}
                <strong>{formatIsk(iph.realizedDailyProfit)}/day</strong>
              </CalcStep>
              <CalcStep label="Convert to hourly">
                {formatIsk(iph.realizedDailyProfit)}/day ÷ 24 hr
              </CalcStep>
            </StepCard>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 text-[11px] opacity-60 space-y-1">
          <p>
            Rankings use global ME/TE and fee settings. Character skills (Advanced Industry,
            Accounting, Broker Relations) are not applied yet.
          </p>
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
