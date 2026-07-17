/** Sum of root run counts for the active plan template. */
export function totalRootRuns(rootRuns: number[]): number {
  return rootRuns.reduce((sum, runs) => sum + runs, 0)
}

/** How many root entries share the same product (each gets its own industry slot). */
export function duplicateRootCount(
  roots: readonly { productTypeId: number }[],
  productTypeId: number,
): number {
  let count = 0
  for (const root of roots) {
    if (root.productTypeId === productTypeId) count++
  }
  return count
}

/**
 * Parallel BPC lines this component should run so output keeps pace with the
 * root batch (ceil(bpcCount / rootRuns), capped by copies available).
 */
export function supplySlotsForComponent(bpcCount: number, rootRunsTotal: number): number {
  if (bpcCount <= 0 || rootRunsTotal <= 0) return 0
  return Math.min(bpcCount, Math.max(1, Math.ceil(bpcCount / rootRunsTotal)))
}

/** Industry lines the plan can actually schedule for this node. */
export function activeConcurrentCopies(
  isRoot: boolean,
  bpcCount: number,
  skillSlots: number,
  rootRunsTotal: number,
  duplicateRoots = 1,
): number {
  if (bpcCount <= 0) return 0
  if (isRoot) return Math.min(skillSlots, Math.max(1, duplicateRoots))
  const supply = supplySlotsForComponent(bpcCount, rootRunsTotal)
  return Math.min(skillSlots, bpcCount, supply)
}
