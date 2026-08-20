import type { FittingIndex, FittingType, ParsedFit, ResolvedFitItem } from '@/lib/fitting/types'

export interface ChargeModuleGroup {
  key: string
  moduleTypeId: number
  label: string
  quantity: number
  module: FittingType
  options: FittingType[]
  defaultChargeId: number | null
}

export function moduleGroupsNeedingCharges(items: ResolvedFitItem[]): ResolvedFitItem[] {
  return items.filter(
    (item) =>
      !item.offline &&
      item.type.category === 'Module' &&
      (item.type.combat?.chargeGroups?.length ?? 0) > 0,
  )
}

export function groupChargeModules(items: ResolvedFitItem[]): Map<string, ResolvedFitItem[]> {
  const groups = new Map<string, ResolvedFitItem[]>()
  for (const item of moduleGroupsNeedingCharges(items)) {
    const key = String(item.type.typeId)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return groups
}

export function compatibleCharges(
  module: FittingType,
  index: FittingIndex,
): FittingType[] {
  const groups = new Set(module.combat?.chargeGroups ?? [])
  const size = module.combat?.chargeSize
  if (!groups.size && !size) return []
  const out: FittingType[] = []
  for (const type of index.byId.values()) {
    if (type.category !== 'Charge') continue
    if (size && type.combat?.chargeSize && type.combat.chargeSize !== size) continue
    const cg = type.combat?.chargeGroup
    if (cg && groups.has(cg)) {
      out.push(type)
      continue
    }
    // ponytail: many crystals lack chargeGroup attrs; match by size + combat payload
    if (
      groups.size &&
      size &&
      type.combat?.chargeSize === size &&
      (type.combat.damage || type.combat.miningAmount)
    ) {
      out.push(type)
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Charges listed in the EFT paste (cargo + inline weapon charges) that fit this module. */
export function eftChargeOptions(
  module: FittingType,
  parsed: ParsedFit,
  index: FittingIndex,
  groupItems: ResolvedFitItem[],
): FittingType[] {
  const compatibleIds = new Set(compatibleCharges(module, index).map((c) => c.typeId))
  const byId = new Map<number, FittingType>()

  for (const item of parsed.items) {
    if (item.chargeName) {
      const mod = index.byName.get(item.name.trim().toLowerCase())
      if (mod?.typeId !== module.typeId) continue
      const charge = index.byName.get(item.chargeName.trim().toLowerCase())
      if (charge && compatibleIds.has(charge.typeId)) byId.set(charge.typeId, charge)
      continue
    }
    const type = index.byName.get(item.name.trim().toLowerCase())
    if (type?.category === 'Charge' && compatibleIds.has(type.typeId)) {
      byId.set(type.typeId, type)
    }
  }

  for (const item of groupItems) {
    if (item.charge && compatibleIds.has(item.charge.typeId)) {
      byId.set(item.charge.typeId, item.charge)
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function defaultChargeForGroup(
  groupItems: ResolvedFitItem[],
  parsed: ParsedFit,
  index: FittingIndex,
): FittingType | undefined {
  const module = groupItems[0]?.type
  if (!module) return undefined
  const options = eftChargeOptions(module, parsed, index, groupItems)
  if (!options.length) return undefined
  const optionIds = new Set(options.map((c) => c.typeId))

  for (const item of groupItems) {
    if (item.charge && optionIds.has(item.charge.typeId)) return item.charge
  }

  for (const item of parsed.items) {
    if (item.chargeName) {
      const mod = index.byName.get(item.name.trim().toLowerCase())
      if (mod?.typeId !== module.typeId) continue
      const charge = index.byName.get(item.chargeName.trim().toLowerCase())
      if (charge && optionIds.has(charge.typeId)) return charge
      continue
    }
    const type = index.byName.get(item.name.trim().toLowerCase())
    if (type?.category === 'Charge' && optionIds.has(type.typeId)) return type
  }

  return options[0]
}

export function buildChargeGroups(
  items: ResolvedFitItem[],
  parsed: ParsedFit,
  index: FittingIndex,
): ChargeModuleGroup[] {
  const grouped = groupChargeModules(items)
  const result: ChargeModuleGroup[] = []
  for (const [key, groupItems] of grouped) {
    const module = groupItems[0].type
    const qty = groupItems.reduce((sum, item) => sum + item.quantity, 0)
    const options = eftChargeOptions(module, parsed, index, groupItems)
    const def = defaultChargeForGroup(groupItems, parsed, index)
    result.push({
      key,
      moduleTypeId: module.typeId,
      label: `${module.name} ×${qty}`,
      quantity: qty,
      module,
      options,
      defaultChargeId: def?.typeId ?? null,
    })
  }
  return result.sort((a, b) => a.label.localeCompare(b.label))
}

export function applyChargeSelections(
  items: ResolvedFitItem[],
  selections: Map<string, number | null>,
  index: FittingIndex,
): ResolvedFitItem[] {
  return items.map((item) => {
    if (!item.type.combat?.chargeGroups?.length) return item
    const chargeId = selections.get(String(item.type.typeId))
    if (chargeId == null) return { ...item, charge: undefined }
    const charge = index.byId.get(chargeId)
    return { ...item, charge }
  })
}

export function initialChargeSelections(groups: ChargeModuleGroup[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const group of groups) {
    map.set(group.key, group.defaultChargeId)
  }
  return map
}
