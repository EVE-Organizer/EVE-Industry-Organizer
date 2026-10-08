import type { ExpandablePlanRow } from '@/pages/Plan/planTreeLines'
import type { PlanCharacterKey } from '@/types'

export type BuildBlueprintRow = ExpandablePlanRow & {
  rootId?: string
  rootInstance?: number
  rootInstanceTotal?: number
  productTypeId: number
  blueprintTypeId?: number
  name: string
  runs: number
  jobTimeHours: number
  durationHours?: number
  outputQty: number
  isRoot: boolean
  enabled?: boolean
  bpos?: number
  suggestedBpos?: number
  suggestedCopyBpos?: number
  /** T1 BPO lines for T2 copy jobs (stored override). */
  copyBpos?: number
  bposHint?: string
  readyByHours?: number
  finishesAtHours?: number
  /** Non-root build jobs under this root. Ready-by Fix only applies when this is > 0. */
  componentBuildCount?: number
  characterKey?: PlanCharacterKey
  /** Child row shows an owner inherited from its root, not a stored pin. */
  ownerInherited?: boolean
  progress?: { percent: number; done: number; total: number; runningPercent?: number }
  haveBpcs?: boolean
  /** Runs synced from Ready by (typed time or Fix), not Duration. */
  runsFromReadyBy?: boolean
  /** Runs synced from Duration (Production timer, Overall deadline, or Set all). */
  runsFromDuration?: boolean
}

/** Stored duration target when set; otherwise the computed job timer. */
export function rowDurationHours(row: BuildBlueprintRow): number {
  return row.durationHours && row.durationHours > 0 ? row.durationHours : row.jobTimeHours
}

export const RUNS_FROM_READY_BY_TOOLTIP =
  'Fix lowered these runs to meet Ready by. Edit Duration to set the job timer yourself.'

export function runsFromDurationTooltip(durationMode: 'production' | 'overall'): string {
  if (durationMode === 'overall') {
    return 'Runs follow the Overall deadline on Duration (including Set all). They may shrink again when the schedule updates. Edit Duration to change them.'
  }
  return 'Runs were calculated from your Duration target (including Set all). Edit Duration to recalculate, or switch to Production to edit runs directly.'
}

/** TanStack column ids including pinned product/actions. */
export type PlanJobsTableColumnId =
  | import('@/pages/Plan/planJobsTableLayout').PlanJobsColumnId
  | 'product'
  | 'actions'
