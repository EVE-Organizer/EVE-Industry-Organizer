import type { HubId, UserData, GlobalSettings, SkillLevels, ManufacturingPlanTemplate, PlanRootEntry, StructureType, MiningBoosterHullId, MiningBurstTech, MiningCrystalId, MiningForemanBurstId, MiningReprocessFacility, MiningSurveyChipsetId, MiningUpgradeId, ProductionLocationKind } from '@/types'
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, ZERO_SKILLS, HUBS, STRUCTURE_HULL_PRESETS, type MiningBuffId, type MiningBoostSpace, type MiningShipId } from '@/types'
import {
  DEFAULT_MINING_SHIP_ID,
  migrateBoosterFromLegacyBuffIds,
  normalizeMiningBoostSpace,
  normalizeMiningBuffIds,
  normalizeMiningBoosterHull,
  normalizeMiningBurstTech,
  normalizeMiningCrystal,
  normalizeMiningFleet,
  normalizeMiningFleetSize,
  normalizeMiningForemanBurst,
  normalizeMiningForemanBursts,
  normalizeMiningShipId,
  normalizeMiningUpgrade,
  normalizeMiningUpgradeCount,
  normalizeMiningSurveyChipset,
} from '@/lib/miningShipPresets'
import { normalizeMiningReprocessFacility } from '@/lib/miningReprocess'
import { SKILL_FIELDS } from '@/lib/skillFields'
import {
  migrateManufacturingRigs,
  normalizeReactionFacility,
  normalizeScienceFacility,
  rigPercentFromCombined,
} from '@/lib/facilityModifiers'
import { normalizeManufacturingRigs } from '@/lib/manufacturingRigs'
import { isPresetPlayerStructure } from '@/lib/structureSettings'

type LegacySettings = Partial<Omit<GlobalSettings, 'skills'>> & {
  skills?: Partial<SkillLevels>
  buildSystemId?: number
  manufacturingRegionId?: number
  brokerFeePercent?: number
  salesTaxPercent?: number
  batchSize?: number
}

type LegacyUserData = Partial<UserData> & {
  onboardingComplete?: boolean
  accounts?: { skills?: Partial<SkillLevels> }[]
}

function migrateHubId(hub: HubId | 'xhq7v' | undefined): HubId | undefined {
  if (hub === 'xhq7v') return 'ympwl'
  return hub
}

/** Fill missing keys. Legacy all-zero saves (pre-SSO) map to default 3. */
export function normalizeSkillLevels(
  skills: Partial<SkillLevels> | undefined,
  options?: { legacyZeroMeansDefault?: boolean },
): SkillLevels {
  const keys = SKILL_FIELDS.map((f) => f.key)
  if (
    options?.legacyZeroMeansDefault &&
    skills &&
    keys.every((k) => (skills[k] ?? 0) === 0)
  ) {
    return { ...DEFAULT_SKILLS }
  }
  const merged = { ...ZERO_SKILLS, ...(skills ?? {}) } as SkillLevels
  // New mining keys: absent on old saves → default IV, not untrained.
  for (const key of [
    'mining',
    'astrogeology',
    'iceHarvesting',
    'gasCloudHarvesting',
    'miningBarge',
    'exhumers',
    'industrialCommandShips',
    'capitalIndustrialShips',
    'miningFrigate',
    'expeditionFrigates',
    'miningDirector',
  ] as const) {
    if (skills?.[key] == null) merged[key] = DEFAULT_SKILLS[key]
  }
  return merged
}

