import { Tooltip } from '@/components/Tooltip'
import { formatGraphQuantity } from '@/lib/profit'

const STOCK_PROGRESS_STEPS = 5

export function stockProgressPercent(
  have: number | undefined,
  gross: number | undefined,
): number | null {
  if (have == null || gross == null || gross <= 0) return null
  return Math.min(100, (have / gross) * 100)
}

/** Mini 5-step hangar fill vs demand, used on Production jobs and supply chain. */
export function PlanStockProgressBar({
  have,
  gross,
}: {
  have: number | undefined
  gross: number | undefined
}) {
  const percent = stockProgressPercent(have, gross)
  if (percent == null) return null
  const onHand = have ?? 0
  const target = gross ?? 0
  const still = Math.max(0, target - onHand)
  const label =
    still > 0
      ? `${formatGraphQuantity(onHand)} of ${formatGraphQuantity(target)} on hand · ${formatGraphQuantity(still)} still needed`
      : `${formatGraphQuantity(onHand)} of ${formatGraphQuantity(target)} on hand · fully covered`
  const filledSteps = Math.min(
    STOCK_PROGRESS_STEPS,
    Math.round((percent / 100) * STOCK_PROGRESS_STEPS),
  )
  const full = percent >= 100

  return (
    <Tooltip text={label} placement="top" className="w-[4.5rem]">
      <div
        className="plan-jobs-table__stock-stepper cursor-help"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {Array.from({ length: STOCK_PROGRESS_STEPS }, (_, index) => (
          <span
            key={index}
            className={
              index < filledSteps
                ? full
                  ? 'plan-jobs-table__stock-stepper-seg plan-jobs-table__stock-stepper-seg--full'
                  : 'plan-jobs-table__stock-stepper-seg plan-jobs-table__stock-stepper-seg--filled'
                : 'plan-jobs-table__stock-stepper-seg'
            }
          />
        ))}
      </div>
    </Tooltip>
  )
}
