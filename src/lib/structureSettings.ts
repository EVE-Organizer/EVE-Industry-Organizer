import type {
  GlobalSettings,
  ManufacturingSettings,
  ScienceFacilitySettings,
  StructureType,
} from '@/types'
import { DEFAULT_BATCH_SIZE, MAX_RANKING_TIME_HOURS, MIN_RANKING_TIME_HOURS, STRUCTURE_HULL_PRESETS, defaultScienceFacility } from '@/types'

export type ScienceFacilityKey = 'copyFacility' | 'inventionFacility'

/** EVE type icons for manufacturing location options. */
export const STRUCTURE_TYPE_IDS: Record<StructureType, number> = {
  npc: 1529,
  raitaru: 35825,
  azbel: 35826,
  sotiyo: 35827,
  custom: 35832,
}

export const STRUCTURE_TYPES: StructureType[] = ['npc', 'raitaru', 'azbel', 'sotiyo', 'custom']

/** Apply preset hull bonuses when the user picks a structure type. Rigs are unchanged. */
export function patchStructureType(structureType: StructureType): Partial<GlobalSettings> {
  if (structureType === 'npc') {
    return {
      structureType,
      structureMeBonusPercent: 0,
      structureTeBonusPercent: 0,
      structureJobCostBonusPercent: 0,
      structureTaxPercent: 0,
    }
  }
  if (structureType === 'custom') {
    return { structureType }
  }
  const hull = STRUCTURE_HULL_PRESETS[structureType]
  return {
    structureType,
    structureMeBonusPercent: hull.hullMeBonusPercent,
    structureTeBonusPercent: hull.hullTeBonusPercent,
    structureJobCostBonusPercent: hull.hullJobCostBonusPercent,
  }
}

export function structureTypeLabel(type: StructureType): string {
  switch (type) {
    case 'npc':
      return 'NPC station'
    case 'raitaru':
      return 'Raitaru (medium)'
    case 'azbel':
      return 'Azbel (large)'
    case 'sotiyo':
      return 'Sotiyo (xlarge)'
    case 'custom':
      return 'Custom structure'
  }
}

export function isPlayerStructure(type: StructureType): boolean {
  return type !== 'npc'
}

export function isPresetPlayerStructure(type: StructureType): boolean {
  return type === 'raitaru' || type === 'azbel' || type === 'sotiyo'
}

/** Apply preset hull TE / job-cost when the user picks a copy or invention structure. */
export function patchScienceStructureType(
  key: ScienceFacilityKey,
  structureType: StructureType,
  current: ScienceFacilitySettings,
): Partial<GlobalSettings> {
  if (structureType === 'npc') {
    return {
      [key]: {
        ...current,
        structureType,
        hullTeBonusPercent: 0,
        hullJobCostBonusPercent: 0,
        taxPercent: 0,
      },
    }
  }
  if (structureType === 'custom') {
    return { [key]: { ...current, structureType } }
  }
  const hull = STRUCTURE_HULL_PRESETS[structureType]
  return {
    [key]: {
      ...current,
      structureType,
      hullTeBonusPercent: hull.hullTeBonusPercent,
      hullJobCostBonusPercent: hull.hullJobCostBonusPercent,
    },
  }
}

export function scienceFacilityForSystem(
  current: ScienceFacilitySettings,
  systemId: number,
  security: number,
): ScienceFacilitySettings {
  return { ...current, systemId, systemSecurity: security }
}

/** Sync copy/invention facility from a saved character location. Returns null when already aligned or system unknown. */
export function patchScienceFacilityFromLocation(
  key: ScienceFacilityKey,
  facility: ScienceFacilitySettings | undefined,
  structureType: StructureType,
  solarSystemId: number,
  systems: { systemId: number; security: number }[] | undefined,
  manufacturingSystemId: number,
): Partial<GlobalSettings> | null {
  if (solarSystemId <= 0) return null

  const base = facility ?? defaultScienceFacility(manufacturingSystemId)
  const systemSecurity = securityForSystem(systems, solarSystemId, base.systemSecurity ?? 1)
  if (
    base.structureType === structureType &&
    base.systemId === solarSystemId &&
    Math.abs((base.systemSecurity ?? 1) - systemSecurity) < 1e-9
  ) {
    return null
  }

  const synced = scienceFacilityForSystem(base, solarSystemId, systemSecurity)
  return patchScienceStructureType(key, structureType, synced)
}

export function scienceCostIndex(
  systems:
    | {
        systemId: number
        costIndex?: number
        copyingCostIndex?: number
        inventionCostIndex?: number
      }[]
    | undefined,
  systemId: number,
  kind: 'copying' | 'invention',
  fallback = 0,
): number {
  const sys = systems?.find((s) => s.systemId === systemId)
  const specific = kind === 'copying' ? sys?.copyingCostIndex : sys?.inventionCostIndex
  return specific ?? sys?.costIndex ?? fallback
}

