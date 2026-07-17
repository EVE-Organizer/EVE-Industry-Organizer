import type { HubId, UserData, GlobalSettings, SkillLevels, ManufacturingPlanTemplate, PlanRootEntry } from '@/types'
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, ZERO_SKILLS, HUBS } from '@/types'
import { SKILL_FIELDS, enforceSkillPrerequisites } from '@/lib/skillFields'
import { normalizeBpoLifetimeRunsByCategory } from '@/lib/bpoLifetime'

type LegacySettings = Partial<Omit<GlobalSettings, 'skills'>> & {
  skills?: Partial<SkillLevels>
  buildSystemId?: number
  manufacturingRegionId?: number
  brokerFeePercent?: number
  salesTaxPercent?: number
  batchSize?: number
  /** Pre-category lifetime setting; migrated into blueprintLifetimeRunsByCategory.default. */
  blueprintLifetimeRuns?: number
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
  return enforceSkillPrerequisites({ ...ZERO_SKILLS, ...(skills ?? {}) } as SkillLevels)
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
    blueprintLifetimeRuns: legacyLifetimeRuns,
    skills: parsedSkills,
    ...rest
  } = parsed
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    primaryHub,
    sellHubId,
    manufacturingSystemId,
    blueprintLifetimeRunsByCategory: normalizeBpoLifetimeRunsByCategory(
      rest.blueprintLifetimeRunsByCategory,
      legacyLifetimeRuns,
    ),
    skills: normalizeSkillLevels(parsedSkills),
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
