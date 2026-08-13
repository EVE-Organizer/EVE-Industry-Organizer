/** Rank-1 SP to finish each skill level (CCP table). Multiply by skill rank. */
export const SP_TO_FINISH_LEVEL = [0, 250, 1_415, 8_000, 45_255, 256_000] as const

export type EveAttribute =
  | 'intelligence'
  | 'memory'
  | 'perception'
  | 'willpower'
  | 'charisma'

export const ATTRIBUTE_LABEL: Record<EveAttribute, string> = {
  intelligence: 'Intelligence',
  memory: 'Memory',
  perception: 'Perception',
  willpower: 'Willpower',
  charisma: 'Charisma',
}

/** Unmapped attributes after a 27/21 neural remap. */
export const REMAP_BASE = 17
export const REMAP_PRIMARY = 27
export const REMAP_SECONDARY = 21

export interface Remap {
  primary: EveAttribute
  secondary: EveAttribute
}

export interface TrainRate {
  /** All-attribute implant bonus (0, 3, or 5). */
  implant: number
  remap: Remap
}

export function attributeValue(attr: EveAttribute, rate: TrainRate): number {
  if (attr === rate.remap.primary) return REMAP_PRIMARY + rate.implant
  if (attr === rate.remap.secondary) return REMAP_SECONDARY + rate.implant
  return REMAP_BASE + rate.implant
}

export function spPerHour(
  primary: EveAttribute,
  secondary: EveAttribute,
  rate: TrainRate,
): number {
  const pri = attributeValue(primary, rate)
  const sec = attributeValue(secondary, rate)
  return 60 * (pri + sec / 2)
}

export function spForLevel(rank: number, level: number): number {
  if (level < 1 || level > 5) return 0
  return rank * SP_TO_FINISH_LEVEL[level]
}

export function spBetween(rank: number, fromLevel: number, toLevel: number): number {
  let total = 0
  for (let level = fromLevel + 1; level <= toLevel; level += 1) {
    total += spForLevel(rank, level)
  }
  return total
}

export function hoursForSp(sp: number, sph: number): number {
  if (sp <= 0) return 0
  return sp / sph
}

export function formatDuration(hours: number): string {
  if (hours <= 0) return '0m'
  const totalMinutes = Math.round(hours * 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hrs = Math.floor((totalMinutes - days * 60 * 24) / 60)
  const mins = totalMinutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hrs) parts.push(`${hrs}h`)
  if (mins && days < 7) parts.push(`${mins}m`)
  return parts.join(' ') || '0m'
}

export function formatDaysHours(hours: number): string {
  if (hours <= 0) return '0h'
  const days = hours / 24
  if (days >= 1) return `${days.toFixed(1)} days`
  return formatDuration(hours)
}
