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
  return Math.max(0, ATTRIBUTE_TOTAL_POINTS - attributeSum(attrs))
}

export function zeroTemporaryBoost(): AttributeMap {
  return {
    intelligence: 0,
    memory: 0,
    perception: 0,
    willpower: 0,
    charisma: 0,
  }
}

export function effectiveAttributes(
  bases: AttributeMap,
  implants: ImplantBonuses,
  temporaryBoost: AttributeMap = zeroTemporaryBoost(),
): AttributeMap {
  return {
    intelligence: bases.intelligence + implants.intelligence + temporaryBoost.intelligence,
    memory: bases.memory + implants.memory + temporaryBoost.memory,
    perception: bases.perception + implants.perception + temporaryBoost.perception,
    willpower: bases.willpower + implants.willpower + temporaryBoost.willpower,
    charisma: bases.charisma + implants.charisma + temporaryBoost.charisma,
  }
}

/** Strip temporary boosts (e.g. cerebral accelerators) so remap bases sum to at most 99. */
export function normalizeRemapBases(bases: AttributeMap): AttributeMap {
  const result = { ...bases }
  let excess = attributeSum(result) - ATTRIBUTE_TOTAL_POINTS
  if (excess <= 0) return result

  const keys = [...EVE_ATTRIBUTES].sort((a, b) => result[b] - result[a])
  while (excess > 0) {
    let progress = false
    for (const key of keys) {
      if (excess <= 0) break
      if (result[key] > ATTRIBUTE_MIN) {
        result[key] -= 1
        excess -= 1
        progress = true
      }
    }
    if (!progress) break
  }
  return result
}

export function temporaryBoostBetween(raw: AttributeMap, normalized: AttributeMap): AttributeMap {
  return {
    intelligence: Math.max(0, raw.intelligence - normalized.intelligence),
    memory: Math.max(0, raw.memory - normalized.memory),
    perception: Math.max(0, raw.perception - normalized.perception),
    willpower: Math.max(0, raw.willpower - normalized.willpower),
    charisma: Math.max(0, raw.charisma - normalized.charisma),
  }
}

export function temporaryBoostTotal(boost: AttributeMap): number {
  return attributeSum(boost)
}

/** When every attribute has the same boost (typical cerebral accelerator). */
export function uniformTemporaryBoost(boost: AttributeMap): number | null {
  const values = EVE_ATTRIBUTES.map((key) => boost[key])
  if (values[0] <= 0) return null
  return values.every((value) => value === values[0]) ? values[0] : null
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

export interface EsiRemapSnapshot {
  bases: AttributeMap
  temporaryBoost: AttributeMap
}

/** Recover remap bases from ESI totals, separating implant bonuses and temporary boosts. */
export function basesFromEsiTotals(
  totals: AttributeMap,
  esiBonus: Partial<AttributeMap>,
): EsiRemapSnapshot {
  const raw: AttributeMap = {
    intelligence: clampAttribute(totals.intelligence - (esiBonus.intelligence ?? 0)),
    memory: clampAttribute(totals.memory - (esiBonus.memory ?? 0)),
    perception: clampAttribute(totals.perception - (esiBonus.perception ?? 0)),
    willpower: clampAttribute(totals.willpower - (esiBonus.willpower ?? 0)),
    charisma: clampAttribute(totals.charisma - (esiBonus.charisma ?? 0)),
  }
  const bases = normalizeRemapBases(raw)
  return {
    bases,
    temporaryBoost: temporaryBoostBetween(raw, bases),
  }
}