export function securityForSystem(
  systems: { systemId: number; security: number }[] | undefined,
  systemId: number,
  fallback = 1,
): number {
  return systems?.find((s) => s.systemId === systemId)?.security ?? fallback
}

/** Apply manufacturing build system; caches security for rig scaling. */
export function patchManufacturingSystem(
  manufacturingSystemId: number,
  buildSystemSecurity: number,
): Partial<GlobalSettings> {
  return { manufacturingSystemId, buildSystemSecurity }
}

export function patchManufacturingSystemFromList(
  systems: { systemId: number; security: number }[] | undefined,
  manufacturingSystemId: number,
  fallbackSecurity = 1,
): Partial<GlobalSettings> {
  return patchManufacturingSystem(
    manufacturingSystemId,
    securityForSystem(systems, manufacturingSystemId, fallbackSecurity),
  )
}

/** Update cached build-system security when SDE loads or id already matches. */
export function patchManufacturingSystemIfStale(
  systems: { systemId: number; security: number }[] | undefined,
  systemId: number,
  current: Pick<GlobalSettings, 'manufacturingSystemId' | 'buildSystemSecurity'>,
): Partial<GlobalSettings> | null {
  if (systemId <= 0) return null
  const expectedSecurity = securityForSystem(systems, systemId, Number.NaN)
  if (!Number.isFinite(expectedSecurity)) return null
  const currentSecurity = current.buildSystemSecurity ?? 1
  const idMatches = current.manufacturingSystemId === systemId
  const securityMatches = Math.abs(currentSecurity - expectedSecurity) < 1e-9
  if (idMatches && securityMatches) return null
  return patchManufacturingSystemFromList(systems, systemId, expectedSecurity)
}

/** Global settings scoped to a build system with correct rig security scaling. */
export function settingsForManufacturingSystem(
  settings: GlobalSettings,
  manufacturingSystemId: number,
  systems: { systemId: number; security: number }[] | undefined,
): GlobalSettings {
  return {
    ...settings,
    manufacturingSystemId,
    buildSystemSecurity: securityForSystem(
      systems,
      manufacturingSystemId,
      settings.buildSystemSecurity ?? 1,
    ),
  }
}

/** Build system for ranking when a saved production location owns the system picker. */
export function effectiveManufacturingSystemId(
  settings: Pick<GlobalSettings, 'manufacturingSystemId' | 'productionLocationId'>,
  queryMfgSystem: number,
): number {
  return settings.productionLocationId != null
    ? settings.manufacturingSystemId
    : queryMfgSystem
}

/** Blueprint ranking/graph settings: location system wins over URL query override. */
export function buildBlueprintRankingSettings(
  settings: GlobalSettings,
  systems: { systemId: number; security: number }[] | undefined,
  query: {
    mfgSystem: number
    rankingTimeHours: number
    priceMethod: GlobalSettings['priceMethod']
  },
): ManufacturingSettings {
  const rankingTimeHours = Math.min(
    MAX_RANKING_TIME_HOURS,
    Math.max(MIN_RANKING_TIME_HOURS, query.rankingTimeHours),
  )
  return buildManufacturingSettings(settings, systems, {
    manufacturingSystemId: effectiveManufacturingSystemId(settings, query.mfgSystem),
    rankingTargetTimeSeconds: rankingTimeHours * 3600,
    priceMethod: query.priceMethod,
  })
}

/** ManufacturingSettings for cost/ranking with batch size and build-system security. */
export function buildManufacturingSettings(
  settings: GlobalSettings,
  systems: { systemId: number; security: number }[] | undefined,
  overrides: {
    manufacturingSystemId?: number
    batchSize?: number
    rankingTargetTimeSeconds?: number
    priceMethod?: GlobalSettings['priceMethod']
  } = {},
): ManufacturingSettings {
  const manufacturingSystemId =
    overrides.manufacturingSystemId ?? settings.manufacturingSystemId
  return {
    ...settingsForManufacturingSystem(settings, manufacturingSystemId, systems),
    ...overrides,
    batchSize: overrides.batchSize ?? DEFAULT_BATCH_SIZE,
  }
}

export function jobCostSectionTitle(type: StructureType): string {
  return isPlayerStructure(type) ? 'Job cost (player structure)' : 'Job cost (NPC station)'
}

/** Base job cost before structure role bonus and owner tax (EIV × system cost index). */
export function baseJobCostFromIndex(estimatedItemValue: number, systemCostIndex: number): number {
  return estimatedItemValue * systemCostIndex
}
