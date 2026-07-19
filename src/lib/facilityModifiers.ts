import type {
  BlueprintInfo,
  FacilityBonusDetail,
  GlobalSettings,
  ReactionFamily,
  ReactionFamilyGroup,
  ReactionFacilitySettings,
  StructureModifiers,
  StructureType,
} from '@/types'
import {
  DEFAULT_MANUFACTURING_RIGS,
  DEFAULT_REACTION_FAMILY_MODIFIERS,
  REFINERY_HULL_PRESETS,
  STRUCTURE_HULL_PRESETS,
  defaultReactionFamilyModifiers,
} from '@/types'
/** Multiplicative bonus combine: hull 25% + rig 20% -> 40% effective reduction. */
export function combineBonusPercent(hullPercent: number, rigPercent: number): number {
  if (hullPercent <= 0 && rigPercent <= 0) return 0
  const combined = 1 - (1 - hullPercent / 100) * (1 - rigPercent / 100)
  return combined * 100
}

/** Solve rig bonus % when legacy saves stored combined hull+rig in one field. */
export function rigPercentFromCombined(hullPercent: number, combinedPercent: number): number {
  if (combinedPercent <= hullPercent || hullPercent >= 100) return 0
  const hullFactor = 1 - hullPercent / 100
  if (hullFactor <= 0) return 0
  const combinedFactor = 1 - combinedPercent / 100
  return Math.max(0, (1 - combinedFactor / hullFactor) * 100)
}

export function reactionFamilyGroup(
  family: ReactionFamily | undefined,
): ReactionFamilyGroup | undefined {
  if (!family) return undefined
  if (family === 'composite') return 'composite'
  if (family === 'biochemical') return 'biochemical'
  if (family === 'polymer' || family === 'molecular') return 'hybrid'
  return undefined
}

function manufacturingHullBonuses(settings: GlobalSettings): {
  me: number
  te: number
  jobCost: number
} {
  if (settings.structureType === 'npc') {
    return { me: 0, te: 0, jobCost: 0 }
  }
  if (
    settings.structureType === 'raitaru' ||
    settings.structureType === 'azbel' ||
    settings.structureType === 'sotiyo'
  ) {
    const hull = STRUCTURE_HULL_PRESETS[settings.structureType]
    return {
      me: hull.hullMeBonusPercent,
      te: hull.hullTeBonusPercent,
      jobCost: hull.hullJobCostBonusPercent,
    }
  }
  return {
    me: settings.structureMeBonusPercent,
    te: settings.structureTeBonusPercent,
    jobCost: settings.structureJobCostBonusPercent,
  }
}

export function manufacturingFacilityDetail(settings: GlobalSettings): FacilityBonusDetail {
  const hull = manufacturingHullBonuses(settings)
  const rig = settings.manufacturingRigs ?? DEFAULT_MANUFACTURING_RIGS
  return {
    hullMeBonusPercent: hull.me,
    hullTeBonusPercent: hull.te,
    hullJobCostBonusPercent: hull.jobCost,
    rigMeBonusPercent: rig.rigMeBonusPercent,
    rigTeBonusPercent: rig.rigTeBonusPercent,
    rigJobCostBonusPercent: rig.rigJobCostBonusPercent,
    effectiveMeBonusPercent: combineBonusPercent(hull.me, rig.rigMeBonusPercent),
    effectiveTeBonusPercent: combineBonusPercent(hull.te, rig.rigTeBonusPercent),
    effectiveJobCostBonusPercent: combineBonusPercent(hull.jobCost, rig.rigJobCostBonusPercent),
    taxPercent: settings.structureTaxPercent,
  }
}

export function resolveManufacturingModifiers(settings: GlobalSettings): StructureModifiers {
  const detail = manufacturingFacilityDetail(settings)
  if (settings.structureType === 'npc') {
    return {
      meBonusPercent: 0,
      teBonusPercent: 0,
      jobCostBonusPercent: 0,
      taxPercent: 0,
    }
  }
  return {
    meBonusPercent: detail.effectiveMeBonusPercent,
    teBonusPercent: detail.effectiveTeBonusPercent,
    jobCostBonusPercent: detail.effectiveJobCostBonusPercent,
    taxPercent: detail.taxPercent,
  }
}

function refineryHullTe(facility: ReactionFacilitySettings): number {
  if (facility.refineryType === 'none') return 0
  if (facility.refineryType === 'athanor') return REFINERY_HULL_PRESETS.athanor.hullTeBonusPercent
  if (facility.refineryType === 'tatara') return REFINERY_HULL_PRESETS.tatara.hullTeBonusPercent
  return facility.hullTeBonusPercent
}

export function reactionFacilityDetail(
  settings: GlobalSettings,
  blueprint: Pick<BlueprintInfo, 'reactionFamily'>,
): FacilityBonusDetail {
  const facility = settings.reactionFacility
  const group = reactionFamilyGroup(blueprint.reactionFamily) ?? 'composite'
  const family = facility.familyModifiers[group] ?? DEFAULT_REACTION_FAMILY_MODIFIERS
  const hullTe = refineryHullTe(facility)

  return {
    hullMeBonusPercent: 0,
    hullTeBonusPercent: hullTe,
    hullJobCostBonusPercent: 0,
    rigMeBonusPercent: family.rigMeBonusPercent,
    rigTeBonusPercent: family.rigTeBonusPercent,
    rigJobCostBonusPercent: 0,
    effectiveMeBonusPercent: family.rigMeBonusPercent,
    effectiveTeBonusPercent: combineBonusPercent(hullTe, family.rigTeBonusPercent),
    effectiveJobCostBonusPercent: 0,
    taxPercent: family.taxPercent,
  }
}

