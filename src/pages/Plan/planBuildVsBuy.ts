import { formatIsk } from '@/lib/profit'
import type { PlanNode } from '@/types'

export function planBuildVsBuyFootnote(node: PlanNode): { text: string; accent: string } | null {
  if (node.isRoot || !node.canToggle || node.savings == null || node.savings === 0) return null

  const delta = Math.abs(node.savings)
  const alternative = node.mode === 'build' ? 'buy' : 'build'
  const currentIsCheaper = node.mode === 'build' ? node.savings > 0 : node.savings < 0

  if (currentIsCheaper) {
    return { text: `save ${formatIsk(delta)} vs ${alternative}`, accent: 'text-success' }
  }
  return { text: `+${formatIsk(delta)} vs ${alternative}`, accent: 'text-error' }
}

export function planBuildVsBuySummary(node: PlanNode): string | null {
  if (node.isRoot || !node.canToggle || node.buyCost == null || node.buildCost == null) return null
  return `Buy ${formatIsk(node.buyCost)} · Build ${formatIsk(node.buildCost)}`
}

/** Setup column value for a non-root plan node (matches active build/buy mode). */
export function nodeSetupCost(
  node: Pick<PlanNode, 'mode' | 'buyCost' | 'buildCost'>,
): number | null {
  const cost = node.mode === 'buy' ? node.buyCost : node.buildCost
  return cost != null && cost > 0 ? cost : null
}
