import { formatIsk } from '@/lib/profit'
import type { PlanNode } from '@/types'

export function planBuildVsBuyFootnote(
  node: PlanNode,
): { text: string; accent: string } | null {
  if (node.isRoot || !node.canToggle || node.savings == null || node.savings === 0) return null

  const delta = Math.abs(node.savings)
  const alternative = node.mode === 'build' ? 'buy' : 'build'
  const currentIsCheaper =
    node.mode === 'build' ? node.savings > 0 : node.savings < 0

  if (currentIsCheaper) {
    return { text: `save ${formatIsk(delta)} vs ${alternative}`, accent: 'text-success' }
  }
  return { text: `+${formatIsk(delta)} vs ${alternative}`, accent: 'text-error' }
}

export function planBuildVsBuySummary(node: PlanNode): string | null {
  if (node.isRoot || !node.canToggle || node.buyCost == null || node.buildCost == null) return null
  return `Buy ${formatIsk(node.buyCost)} · Build ${formatIsk(node.buildCost)}`
}
