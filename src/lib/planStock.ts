import { applyME } from '@/lib/cost'
import type { PlanNode, PlanStepProgress, ScheduledPlanJob } from '@/types'

export function allocateStartStock(
  nodes: Array<Pick<PlanNode, 'productTypeId' | 'isRoot' | 'mode' | 'totalDemandQty' | 'depth'>>,
  pooledStock: Map<number, number>,
): Record<number, number> {
  const stock = new Map(pooledStock)
  const allocated: Record<number, number> = {}
  const ordered = [...nodes]
    .filter((node) => node.mode === 'build' && !node.isRoot)
    .sort((a, b) => a.depth - b.depth)
  for (const node of ordered) {
    const have = stock.get(node.productTypeId) ?? 0
    const take = Math.min(have, Math.max(0, node.totalDemandQty))
    if (take <= 0) continue
    allocated[node.productTypeId] = take
    stock.set(node.productTypeId, have - take)
  }
  return allocated
}

/** Stock gained since start, plus inputs parents already installed. */
export function producedSinceStart(input: {
  stockNow: number
  startStock: number
  allocated: number
  consumedByStartedParents: number
}): number {
  return (
    Math.max(0, input.stockNow - (input.startStock - input.allocated)) +
    input.consumedByStartedParents
  )
}

/**
 * Components a job pulls from stock: the materials that are themselves built in this plan,
 * after ME for this job's runs. Market inputs are bought on the spot, so they are not listed.
 */
export function jobComponentNeed(input: {
  runs: number
  me: number
  materials: Array<{ typeId: number; quantity: number }>
  builtTypeIds: Set<number>
  nameOf: (typeId: number) => string
}): Array<{ typeId: number; name: string; qty: number }> {
  return applyME(input.materials, input.me, input.runs)
    .filter((m) => input.builtTypeIds.has(m.typeId) && m.quantity > 0)
    .map((m) => ({ typeId: m.typeId, name: input.nameOf(m.typeId), qty: m.quantity }))
}

export function stepReadiness(input: {
  ownerName: string
  need: Array<{ typeId: number; name: string; qty: number }>
  pooled: Map<number, number>
  byCharacter: Array<{ name: string; qty: Map<number, number> }>
}): string {
  const missing = input.need.filter((row) => (input.pooled.get(row.typeId) ?? 0) < row.qty)
  if (missing.length === 0) {
    for (const row of input.need) {
      const holder = input.byCharacter.find(
        (character) =>
          character.name !== input.ownerName && (character.qty.get(row.typeId) ?? 0) >= row.qty,
      )
      if (holder) return `Move ${row.name} ×${row.qty} ${holder.name} → ${input.ownerName}`
    }
    return 'Ready to install'
  }
  const first = missing[0]!
  const have = input.pooled.get(first.typeId) ?? 0
  return `Missing ${first.name} ×${first.qty - have}`
}

/**
 * Mark manufacture steps done from stock. A node's output so far is what its pooled stock gained
 * since start, plus what started parents already pulled out. Steps fill in BPO order.
 * Steps already tracked from ESI or marked by hand are left alone.
 */
export function stockStepProgress(input: {
  jobs: ScheduledPlanJob[]
  nodes: PlanNode[]
  startStock: Record<number, number>
  allocated: Record<number, number>
  pooled: Map<number, number>
  progress: Record<string, PlanStepProgress>
}): Record<string, PlanStepProgress> {
  const result: Record<string, PlanStepProgress> = {}
  const stepsOf = new Map<number, ScheduledPlanJob[]>()
  for (const job of input.jobs) {
    if (!job.stepKey || (job.activity !== 'manufacture' && job.activity !== 'reaction')) continue
    stepsOf.set(job.productTypeId, [...(stepsOf.get(job.productTypeId) ?? []), job])
  }

  // Share of a parent's steps that have started: its inputs are already out of stock
  const startedFraction = (productTypeId: number) => {
    const steps = stepsOf.get(productTypeId) ?? []
    if (steps.length === 0) return 0
    const started = steps.filter((s) => (input.progress[s.stepKey!]?.status ?? 'todo') !== 'todo')
    return started.length / steps.length
  }

  for (const node of input.nodes) {
    if (node.isRoot || node.mode !== 'build') continue
    const steps = [...(stepsOf.get(node.productTypeId) ?? [])].sort(
      (a, b) => (a.bpoIndex ?? 0) - (b.bpoIndex ?? 0),
    )
    if (steps.length === 0) continue

    const consumed = node.demandByParent.reduce(
      (sum, parent) => sum + parent.qty * startedFraction(parent.parentProductTypeId),
      0,
    )
    const produced = producedSinceStart({
      stockNow: input.pooled.get(node.productTypeId) ?? 0,
      startStock: input.startStock[node.productTypeId] ?? 0,
      allocated: input.allocated[node.productTypeId] ?? 0,
      consumedByStartedParents: consumed,
    })

    let cumulative = 0
    for (const step of steps) {
      cumulative += step.outputQty
      const held = input.progress[step.stepKey!]
      if (held && held.source !== 'stock') continue
      if (cumulative <= produced + 1e-9) {
        result[step.stepKey!] = { status: 'done', source: 'stock', characterKey: step.characterKey }
      }
    }
  }
  return result
}
