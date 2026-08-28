import type {
  BlueprintInfo,
  BlueprintTier,
  FacilityBonusDetail,
  GlobalSettings,
  ManufacturingRigModifiers,
  ManufacturingRigTier,
  ReactionFamily,
  ReactionFamilyGroup,
  ReactionFacilitySettings,
  ScienceFacilitySettings,
  StructureModifiers,
  StructureType,
} from '@/types'
import {
  DEFAULT_MANUFACTURING_RIGS,
  DEFAULT_REACTION_FAMILY_MODIFIERS,
  REFINERY_HULL_PRESETS,
  STRUCTURE_HULL_PRESETS,
  defaultReactionFamilyModifiers,
  defaultScienceFacility,
} from '@/types'
import {
  inferRigTier,
  normalizeManufacturingRigs,
  resolveRigBonuses,
  scaledLabOptimizationBonuses,
  scaledRigBonus,
} from '@/lib/manufacturingRigs'
import { reactionRigLayout } from '@/lib/reactionRigFamilies'
import { scienceRigLayout } from '@/lib/scienceRigFamilies'
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

export type ManufacturingProductHint = {
  productGroup: string
  tier?: BlueprintTier
  category?: string
}

export function manufacturingFacilityDetail(
  settings: GlobalSettings,
  product?: ManufacturingProductHint,
): FacilityBonusDetail {
  const hull = manufacturingHullBonuses(settings)
  const rigs = normalizeManufacturingRigs(settings.manufacturingRigs)
  const security = settings.buildSystemSecurity ?? 1
  const rig = resolveRigBonuses(rigs, security, product)
  return {
    hullMeBonusPercent: hull.me,
    hullTeBonusPercent: hull.te,
    hullJobCostBonusPercent: hull.jobCost,
    rigMeBonusPercent: rig.me,
    rigTeBonusPercent: rig.te,
    rigJobCostBonusPercent: rig.jobCost,
    effectiveMeBonusPercent: combineBonusPercent(hull.me, rig.me),
    effectiveTeBonusPercent: combineBonusPercent(hull.te, rig.te),
    effectiveJobCostBonusPercent: combineBonusPercent(hull.jobCost, rig.jobCost),
    taxPercent: settings.structureTaxPercent,
  }
}

