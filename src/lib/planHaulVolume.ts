import { toBuyQuantity } from '@/lib/locationInventory'
import type { PlanNode } from '@/types'

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
