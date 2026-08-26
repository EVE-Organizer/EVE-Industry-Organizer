import type { GlobalSettings, ManufacturingSettings, StructureType } from '@/types'
import { DEFAULT_BATCH_SIZE, STRUCTURE_HULL_PRESETS } from '@/types'

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

/** ManufacturingSettings for cost/ranking with batch size and build-system security. */
export function buildManufacturingSettings(
  settings: GlobalSettings,
  systems: { systemId: number; security: number }[] | undefined,
  overrides: {
    manufacturingSystemId?: number
    batchSize?: number
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
