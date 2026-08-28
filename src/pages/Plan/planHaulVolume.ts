import { toBuyQuantity } from '@/lib/locationInventory'
import type { PlanBuildMode, PlanNode } from '@/types'

export function buyHaulQuantity(
  node: PlanNode,
  have: number,
  useInventory: boolean,
): number {
  if (useInventory) return toBuyQuantity(node.totalDemandQty, have)
  return node.totalDemandQty
}

export function volumeM3(
  typeId: number,
  quantity: number,
  typeVolumes: Map<number, number>,
): number {
  if (quantity <= 0) return 0
  return quantity * (typeVolumes.get(typeId) ?? 0)
}

export function nodeHaulInVolumeM3(
  node: PlanNode,
  have: number,
  useInventory: boolean,
  typeVolumes: Map<number, number>,
): number {
  return volumeM3(node.productTypeId, buyHaulQuantity(node, have, useInventory), typeVolumes)
}

export function nodeHaulOutVolumeM3(
  node: PlanNode,
  typeVolumes: Map<number, number>,
): number {
  return volumeM3(node.productTypeId, node.outputQty, typeVolumes)
}

/** Cargo hauled from hub for buy-mode nodes and packaged self-input. Root buy skips haul. */
export function rootHaulVolumesFromNodes(
  nodes: PlanNode[],
  rootMode: PlanBuildMode,
  productTypeId: number,
  outputQty: number,
  typeVolumes: Map<number, number>,
): { haulInM3: number; haulOutM3: number } {
  if (rootMode === 'buy') {
    return { haulInM3: 0, haulOutM3: 0 }
  }

  let haulInM3 = 0
  for (const node of nodes) {
    if (node.mode === 'buy' && !node.isRoot) {
      haulInM3 += volumeM3(node.productTypeId, node.totalDemandQty, typeVolumes)
    }
    if (node.packagedBuyQty && node.packagedBuyQty > 0) {
      haulInM3 += volumeM3(node.productTypeId, node.packagedBuyQty, typeVolumes)
    }
  }

  const haulOutM3 = volumeM3(productTypeId, outputQty, typeVolumes)
  return { haulInM3, haulOutM3 }
}
