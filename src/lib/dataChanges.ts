export interface JobSnapshot {
  jobId: number
  status: string
  productTypeId?: number
}

export interface JobDiff {
  finished: number
  added: number
  statusChanged: number
}

const FINISHED = new Set(['ready', 'delivered'])

/** Compare industry jobs by job id. */
export function diffJobs(before: JobSnapshot[], after: JobSnapshot[]): JobDiff {
  const prev = new Map(before.map((job) => [job.jobId, job]))
  const next = new Map(after.map((job) => [job.jobId, job]))
  let finished = 0
  let added = 0
  let statusChanged = 0
  for (const job of after) {
    const old = prev.get(job.jobId)
    if (!old) {
      added += 1
      continue
    }
    if (old.status !== job.status) {
      if (FINISHED.has(job.status) && !FINISHED.has(old.status)) finished += 1
      else statusChanged += 1
    }
  }
  for (const job of before) {
    if (!next.has(job.jobId) && !FINISHED.has(job.status)) finished += 1
  }
  return { finished, added, statusChanged }
}

export interface AssetDiff {
  changed: number
}

/** Quantity changes by type id. Missing keys count as zero. */
export function diffAssets(before: Map<number, number>, after: Map<number, number>): AssetDiff {
  const ids = new Set([...before.keys(), ...after.keys()])
  let changed = 0
  for (const id of ids) {
    if ((before.get(id) ?? 0) !== (after.get(id) ?? 0)) changed += 1
  }
  return { changed }
}

export interface SkillDiff {
  changed: number
}

export function diffSkills(
  before: Record<string, number>,
  after: Record<string, number>,
): SkillDiff {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  let changed = 0
  for (const key of keys) {
    if ((before[key] ?? 0) !== (after[key] ?? 0)) changed += 1
  }
  return { changed }
}

export interface PriceChange {
  typeId: number
  before: number
  after: number
}

/** Prices that moved by more than `threshold` (fraction, default 0.5%). */
export function diffPrices(
  before: Map<number, number>,
  after: Map<number, number>,
  threshold = 0.005,
): PriceChange[] {
  const changes: PriceChange[] = []
  for (const [typeId, next] of after) {
    const prev = before.get(typeId)
    if (prev == null || prev <= 0) continue
    if (Math.abs(next - prev) / prev > threshold) {
      changes.push({ typeId, before: prev, after: next })
    }
  }
  return changes
}
