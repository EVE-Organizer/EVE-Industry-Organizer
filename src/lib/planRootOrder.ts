import type { PlanRootEntry } from '@/types'

export function movePlanRootById(
  roots: PlanRootEntry[],
  fromId: string,
  toId: string,
): PlanRootEntry[] {
  const from = roots.findIndex((r) => r.id === fromId)
  const to = roots.findIndex((r) => r.id === toId)
  if (from < 0 || to < 0 || from === to) return roots
  const next = roots.slice()
  const [item] = next.splice(from, 1)
  if (!item) return roots
  next.splice(to, 0, item)
  return next
}

export function duplicatePlanRootAfter(
  roots: PlanRootEntry[],
  rootId: string,
  newId: string,
): PlanRootEntry[] {
  const idx = roots.findIndex((r) => r.id === rootId)
  if (idx < 0) return roots
  const source = roots[idx]
  if (!source) return roots
  const next = roots.slice()
  next.splice(idx + 1, 0, { ...source, id: newId })
  return next
}
