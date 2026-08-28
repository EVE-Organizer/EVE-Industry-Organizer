import type { EveAttributeId } from '@/types'
import { ATTRIBUTE_IMPLANT_BY_BONUS } from '@/pages/Skills/skillImplants'

export interface AttributeTheme {
  color: string
  label: string
  short: string
}

/** EVE client attribute colors (approximate). */
export const ATTRIBUTE_THEME: Record<EveAttributeId, AttributeTheme> = {
  intelligence: { color: '#5b8fd4', label: 'Intelligence', short: 'Int' },
  memory: { color: '#c9a227', label: 'Memory', short: 'Mem' },
  perception: { color: '#c74a4a', label: 'Perception', short: 'Per' },
  willpower: { color: '#3eb8b8', label: 'Willpower', short: 'Wil' },
  charisma: { color: '#b85ba8', label: 'Charisma', short: 'Cha' },
}

/** Basic (+3) Cyber Learning implant type IDs. These have working Image Service icons. */
export const ATTRIBUTE_ICON_TYPE_IDS: Record<EveAttributeId, number> = {
  intelligence: ATTRIBUTE_IMPLANT_BY_BONUS.intelligence[3],
  memory: ATTRIBUTE_IMPLANT_BY_BONUS.memory[3],
  perception: ATTRIBUTE_IMPLANT_BY_BONUS.perception[3],
  willpower: ATTRIBUTE_IMPLANT_BY_BONUS.willpower[3],
  charisma: ATTRIBUTE_IMPLANT_BY_BONUS.charisma[3],
}

/** Cybernetic Subprocessor - Basic: generic implant-category chip. */
export const IMPLANT_CATEGORY_TYPE_ID = ATTRIBUTE_IMPLANT_BY_BONUS.intelligence[3]

export function attributeBarWidth(effective: number, maxDisplay = 34): number {
  return Math.min(100, Math.max(4, ((effective - 17) / (maxDisplay - 17)) * 100))
}