export function resolveReactionModifiers(
  settings: GlobalSettings,
  blueprint: Pick<BlueprintInfo, 'reactionFamily'>,
): StructureModifiers {
  const facility = settings.reactionFacility
  if (facility.refineryType === 'none') {
    return {
      meBonusPercent: 0,
      teBonusPercent: 0,
      jobCostBonusPercent: 0,
      taxPercent: 0,
    }
  }
  const detail = reactionFacilityDetail(settings, blueprint)
  return {
    meBonusPercent: detail.effectiveMeBonusPercent,
    teBonusPercent: detail.effectiveTeBonusPercent,
    jobCostBonusPercent: 0,
    taxPercent: detail.taxPercent,
  }
}

export function resolveRecipeModifiers(
  settings: GlobalSettings,
  blueprint: Pick<BlueprintInfo, 'kind' | 'reactionFamily'>,
): StructureModifiers {
  if (blueprint.kind === 'reaction') {
    return resolveReactionModifiers(settings, blueprint)
  }
  return resolveManufacturingModifiers(settings)
}

export function normalizeReactionFacility(
  parsed: Partial<ReactionFacilitySettings> | undefined,
  manufacturingSystemId: number,
): ReactionFacilitySettings {
  const defaults = {
    reactionSystemId: manufacturingSystemId,
    refineryType: 'none' as const,
    hullTeBonusPercent: 0,
    familyModifiers: defaultReactionFamilyModifiers(),
  }
  if (!parsed) return defaults

  const familyModifiers = defaultReactionFamilyModifiers()
  if (parsed.familyModifiers) {
    for (const group of ['composite', 'biochemical', 'hybrid'] as ReactionFamilyGroup[]) {
      const row = parsed.familyModifiers[group]
      if (row) {
        familyModifiers[group] = {
          rigMeBonusPercent: row.rigMeBonusPercent ?? 0,
          rigTeBonusPercent: row.rigTeBonusPercent ?? 0,
          taxPercent: row.taxPercent ?? 0,
        }
      }
    }
  }

  return {
    reactionSystemId:
      typeof parsed.reactionSystemId === 'number'
        ? parsed.reactionSystemId
        : manufacturingSystemId,
    refineryType: parsed.refineryType ?? 'none',
    hullTeBonusPercent: parsed.hullTeBonusPercent ?? 0,
    familyModifiers,
  }
}

export function formatFacilityBonusLine(
  detail: FacilityBonusDetail,
  kind: 'me' | 'te' | 'jobCost',
): string {
  const hull =
    kind === 'me'
      ? detail.hullMeBonusPercent
      : kind === 'te'
        ? detail.hullTeBonusPercent
        : detail.hullJobCostBonusPercent
  const rig =
    kind === 'me'
      ? detail.rigMeBonusPercent
      : kind === 'te'
        ? detail.rigTeBonusPercent
        : detail.rigJobCostBonusPercent
  const effective =
    kind === 'me'
      ? detail.effectiveMeBonusPercent
      : kind === 'te'
        ? detail.effectiveTeBonusPercent
        : detail.effectiveJobCostBonusPercent
  if (hull <= 0 && rig <= 0) return `${effective.toFixed(1)}%`
  if (rig <= 0) return `hull ${hull.toFixed(1)}%`
  if (hull <= 0) return `rig ${rig.toFixed(1)}%`
  return `hull ${hull.toFixed(1)}% + rig ${rig.toFixed(1)}% = ${effective.toFixed(2)}%`
}

export function migrateManufacturingRigs(
  structureType: StructureType,
  structureMeBonusPercent: number,
  structureTeBonusPercent: number,
  structureJobCostBonusPercent: number,
  existingRigs: Partial<typeof DEFAULT_MANUFACTURING_RIGS> | undefined,
): {
  hullMe: number
  hullTe: number
  hullJobCost: number
  rigs: typeof DEFAULT_MANUFACTURING_RIGS
} {
  if (structureType === 'custom') {
    return {
      hullMe: 0,
      hullTe: 0,
      hullJobCost: 0,
      rigs: {
        rigMeBonusPercent:
          existingRigs?.rigMeBonusPercent ?? structureMeBonusPercent,
        rigTeBonusPercent:
          existingRigs?.rigTeBonusPercent ?? structureTeBonusPercent,
        rigJobCostBonusPercent:
          existingRigs?.rigJobCostBonusPercent ?? structureJobCostBonusPercent,
      },
    }
  }

  return {
    hullMe: structureType === 'npc' ? 0 : structureMeBonusPercent,
    hullTe: structureType === 'npc' ? 0 : structureTeBonusPercent,
    hullJobCost: structureType === 'npc' ? 0 : structureJobCostBonusPercent,
    rigs: {
      rigMeBonusPercent: existingRigs?.rigMeBonusPercent ?? 0,
      rigTeBonusPercent: existingRigs?.rigTeBonusPercent ?? 0,
      rigJobCostBonusPercent: existingRigs?.rigJobCostBonusPercent ?? 0,
    },
  }
}