/** Migrate region-level buildSystemId to hub default manufacturingSystemId. */
export function normalizeGlobalSettings(parsed: LegacySettings): GlobalSettings {
  const primaryHub = migrateHubId(parsed.primaryHub) ?? DEFAULT_SETTINGS.primaryHub
  const sellHubId = migrateHubId(parsed.sellHubId) ?? DEFAULT_SETTINGS.sellHubId
  const hub = HUBS.find((h) => h.id === primaryHub)
  const hasLegacyRegionSettings =
    parsed.buildSystemId !== undefined || parsed.manufacturingRegionId !== undefined

  let manufacturingSystemId = parsed.manufacturingSystemId
  if (typeof manufacturingSystemId !== 'number') {
    manufacturingSystemId = hub?.buildSystemId ?? DEFAULT_SETTINGS.manufacturingSystemId
  } else if (hasLegacyRegionSettings && parsed.buildSystemId === manufacturingSystemId) {
    // Old saves used region cheapest build (e.g. Otomainen); prefer hub build (e.g. Perimeter).
    manufacturingSystemId = hub?.buildSystemId ?? manufacturingSystemId
  }

  const {
    buildSystemId: _build,
    manufacturingRegionId: _region,
    brokerFeePercent: _bf,
    salesTaxPercent: _st,
    batchSize: _batchSize,
    skills: parsedSkills,
    manufacturingRigs: parsedRigs,
    reactionFacility: parsedReactionFacility,
    copyFacility: parsedCopyFacility,
    inventionFacility: parsedInventionFacility,
    ...rest
  } = parsed

  const structureType = (rest.structureType ?? DEFAULT_SETTINGS.structureType) as StructureType
  const migratedRigs = migrateManufacturingRigs(
    structureType,
    rest.structureMeBonusPercent ?? 0,
    rest.structureTeBonusPercent ?? 0,
    rest.structureJobCostBonusPercent ?? 0,
    parsedRigs,
  )

  let structureMeBonusPercent = migratedRigs.hullMe
  let structureTeBonusPercent = migratedRigs.hullTe
  let structureJobCostBonusPercent = migratedRigs.hullJobCost
  let manufacturingRigs = migratedRigs.rigs

  if (isPresetPlayerStructure(structureType)) {
    const hullPreset = STRUCTURE_HULL_PRESETS[structureType as keyof typeof STRUCTURE_HULL_PRESETS]
    structureMeBonusPercent = hullPreset.hullMeBonusPercent
    structureTeBonusPercent = hullPreset.hullTeBonusPercent
    structureJobCostBonusPercent = hullPreset.hullJobCostBonusPercent

    const legacyMe = rest.structureMeBonusPercent ?? 0
    const legacyTe = rest.structureTeBonusPercent ?? 0
    const legacyJobCost = rest.structureJobCostBonusPercent ?? 0
    manufacturingRigs = { ...migratedRigs.rigs }
    const rigMe = rigPercentFromCombined(hullPreset.hullMeBonusPercent, legacyMe)
    const rigTe = rigPercentFromCombined(hullPreset.hullTeBonusPercent, legacyTe)
    const rigJobCost = rigPercentFromCombined(
      hullPreset.hullJobCostBonusPercent,
      legacyJobCost,
    )
    if (rigMe > manufacturingRigs.rigMeBonusPercent) {
      manufacturingRigs.rigMeBonusPercent = rigMe
    }
    if (rigTe > manufacturingRigs.rigTeBonusPercent) {
      manufacturingRigs.rigTeBonusPercent = rigTe
    }
    if (rigJobCost > manufacturingRigs.rigJobCostBonusPercent) {
      manufacturingRigs.rigJobCostBonusPercent = rigJobCost
    }
    if (rigMe > 0) manufacturingRigs.meRig = 'custom'
    if (rigTe > 0) manufacturingRigs.teRig = 'custom'
  }

  manufacturingRigs = normalizeManufacturingRigs(manufacturingRigs)

  const reactionFacility = normalizeReactionFacility(parsedReactionFacility, manufacturingSystemId)
  const copyFacility = normalizeScienceFacility(parsedCopyFacility, manufacturingSystemId)
  const inventionFacility = normalizeScienceFacility(
    parsedInventionFacility,
    manufacturingSystemId,
  )

  const hadPlayerStructure =
    structureType !== 'npc' &&
    (rest.structureMeBonusPercent ?? 0) +
      (rest.structureTeBonusPercent ?? 0) +
      (rest.structureTaxPercent ?? 0) >
      0

  if (hadPlayerStructure && reactionFacility.refineryType === 'none' && !parsedReactionFacility) {
    reactionFacility.refineryType = 'custom'
    reactionFacility.hullTeBonusPercent = rest.structureTeBonusPercent ?? 0
    const tax = rest.structureTaxPercent ?? 0
    if (tax > 0) {
      for (const group of ['composite', 'biochemical', 'hybrid'] as const) {
        reactionFacility.familyModifiers[group] = {
          ...reactionFacility.familyModifiers[group],
          taxPercent: tax,
        }
      }
    }
  }

  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    primaryHub,
    sellHubId,
    manufacturingSystemId,
    buildSystemSecurity:
      typeof rest.buildSystemSecurity === 'number'
        ? rest.buildSystemSecurity
        : DEFAULT_SETTINGS.buildSystemSecurity,
    structureType,
    structureMeBonusPercent,
    structureTeBonusPercent,
    structureJobCostBonusPercent,
    manufacturingRigs,
    reactionFacility,
    copyFacility,
    inventionFacility,
    priceMethod: rest.priceMethod ?? DEFAULT_SETTINGS.priceMethod,
    priceWindow: rest.priceWindow ?? DEFAULT_SETTINGS.priceWindow,
    includeHaulCost: rest.includeHaulCost ?? DEFAULT_SETTINGS.includeHaulCost,
    skills: normalizeSkillLevels(parsedSkills),
    productionCharacterId: rest.productionCharacterId ?? null,
    productionLocationId: rest.productionLocationId ?? null,
    productionLocationKind: rest.productionLocationKind ?? null,
    reactionLocationId: rest.reactionLocationId ?? null,
    reactionLocationKind: rest.reactionLocationKind ?? null,
    copyLocationId: rest.copyLocationId ?? null,
    copyLocationKind: rest.copyLocationKind ?? null,
    inventionLocationId: rest.inventionLocationId ?? null,
    inventionLocationKind: rest.inventionLocationKind ?? null,
    miningShipId: normalizeMiningShipId(
      (rest.miningShipId as MiningShipId | undefined) ?? DEFAULT_MINING_SHIP_ID,
      'ore',
    ),
    miningBoostSpace: normalizeMiningBoostSpace(rest.miningBoostSpace as MiningBoostSpace | undefined),
    miningFleetSize: normalizeMiningFleetSize(rest.miningFleetSize as number | undefined),
    miningFleet: normalizeMiningFleet(
      rest.miningFleet as GlobalSettings['miningFleet'],
      'ore',
      (rest.miningShipId as MiningShipId | undefined) ?? DEFAULT_MINING_SHIP_ID,
      rest.miningFleetSize as number | undefined,
      {
        miner: undefined,
        crystal: rest.miningCrystal as MiningCrystalId | undefined,
        upgrade: rest.miningUpgrade as MiningUpgradeId | undefined,
        upgradeCount: rest.miningUpgradeCount as number | undefined,
        surveyChipset: rest.miningSurveyChipset as MiningSurveyChipsetId | undefined,
      },
    ),
    ...(() => {
      const rawBuffIds = rest.miningBuffIds as MiningBuffId[] | undefined
      const migrated = migrateBoosterFromLegacyBuffIds(rawBuffIds ?? [])
      const boostSpace = normalizeMiningBoostSpace(rest.miningBoostSpace as MiningBoostSpace | undefined)
      const explicitHull = rest.miningBoosterHull as MiningBoosterHullId | null | undefined
      const hull =
        explicitHull !== undefined
          ? normalizeMiningBoosterHull(explicitHull)
          : migrated.hull
            ? normalizeMiningBoosterHull(migrated.hull)
            : null
      const upgrade =
        rest.miningUpgrade != null
          ? normalizeMiningUpgrade(rest.miningUpgrade as MiningUpgradeId)
          : migrated.upgrade
      return {
        miningBoosterHull: hull,
        miningForemanBurst: normalizeMiningForemanBurst(
          (rest.miningForemanBurst as MiningForemanBurstId | undefined) ?? migrated.burst,
        ),
        miningForemanBursts: normalizeMiningForemanBursts(
          hull,
          rest.miningForemanBursts as MiningForemanBurstId[] | undefined,
          (rest.miningForemanBurst as MiningForemanBurstId | undefined) ?? migrated.burst,
        ),
        miningBurstTech: normalizeMiningBurstTech(rest.miningBurstTech as MiningBurstTech | undefined),
        miningIndustrialCore: rest.miningIndustrialCore !== false,
        miningUpgrade: upgrade,
        miningUpgradeCount: normalizeMiningUpgradeCount(
          (rest.miningUpgradeCount as number | undefined) ?? migrated.upgradeCount,
          upgrade,
        ),
        miningSurveyChipset: normalizeMiningSurveyChipset(
          (rest.miningSurveyChipset as MiningSurveyChipsetId | undefined) ??
            DEFAULT_SETTINGS.miningSurveyChipset,
        ),
        miningCrystal: normalizeMiningCrystal(rest.miningCrystal as MiningCrystalId | undefined),
        miningReprocessFacility: normalizeMiningReprocessFacility(
          rest.miningReprocessFacility as MiningReprocessFacility | undefined,
        ),
        miningReprocessLocationId: rest.miningReprocessLocationId ?? null,
        miningReprocessLocationKind:
          (rest.miningReprocessLocationKind as ProductionLocationKind | undefined) ?? null,
        miningBuffIds: normalizeMiningBuffIds(
          explicitHull !== undefined ? (rawBuffIds ?? []) : migrated.buffIds,
          boostSpace,
        ),
      }
    })(),
  }
}

