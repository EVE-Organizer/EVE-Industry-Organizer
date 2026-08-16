import type { EveAttributeId } from '@/types'
import { defaultImplants, type ImplantBonuses } from '@/lib/skillAttributes'

/**
 * Canonical Cyber Learning type IDs by bonus.
 * +1 Limited, +2 Limited Beta, +3 Basic, +4 Standard, +5 Improved, +6 Advanced, +7 Elite.
 * Charisma has no Elite (+7) type in the SDE.
 */
export const IMPLANT_BONUS_MAX = 7

export const ATTRIBUTE_IMPLANT_BY_BONUS: Record<EveAttributeId, Readonly<Record<number, number>>> = {
  intelligence: { 1: 13287, 2: 14298, 3: 9943, 4: 10221, 5: 10222, 6: 10223, 7: 10224 },
  memory: { 1: 13284, 2: 14297, 3: 9941, 4: 10208, 5: 10209, 6: 10210, 7: 10211 },
  perception: { 1: 13283, 2: 14295, 3: 9899, 4: 10216, 5: 10217, 6: 10218, 7: 10219 },
  willpower: { 1: 13285, 2: 14296, 3: 9942, 4: 10212, 5: 10213, 6: 10214, 7: 10215 },
  charisma: { 1: 13286, 2: 14299, 3: 9956, 4: 10225, 5: 10226, 6: 10227 },
}

const TYPE_TO_BONUS = new Map<number, { attr: EveAttributeId; bonus: number }>()
for (const [attr, byBonus] of Object.entries(ATTRIBUTE_IMPLANT_BY_BONUS) as [
  EveAttributeId,
  Readonly<Record<number, number>>,
][]) {
  for (const [bonus, typeId] of Object.entries(byBonus)) {
    TYPE_TO_BONUS.set(typeId, { attr, bonus: Number(bonus) })
  }
}

const BONUS_LINE =
  /\+(\d+)\s+Bonus to (Intelligence|Memory|Perception|Willpower|Charisma)/gi

const ATTR_FROM_LABEL: Record<string, EveAttributeId> = {
  intelligence: 'intelligence',
  memory: 'memory',
  perception: 'perception',
  willpower: 'willpower',
  charisma: 'charisma',
}

export function implantBonusFromDescription(
  description: string | undefined,
): { attr: EveAttributeId; bonus: number } | null {
  if (!description) return null
  let best: { attr: EveAttributeId; bonus: number } | null = null
  for (const match of description.matchAll(BONUS_LINE)) {
    const bonus = Number(match[1])
    const attr = ATTR_FROM_LABEL[match[2].toLowerCase()]
    if (!attr || !Number.isFinite(bonus) || bonus < 1) continue
    if (!best || bonus > best.bonus) best = { attr, bonus }
  }
  return best
}

export function implantBonusFromTypeId(
  typeId: number,
  description?: string,
): { attr: EveAttributeId; bonus: number } | null {
  return TYPE_TO_BONUS.get(typeId) ?? implantBonusFromDescription(description)
}

/** Icon for a given attribute bonus tier (what-if picker or fallback). */
export function implantTypeIdForBonus(attr: EveAttributeId, bonus: number): number | null {
  if (bonus < 1 || bonus > IMPLANT_BONUS_MAX) return null
  return ATTRIBUTE_IMPLANT_BY_BONUS[attr][bonus] ?? null
}

/** Highest +N implant per attribute from fitted clone implant type IDs. */
export function implantsFromTypeIds(typeIds: readonly number[]): ImplantBonuses {
  return fittedImplantsFromTypeIds(typeIds).bonuses
}

export type FittedImplantState = {
  bonuses: ImplantBonuses
  /** Best-matching fitted type ID per attribute (for accurate icons). */
  typeIdByAttr: Record<EveAttributeId, number | null>
}

export function fittedImplantsFromTypeIds(
  typeIds: readonly number[],
  descriptionByTypeId?: ReadonlyMap<number, string | undefined>,
): FittedImplantState {
  const bonuses = defaultImplants()
  const typeIdByAttr: Record<EveAttributeId, number | null> = {
    intelligence: null,
    memory: null,
    perception: null,
    willpower: null,
    charisma: null,
  }

  for (const typeId of typeIds) {
    const match = implantBonusFromTypeId(typeId, descriptionByTypeId?.get(typeId))
    if (!match) continue
    if (match.bonus >= bonuses[match.attr]) {
      bonuses[match.attr] = match.bonus
      typeIdByAttr[match.attr] = typeId
    }
  }

  return { bonuses, typeIdByAttr }
}

/** Merge clone implant type IDs with ESI attribute bonus (bonus wins when higher). */
export function mergeImplantBonuses(
  fromTypeIds: ImplantBonuses,
  fromEsiBonus: Partial<ImplantBonuses>,
): ImplantBonuses {
  return {
    intelligence: Math.max(fromTypeIds.intelligence, fromEsiBonus.intelligence ?? 0),
    memory: Math.max(fromTypeIds.memory, fromEsiBonus.memory ?? 0),
    perception: Math.max(fromTypeIds.perception, fromEsiBonus.perception ?? 0),
    willpower: Math.max(fromTypeIds.willpower, fromEsiBonus.willpower ?? 0),
    charisma: Math.max(fromTypeIds.charisma, fromEsiBonus.charisma ?? 0),
  }
}

export function resolveImplantIconTypeId(
  attr: EveAttributeId,
  bonus: number,
  fittedTypeId: number | null | undefined,
): number | null {
  if (bonus <= 0) return null
  if (fittedTypeId != null) {
    const match = implantBonusFromTypeId(fittedTypeId)
    if (match?.attr === attr && match.bonus === bonus) return fittedTypeId
  }
  return implantTypeIdForBonus(attr, bonus)
}