export function resolveManufacturingModifiers(
  settings: GlobalSettings,
  product?: ManufacturingProductHint,
): StructureModifiers {
  const detail = manufacturingFacilityDetail(settings, product)
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

function legacyReactionRigBonuses(
  familyModifiers: ReactionFacilitySettings['familyModifiers'],
  security: number,
): { me: number; te: number } {
  let me = 0
  let te = 0
  for (const group of ['composite', 'biochemical', 'hybrid'] as ReactionFamilyGroup[]) {
    const row = familyModifiers[group]
    me = Math.max(me, scaledRigBonus(row.meRig, row.rigMeBonusPercent, 'me', security, 'reaction'))
    te = Math.max(te, scaledRigBonus(row.teRig, row.rigTeBonusPercent, 'te', security, 'reaction'))
  }
  return { me, te }
}

function inferReactorEfficiencyRig(
  familyModifiers: ReactionFacilitySettings['familyModifiers'],
  security: number,
): ManufacturingRigTier {
  for (const group of ['composite', 'biochemical', 'hybrid'] as ReactionFamilyGroup[]) {
    const row = familyModifiers[group]
    if (row.meRig === 't2' || row.teRig === 't2') return 't2'
    if (row.meRig === 't1' || row.teRig === 't1') return 't1'
    const meTier = inferRigTier(row.rigMeBonusPercent, 'me', security, 'reaction')
    const teTier = inferRigTier(row.rigTeBonusPercent, 'te', security, 'reaction')
    if (meTier === 't2' || teTier === 't2') return 't2'
    if (meTier === 't1' || teTier === 't1') return 't1'
  }
  return 'none'
}

export function reactionFacilityDetail(
  settings: GlobalSettings,
  blueprint: Pick<BlueprintInfo, 'reactionFamily'>,
): FacilityBonusDetail {
  const facility = settings.reactionFacility
  const group = reactionFamilyGroup(blueprint.reactionFamily) ?? 'composite'
  const family = facility.familyModifiers[group] ?? DEFAULT_REACTION_FAMILY_MODIFIERS
  const hullTe = refineryHullTe(facility)
  const security =
    facility.reactionSystemSecurity ??
    (facility.reactionSystemId === settings.manufacturingSystemId
      ? (settings.buildSystemSecurity ?? 1)
      : 1)
  const layout = reactionRigLayout(facility.refineryType)
  let rigMe = 0
  let rigTe = 0
  if (layout === 'optimization') {
    const storedTier = facility.reactorEfficiencyRig ?? 'none'
    const tier =
      storedTier !== 'none' ? storedTier : inferReactorEfficiencyRig(facility.familyModifiers, security)
    if (tier !== 'none' && tier !== 'custom') {
      rigMe = scaledRigBonus(tier, 0, 'me', security, 'reaction')
      rigTe = scaledRigBonus(tier, 0, 'te', security, 'reaction')
    } else {
      const legacy = legacyReactionRigBonuses(facility.familyModifiers, security)
      rigMe = legacy.me
      rigTe = legacy.te
    }
  } else if (layout === 'split') {
    rigMe = scaledRigBonus(family.meRig, family.rigMeBonusPercent, 'me', security, 'reaction')
    rigTe = scaledRigBonus(family.teRig, family.rigTeBonusPercent, 'te', security, 'reaction')
  }

  return {
    hullMeBonusPercent: 0,
    hullTeBonusPercent: hullTe,
    hullJobCostBonusPercent: 0,
    rigMeBonusPercent: rigMe,
    rigTeBonusPercent: rigTe,
    rigJobCostBonusPercent: 0,
    effectiveMeBonusPercent: rigMe,
    effectiveTeBonusPercent: combineBonusPercent(hullTe, rigTe),
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
  blueprint: Pick<BlueprintInfo, 'kind' | 'reactionFamily' | 'productGroup' | 'tier'> & {
    category?: string
  },
): StructureModifiers {
  if (blueprint.kind === 'reaction') {
    return resolveReactionModifiers(settings, blueprint)
  }
  return resolveManufacturingModifiers(settings, blueprint)
}

/** Manufacturing/reaction modifiers with SDE product category for per-family rigs. */
export function resolveRecipeModifiersForBlueprint(
  settings: GlobalSettings,
  blueprint: Pick<BlueprintInfo, 'kind' | 'reactionFamily' | 'productGroup' | 'tier'>,
  category?: string,
): StructureModifiers {
  return resolveRecipeModifiers(settings, { ...blueprint, category })
}

function scienceHullBonuses(facility: ScienceFacilitySettings): {
  te: number
  jobCost: number
} {
  if (facility.structureType === 'npc') return { te: 0, jobCost: 0 }
  if (
    facility.structureType === 'raitaru' ||
    facility.structureType === 'azbel' ||
    facility.structureType === 'sotiyo'
  ) {
    const hull = STRUCTURE_HULL_PRESETS[facility.structureType]
    return { te: hull.hullTeBonusPercent, jobCost: hull.hullJobCostBonusPercent }
  }
  return {
    te: facility.hullTeBonusPercent,
    jobCost: facility.hullJobCostBonusPercent,
  }
}

export function scienceFacilityDetail(facility: ScienceFacilitySettings): FacilityBonusDetail {
  const hull = scienceHullBonuses(facility)
  const security = facility.systemSecurity ?? 1
  const layout = scienceRigLayout(facility.structureType)
  let rigTe = 0
  let rigJobCost = 0
  if (layout === 'split') {
    rigTe = scaledRigBonus(facility.teRig, facility.rigTeBonusPercent, 'te', security)
    rigJobCost = scaledRigBonus(
      facility.costRig,
      facility.rigJobCostBonusPercent,
      'cost',
      security,
    )
  } else if (layout === 'optimization' || layout === 'xl-laboratory') {
    const opt = scaledLabOptimizationBonuses(facility.optimizationRig, security)
    rigTe = opt.time
    rigJobCost = opt.cost
  }
  return {
    hullMeBonusPercent: 0,
    hullTeBonusPercent: hull.te,
    hullJobCostBonusPercent: hull.jobCost,
    rigMeBonusPercent: 0,
    rigTeBonusPercent: rigTe,
    rigJobCostBonusPercent: rigJobCost,
    effectiveMeBonusPercent: 0,
    effectiveTeBonusPercent: combineBonusPercent(hull.te, rigTe),
    effectiveJobCostBonusPercent: combineBonusPercent(hull.jobCost, rigJobCost),
    taxPercent: facility.taxPercent,
  }
}

export function resolveScienceModifiers(facility: ScienceFacilitySettings): StructureModifiers {
  if (facility.structureType === 'npc') {
    return {
      meBonusPercent: 0,
      teBonusPercent: 0,
      jobCostBonusPercent: 0,
      taxPercent: 0,
    }
  }
  const detail = scienceFacilityDetail(facility)
  return {
    meBonusPercent: 0,
    teBonusPercent: detail.effectiveTeBonusPercent,
    jobCostBonusPercent: detail.effectiveJobCostBonusPercent,
    taxPercent: detail.taxPercent,
  }
}

export function normalizeScienceFacility(
  parsed: Partial<ScienceFacilitySettings> | undefined,
  manufacturingSystemId: number,
): ScienceFacilitySettings {
  const defaults = defaultScienceFacility(manufacturingSystemId)
  if (!parsed) return defaults
  const structureType = parsed.structureType ?? 'npc'
  let hullTeBonusPercent = parsed.hullTeBonusPercent ?? 0
  let hullJobCostBonusPercent = parsed.hullJobCostBonusPercent ?? 0
  if (
    structureType === 'raitaru' ||
    structureType === 'azbel' ||
    structureType === 'sotiyo'
  ) {
    const hull = STRUCTURE_HULL_PRESETS[structureType]
    hullTeBonusPercent = hull.hullTeBonusPercent
    hullJobCostBonusPercent = hull.hullJobCostBonusPercent
  }
  if (structureType === 'npc') {
    hullTeBonusPercent = 0
    hullJobCostBonusPercent = 0
  }
  return {
    systemId: typeof parsed.systemId === 'number' ? parsed.systemId : manufacturingSystemId,
    structureType,
    hullTeBonusPercent,
    hullJobCostBonusPercent,
    systemSecurity: typeof parsed.systemSecurity === 'number' ? parsed.systemSecurity : 1,
    costRig:
      parsed.costRig ??
      inferRigTier(parsed.rigJobCostBonusPercent ?? 0, 'cost', parsed.systemSecurity ?? 1),
    teRig: parsed.teRig ?? inferRigTier(parsed.rigTeBonusPercent ?? 0, 'te'),
    optimizationRig: parsed.optimizationRig ?? 'none',
    rigTeBonusPercent: parsed.rigTeBonusPercent ?? 0,
    rigJobCostBonusPercent: parsed.rigJobCostBonusPercent ?? 0,
    taxPercent: structureType === 'npc' ? 0 : (parsed.taxPercent ?? 0),
  }
}

export function normalizeReactionFacility(
  parsed: Partial<ReactionFacilitySettings> | undefined,
  manufacturingSystemId: number,
): ReactionFacilitySettings {
  const defaults = {
    reactionSystemId: manufacturingSystemId,
    reactionSystemSecurity: 1,
    refineryType: 'none' as const,
    hullTeBonusPercent: 0,
    reactorEfficiencyRig: 'none' as const,
    familyModifiers: defaultReactionFamilyModifiers(),
  }
  if (!parsed) return defaults

  const familyModifiers = defaultReactionFamilyModifiers()
  if (parsed.familyModifiers) {
    for (const group of ['composite', 'biochemical', 'hybrid'] as ReactionFamilyGroup[]) {
      const row = parsed.familyModifiers[group]
      if (row) {
        familyModifiers[group] = {
          meRig: row.meRig ?? inferRigTier(row.rigMeBonusPercent ?? 0, 'me', 1, 'reaction'),
          teRig: row.teRig ?? inferRigTier(row.rigTeBonusPercent ?? 0, 'te', 1, 'reaction'),
          rigMeBonusPercent: row.rigMeBonusPercent ?? 0,
          rigTeBonusPercent: row.rigTeBonusPercent ?? 0,
          taxPercent: row.taxPercent ?? 0,
        }
      }
    }
  }

  const refineryType = parsed.refineryType ?? 'none'
  const reactionSystemSecurity =
    typeof parsed.reactionSystemSecurity === 'number' ? parsed.reactionSystemSecurity : 1
  const storedReactorRig = parsed.reactorEfficiencyRig ?? 'none'

  return {
    reactionSystemId:
      typeof parsed.reactionSystemId === 'number'
        ? parsed.reactionSystemId
        : manufacturingSystemId,
    reactionSystemSecurity,
    refineryType,
    hullTeBonusPercent: parsed.hullTeBonusPercent ?? 0,
    reactorEfficiencyRig:
      refineryType === 'tatara' && storedReactorRig === 'none'
        ? inferReactorEfficiencyRig(familyModifiers, reactionSystemSecurity)
        : storedReactorRig,
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
  existingRigs: Partial<ManufacturingRigModifiers> | undefined,
): {
  hullMe: number
  hullTe: number
  hullJobCost: number
  rigs: ManufacturingRigModifiers
} {
  const kept = {
    fitted: existingRigs?.fitted,
    familyRigs: existingRigs?.familyRigs,
  }
  if (structureType === 'custom') {
    return {
      hullMe: 0,
      hullTe: 0,
      hullJobCost: 0,
      rigs: {
        ...DEFAULT_MANUFACTURING_RIGS,
        ...kept,
        rigMeBonusPercent:
          existingRigs?.rigMeBonusPercent ?? structureMeBonusPercent,
        rigTeBonusPercent:
          existingRigs?.rigTeBonusPercent ?? structureTeBonusPercent,
        rigJobCostBonusPercent:
          existingRigs?.rigJobCostBonusPercent ?? structureJobCostBonusPercent,
        meRig: existingRigs?.meRig ?? (structureMeBonusPercent > 0 ? 'custom' : 'none'),
        teRig: existingRigs?.teRig ?? (structureTeBonusPercent > 0 ? 'custom' : 'none'),
      },
    }
  }

  return {
    hullMe: structureType === 'npc' ? 0 : structureMeBonusPercent,
    hullTe: structureType === 'npc' ? 0 : structureTeBonusPercent,
    hullJobCost: structureType === 'npc' ? 0 : structureJobCostBonusPercent,
    rigs: {
      ...DEFAULT_MANUFACTURING_RIGS,
      ...kept,
      rigMeBonusPercent: existingRigs?.rigMeBonusPercent ?? 0,
      rigTeBonusPercent: existingRigs?.rigTeBonusPercent ?? 0,
      rigJobCostBonusPercent: existingRigs?.rigJobCostBonusPercent ?? 0,
      meRig: existingRigs?.meRig ?? (existingRigs?.rigMeBonusPercent ? 'custom' : 'none'),
      teRig: existingRigs?.teRig ?? (existingRigs?.rigTeBonusPercent ? 'custom' : 'none'),
    },
  }
}
