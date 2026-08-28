import { InfoTooltip } from '@/components/InfoTooltip'

const ME_TOOLTIP =
  'Material Efficiency (ME) rig fitted for this row. Lowers input materials. Pick None, T1, or T2 to match what is installed in-game.'
const TE_TOOLTIP =
  'Time Efficiency (TE) rig fitted for this row. Shortens job duration. Pick None, T1, or T2 to match what is installed in-game.'
const EFFICIENCY_TOOLTIP =
  'Combined ME and TE rig (L-Set). One fitted rig applies both material and time bonuses. Pick None, T1, or T2 to match what is installed in-game.'

function HeaderCell({
  label,
  tooltip,
  className,
}: {
  label: string
  tooltip: string
  className?: string
}) {
  return (
    <span
      className={`flex min-w-0 items-center justify-end gap-1 text-[10px] opacity-50 ${className ?? ''}`}
    >
      <span className="truncate">{label}</span>
      <InfoTooltip text={tooltip} />
    </span>
  )
}

/** Column labels above the ME and TE rig dropdowns (M-Set layout). */
export function RigMeTeHeaders() {
  return (
    <div className="mb-1 grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_7.25rem] items-center gap-2">
      <span aria-hidden />
      <span aria-hidden />
      <HeaderCell label="ME rig" tooltip={ME_TOOLTIP} />
      <HeaderCell label="TE rig" tooltip={TE_TOOLTIP} />
    </div>
  )
}

/** Column label above a single combined efficiency dropdown (L-Set layout). */
export function RigEfficiencyHeader() {
  return (
    <div className="mb-1 grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2">
      <span aria-hidden />
      <span aria-hidden />
      <HeaderCell label="Efficiency rig" tooltip={EFFICIENCY_TOOLTIP} />
    </div>
  )
}

const COST_TOOLTIP =
  'Cost optimization rig fitted for this row. Lowers science job fees (copy/invention cost index). Pick None, T1, or T2 to match what is installed in-game.'
const LAB_TIME_TOOLTIP =
  'Accelerator rig fitted for this row. Shortens copy or invention job duration. Pick None, T1, or T2 to match what is installed in-game.'
const LAB_OPTIMIZATION_TOOLTIP =
  'Combined cost and time optimization rig (L-Set or XL-Set). One fitted rig applies both bonuses. Pick None, T1, or T2 to match what is installed in-game.'

/** Column labels above laboratory cost and time rig dropdowns (M-Set layout). */
export function RigCostTimeHeaders() {
  return (
    <div className="mb-1 grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_7.25rem] items-center gap-2">
      <span aria-hidden />
      <span aria-hidden />
      <HeaderCell label="Cost rig" tooltip={COST_TOOLTIP} />
      <HeaderCell label="Time rig" tooltip={LAB_TIME_TOOLTIP} />
    </div>
  )
}

/** Column label above a laboratory optimization dropdown (L/XL-Set layout). */
export function LabOptimizationHeader() {
  return (
    <div className="mb-1 grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2">
      <span aria-hidden />
      <span aria-hidden />
      <HeaderCell label="Optimization rig" tooltip={LAB_OPTIMIZATION_TOOLTIP} />
    </div>
  )
}
