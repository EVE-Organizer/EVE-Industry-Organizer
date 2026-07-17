import type { PlanNode } from '@/types'

/** Buy lines for packaged structure inputs (blueprint material is the product itself). */
export function packagedBuyNodesFromPlan(nodes: PlanNode[]): PlanNode[] {
  const lines: PlanNode[] = []

  for (const parent of nodes) {
    const qty = parent.packagedBuyQty
    if (qty == null || qty <= 0) continue

    const unitPrice = parent.unitPrice
    lines.push({
      productTypeId: parent.productTypeId,
      name: parent.name,
      tier: parent.tier,
      mode: 'buy',
      totalDemandQty: qty,
      demandByParent: [{ parentProductTypeId: parent.productTypeId, qty }],
      parentProductTypeIds: [],
      childProductTypeIds: [],
      runs: 0,
      bpcCount: 0,
      concurrentCopies: 0,
      jobTimeSeconds: 0,
      outputQty: 0,
      isRoot: false,
      isLeaf: true,
      depth: parent.depth + 1,
      canToggle: false,
      unitPrice,
      buyCost: unitPrice != null && unitPrice > 0 ? unitPrice * qty : undefined,
      packagedInput: true,
    })
  }

  return lines
}
