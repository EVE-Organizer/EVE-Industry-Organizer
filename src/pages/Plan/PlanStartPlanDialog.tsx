import { formatDecimal } from '@/lib/profit'

export interface StockPreviewLine {
  name: string
  have: number
  need: number
  builds: number
  jobsBefore: number
  jobsAfter: number
}

/** Confirms Start plan with stock reduction preview. */
export function PlanStartPlanDialog({
  open,
  characterNames,
  stockLines,
  onCancel,
  onConfirm,
}: {
  open: boolean
  characterNames: string[]
  stockLines: StockPreviewLine[]
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg">Start plan?</h3>
        <ul className="mt-3 list-disc pl-5 text-sm opacity-80 space-y-1">
          <li>Records start time ({new Date().toLocaleString()})</li>
          <li>Freezes the step list used to match ESI jobs</li>
          {stockLines.length > 0 ? (
            stockLines.map((line) => (
              <li key={line.name}>
                Using station stock: {line.name} {formatDecimal(line.have, 0)} of{' '}
                {formatDecimal(line.need, 0)} → builds {formatDecimal(line.builds, 0)} (
                {line.jobsBefore} jobs → {line.jobsAfter} jobs)
              </li>
            ))
          ) : (
            <li>No station stock applied at this location</li>
          )}
          {characterNames.length > 0 ? (
            <li>Matches ESI jobs and station items for: {characterNames.join(', ')}</li>
          ) : null}
        </ul>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Start plan
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onCancel}>
        <button type="submit">close</button>
      </form>
    </dialog>
  )
}
