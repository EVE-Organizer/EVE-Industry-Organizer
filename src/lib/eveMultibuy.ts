import { toBuyQuantity } from '@/lib/locationInventory'

export interface EveMultibuyLine {
  name: string
  quantity: number
}

export interface EveMultibuySource {
  productTypeId: number
  name: string
  totalDemandQty: number
}

/**
 * EVE Multibuy paste format: one `Name<TAB>Qty` line per type.
 * Matches hangar copy so Ctrl+V in the Multibuy window resolves types and stacks.
 */
export function formatEveMultibuyClipboard(lines: EveMultibuyLine[]): string {
  return lines
    .filter((line) => line.quantity > 0 && line.name.trim().length > 0)
    .map((line) => `${line.name.trim()}\t${Math.ceil(line.quantity)}`)
    .join('\n')
}

/** Merge duplicate type IDs, drop zero qty, sort by name for a stable clipboard. */
export function mergeEveMultibuyLines(
  lines: Array<EveMultibuyLine & { productTypeId: number }>,
): EveMultibuyLine[] {
  const byType = new Map<number, EveMultibuyLine>()

  for (const line of lines) {
    if (line.quantity <= 0 || !line.name.trim()) continue
    const prev = byType.get(line.productTypeId)
    if (prev) {
      prev.quantity += line.quantity
      continue
    }
    byType.set(line.productTypeId, { name: line.name, quantity: line.quantity })
  }

  return [...byType.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Shopping-list lines for plan buy nodes (To buy when inventory is on). */
export function eveMultibuyLinesFromBuyNodes(
  nodes: EveMultibuySource[],
  inventoryByTypeId: Map<number, number> | null | undefined,
  useInventory: boolean,
): EveMultibuyLine[] {
  return mergeEveMultibuyLines(
    nodes.map((node) => {
      const have = inventoryByTypeId?.get(node.productTypeId) ?? 0
      const quantity = useInventory ? toBuyQuantity(node.totalDemandQty, have) : node.totalDemandQty
      return { productTypeId: node.productTypeId, name: node.name, quantity }
    }),
  )
}

export function eveMultibuyTextFromBuyNodes(
  nodes: EveMultibuySource[],
  inventoryByTypeId: Map<number, number> | null | undefined,
  useInventory: boolean,
): string {
  return formatEveMultibuyClipboard(
    eveMultibuyLinesFromBuyNodes(nodes, inventoryByTypeId, useInventory),
  )
}