export const SCHEMA_VERSION = 3
export const USER_DATA_KEY = 'eveio:userData'

export function createDefaultUserData(): UserData {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    watchlist: [],
    planTemplates: [],
  }
}

export function createPlanTemplateId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createPlanRootId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `root-${crypto.randomUUID()}`
  }
  return `root-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function ensurePlanRootIds(roots: PlanRootEntry[] | undefined): PlanRootEntry[] {
  return (roots ?? []).map((r) => ({
    ...r,
    id: r.id?.trim() ? r.id : createPlanRootId(),
    productTypeId: Number(r.productTypeId),
    runs: Math.max(1, Number(r.runs) || 1),
    productionDurationHours: Number(r.productionDurationHours) || 0,
    enabled: r.enabled === false ? false : undefined,
  }))
}

export function migratePlanTemplates(templates: ManufacturingPlanTemplate[] | undefined): ManufacturingPlanTemplate[] {
  return (templates ?? []).map((t) => ({
    ...t,
    roots: ensurePlanRootIds(t.roots),
    modeOverrides: t.modeOverrides ?? {},
    nodeOverrides: t.nodeOverrides ?? {},
  }))
}

export function createDefaultPlanTemplate(name = 'New plan'): ManufacturingPlanTemplate {
  const now = new Date().toISOString()
  return {
    id: createPlanTemplateId(),
    name,
    createdAt: now,
    updatedAt: now,
    productionWindowHours: 24,
    slotSource: 'skills',
    manufacturingSlots: 6,
    defaultRunsPerBpc: 10,
    roots: [],
    modeOverrides: {},
    nodeOverrides: {},
  }
}

export function loadUserDataFromLocal(): UserData {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY)
    if (!raw) return createDefaultUserData()
    const parsed = JSON.parse(raw) as LegacyUserData
    const legacySkills = parsed.accounts?.[0]?.skills
    const { onboardingComplete: _onboarding, accounts: _accounts, ...rest } = parsed
    return {
      ...createDefaultUserData(),
      ...rest,
      planTemplates: migratePlanTemplates(parsed.planTemplates ?? []),
      settings: normalizeGlobalSettings({
        ...(parsed.settings ?? {}),
        skills: normalizeSkillLevels(parsed.settings?.skills ?? legacySkills, {
          legacyZeroMeansDefault: true,
        }),
      }),
    }
  } catch {
    return createDefaultUserData()
  }
}

export function saveUserDataToLocal(data: UserData): void {
  const payload: UserData = {
    ...data,
    schemaVersion: SCHEMA_VERSION,
    planTemplates: migratePlanTemplates(data.planTemplates ?? []),
    settings: normalizeGlobalSettings(data.settings),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(payload))
}
