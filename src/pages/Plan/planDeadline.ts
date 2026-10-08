export interface DeadlineCandidate {
  productTypeId: number
  name: string
  /** BPO count the plan uses today for this component. */
  copies: number
}

export interface DeadlineStep {
  productTypeId: number
  name: string
  copies: number
  /** Root ready time after this step is applied. */
  finishesAtHours: number
}

export interface DeadlineSuggestion {
  steps: DeadlineStep[]
  finishesAtHours: number
  meetsDeadline: boolean
  /** Shown when extra component BPOs cannot reach the deadline. */
  hint?: string
}

export const DEADLINE_MAX_ITERATIONS = 10

/** Minimum hours a step must save to be worth suggesting. */
const MIN_GAIN_HOURS = 0.01

const DEADLINE_HOUR_EPS = 1 / 3600

export type ReadyByAssessment =
  | { status: 'none' }
  | { status: 'onTime' }
  | {
      status: 'late'
      lateHours: number
      /** Component BPOs can be tried. False when the root job timer itself is longer than the deadline. */
      fixable: boolean
    }

/**
 * Ready by is a plan-clock deadline. Fix adds component BPOs and/or lowers root runs.
 */
export function assessReadyBy(input: {
  readyByHours?: number
  finishesAtHours?: number
  /** In-game timer for this root job (`rootJobTimeHours`). */
  rootJobHours?: number
  componentBuildCount: number
}): ReadyByAssessment {
  const { readyByHours, finishesAtHours } = input
  if (readyByHours == null || finishesAtHours == null) return { status: 'none' }
  if (finishesAtHours <= readyByHours + DEADLINE_HOUR_EPS) return { status: 'onTime' }
  return {
    status: 'late',
    lateHours: finishesAtHours - readyByHours,
    fixable: true,
  }
}

/**
 * Greedy BPO suggestion for one late root.
 * Each round tries one more BPO on every candidate, keeps the one that saves the most time,
 * and stops on the deadline, no gain, or the iteration cap.
 * `finishFor` re-schedules the plan with the given copies and returns the root's ready hour.
 */
export function suggestDeadlinePlan(input: {
  readyByHours: number
  candidates: DeadlineCandidate[]
  finishFor: (copiesByProduct: Map<number, number>) => number
  maxIterations?: number
}): DeadlineSuggestion {
  const copies = new Map(input.candidates.map((c) => [c.productTypeId, c.copies]))
  const steps: DeadlineStep[] = []
  let finish = input.finishFor(copies)
  const maxIterations = input.maxIterations ?? DEADLINE_MAX_ITERATIONS

  for (let i = 0; i < maxIterations && finish > input.readyByHours; i++) {
    /* ----- Try one more BPO on each candidate ----- */

    let best: { candidate: DeadlineCandidate; finish: number } | null = null
    for (const candidate of input.candidates) {
      const trial = new Map(copies)
      trial.set(candidate.productTypeId, (copies.get(candidate.productTypeId) ?? 1) + 1)
      const trialFinish = input.finishFor(trial)
      if (!best || trialFinish < best.finish) best = { candidate, finish: trialFinish }
    }

    /* ----- Keep the best step if it saves time ----- */

    if (!best || finish - best.finish < MIN_GAIN_HOURS) break
    const nextCopies = (copies.get(best.candidate.productTypeId) ?? 1) + 1
    copies.set(best.candidate.productTypeId, nextCopies)
    finish = best.finish
    steps.push({
      productTypeId: best.candidate.productTypeId,
      name: best.candidate.name,
      copies: nextCopies,
      finishesAtHours: finish,
    })

    // One extra BPO per round cannot close a long chain. Double this bottleneck while it still saves time.
    let jump = 2
    while (jump <= 32 && finish > input.readyByHours) {
      const trial = new Map(copies)
      const jumped = (copies.get(best.candidate.productTypeId) ?? 1) + jump
      trial.set(best.candidate.productTypeId, jumped)
      const trialFinish = input.finishFor(trial)
      if (finish - trialFinish < MIN_GAIN_HOURS) break
      copies.set(best.candidate.productTypeId, jumped)
      finish = trialFinish
      steps.push({
        productTypeId: best.candidate.productTypeId,
        name: best.candidate.name,
        copies: jumped,
        finishesAtHours: finish,
      })
      jump *= 2
    }
  }

  const meetsDeadline = finish <= input.readyByHours
  return {
    steps,
    finishesAtHours: finish,
    meetsDeadline,
    hint: meetsDeadline
      ? undefined
      : steps.length === 0
        ? 'Component BPOs do not shorten this finish. Fix will lower runs to match Ready by.'
        : 'Added component BPOs, but the chain still finishes after the deadline. Fix will lower runs.',
  }
}

export interface DeadlineRunsAdjustment {
  runs: number
  finishesAtHours: number
  meetsDeadline: boolean
}

/**
 * Largest per-line root run count whose scheduled chain finish is on or before the deadline.
 * Searches down from the current count when late, and up toward `maxRuns` when there is slack.
 */
export function findMaxRootRunsMeetingDeadline(input: {
  readyByHours: number
  currentRuns: number
  finishForRuns: (runs: number) => number
  maxRuns?: number
}): DeadlineRunsAdjustment {
  const { readyByHours, currentRuns, finishForRuns } = input
  const floor = Math.max(1, Math.floor(currentRuns))
  const hardCap = Math.max(floor, Math.floor(input.maxRuns ?? floor))

  let hi = floor
  let searchHi = floor
  const floorFinish = finishForRuns(hi)
  if (floorFinish <= readyByHours + DEADLINE_HOUR_EPS && hi < hardCap) {
    let step = Math.max(1, Math.ceil(hi / 2))
    while (hi < hardCap) {
      const next = Math.min(hardCap, hi + step)
      if (next === hi) break
      const finish = finishForRuns(next)
      searchHi = next
      if (finish > readyByHours + DEADLINE_HOUR_EPS) break
      hi = next
      step *= 2
    }
  } else {
    searchHi = floor
  }

  let lo = 1
  hi = searchHi
  let bestRuns = 1
  let bestFinish = finishForRuns(1)

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const finish = finishForRuns(mid)
    if (finish <= readyByHours + DEADLINE_HOUR_EPS) {
      bestRuns = mid
      bestFinish = finish
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return {
    runs: bestRuns,
    finishesAtHours: bestFinish,
    meetsDeadline: bestFinish <= readyByHours + DEADLINE_HOUR_EPS,
  }
}
