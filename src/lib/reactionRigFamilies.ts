import type { ReactionFamilyGroup, RefineryType } from '@/types'
import { catalogRigIconTypeId } from '@/lib/upwellCatalog'

/** M-Set per-family ME/TE rigs; Tatara uses one L-Set Reactor Efficiency rig. */
export type ReactionRigLayout = 'split' | 'optimization'

export function reactionRigLayout(refineryType: RefineryType): ReactionRigLayout | null {
  if (refineryType === 'none') return null
  if (refineryType === 'tatara') return 'optimization'
  return 'split'
}

export function reactionRigSetLabel(layout: ReactionRigLayout): string {
  return layout === 'optimization' ? 'L-Set' : 'M-Set'
}

/** In-game M-Set reactor rig type IDs (T1 ME rig icon per family). */
export const REACTION_FAMILY_RIG_ICONS: Record<ReactionFamilyGroup, number> = {
  composite: 46486,
  biochemical: 46494,
  hybrid: 46490,
}

export function reactionFamilyRigIcon(family: ReactionFamilyGroup): number {
  return catalogRigIconTypeId('reaction', family) ?? REACTION_FAMILY_RIG_ICONS[family]
}

/** Standup L-Set Reactor Efficiency I (Tatara, all reaction families). */
export const REACTOR_EFFICIENCY_RIG_ICON = 46496

export function reactorEfficiencyRigIcon(): number {
  return catalogRigIconTypeId('reaction', 'composite', 'l') ?? REACTOR_EFFICIENCY_RIG_ICON
}
