import type { EveAttributeId } from '@/types'

export const EVE_ATTRIBUTES: readonly EveAttributeId[] = [
  'intelligence',
  'memory',
  'perception',
  'willpower',
  'charisma',
] as const

export const ATTRIBUTE_LABELS: Record<EveAttributeId, string> = {
  intelligence: 'Intelligence',
  memory: 'Memory',
  perception: 'Perception',
  willpower: 'Willpower',
  charisma: 'Charisma',
}

export const ATTRIBUTE_TOTAL_POINTS = 99
export const ATTRIBUTE_MIN = 17
export const ATTRIBUTE_MAX = 27
export const DEFAULT_ATTRIBUTE_VALUE = 20

export type AttributeMap = Record<EveAttributeId, number>
export type ImplantBonuses = Record<EveAttributeId, number>

export function defaultAttributes(): AttributeMap {
  return {
    intelligence: DEFAULT_ATTRIBUTE_VALUE,
    memory: DEFAULT_ATTRIBUTE_VALUE,
    perception: DEFAULT_ATTRIBUTE_VALUE,
    willpower: DEFAULT_ATTRIBUTE_VALUE,
    charisma: DEFAULT_ATTRIBUTE_VALUE - 1,
  }
}

export function defaultImplants(): ImplantBonuses {
  return {
    intelligence: 0,
    memory: 0,
    perception: 0,
    willpower: 0,
    charisma: 0,
  }
}

export function attributeSum(attrs: AttributeMap): number {
  return EVE_ATTRIBUTES.reduce((sum, key) => sum + attrs[key], 0)
}

export function remainingRemapPoints(attrs: AttributeMap): number {
  return ATTRIBUTE_TOTAL_POINTS - attributeSum(attrs)
}

export function effectiveAttributes(
  bases: AttributeMap,
  implants: ImplantBonuses,
): AttributeMap {
  return {
    intelligence: bases.intelligence + implants.intelligence,
    memory: bases.memory + implants.memory,
    perception: bases.perception + implants.perception,
    willpower: bases.willpower + implants.willpower,
    charisma: bases.charisma + implants.charisma,
  }
}

export function clampAttribute(value: number): number {
  return Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, Math.round(value)))
}

/** Adjust one base attribute by delta; returns null if out of bounds. */
export function adjustAttributeBase(
  attrs: AttributeMap,
  key: EveAttributeId,
  delta: number,
): AttributeMap | null {
  const next = clampAttribute(attrs[key] + delta)
  if (next === attrs[key]) return null
  return { ...attrs, [key]: next }
}

/** Bases from ESI totals minus implant bonus fields. */
export function basesFromEsiTotals(
  totals: AttributeMap,
  esiBonus: Partial<AttributeMap>,
): AttributeMap {
  return {
    intelligence: clampAttribute(totals.intelligence - (esiBonus.intelligence ?? 0)),
    memory: clampAttribute(totals.memory - (esiBonus.memory ?? 0)),
    perception: clampAttribute(totals.perception - (esiBonus.perception ?? 0)),
    willpower: clampAttribute(totals.willpower - (esiBonus.willpower ?? 0)),
    charisma: clampAttribute(totals.charisma - (esiBonus.charisma ?? 0)),
  }
}
