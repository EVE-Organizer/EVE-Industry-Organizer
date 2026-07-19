export type HubId = 'jita' | 'amarr' | 'dodixie' | 'rens' | 'hek' | 'ympwl'

export const MAX_ME = 10
export const MAX_TE = 20
export const MIN_BATCH_SIZE = 1
export const MAX_BATCH_SIZE = 10_000
export const BATCH_SIZE_STEP = 10
export const DEFAULT_BATCH_SIZE = 100

export type BlueprintTier = 't1' | 't2' | 'faction'

export const BLUEPRINT_TIERS: BlueprintTier[] = ['t1', 't2', 'faction']

export type RecipeKind = 'manufacturing' | 'reaction'

export type ReactionFamily = 'composite' | 'biochemical' | 'polymer' | 'molecular'

export type TimeRange = '1d' | '1w' | '1m' | '1y' | 'all'

export interface TypeInfo {
  typeId: number
  name: string
  group: string
  category: string
  volume: number
  iconUrl: string
  renderUrl: string
  bpIconUrl: string
}

export interface BlueprintMaterial {
  typeId: number
  quantity: number
}

/** T2 invention inputs: produced from a T1 blueprint via datacores + a success roll. */
export interface InventionInfo {
  t1BlueprintTypeId: number
  datacores: BlueprintMaterial[]
  /** Runs on the invented T2 BPC (no decryptor). */
  runsPerBPC: number
  /** Base success chance before skills (0-1). */
  baseChance: number
}

export interface BlueprintInfo {
  blueprintTypeId: number
  productTypeId: number
  productQuantity: number
  manufacturingTime: number
  materials: BlueprintMaterial[]
  requiredSkills: Record<string, number>
  tier: BlueprintTier
  /** SDE activity: manufacturing (1) or reaction (11). Omitted = manufacturing. */
  kind?: RecipeKind
  /** Reaction formula family from SDE group name. */
  reactionFamily?: ReactionFamily
  productGroup: string
  bpIconUrl: string
  productIconUrl: string
  productRenderUrl: string
  invention?: InventionInfo
}

export interface BlueprintRegistry {
  generatedAt: string
  blueprints: BlueprintInfo[]
}

export interface SkillInfo {
  skillId: number
  name: string
  rank: number
  prerequisites: { skillId: number; level: number }[]
  iconUrl: string
}

export interface SystemInfo {
  systemId: number
  name: string
  regionId: number
  security: number
  /** Manufacturing cost index from ESI. Present only on active-industry systems. */
  costIndex?: number
  /** Reaction cost index from ESI. Present only on active-industry systems. */
  reactionCostIndex?: number
  hubId?: HubId
}

export interface RegionInfo {
  regionId: number
  name: string
  securityClass: 'highsec' | 'lowsec' | 'nullsec'
  buildSystemId: number
  buildSystemName: string
  buildSystemSecurity: number
  costIndex: number
  /** Reaction job cost index for the region build system. */
  reactionCostIndex?: number
  marketSystemId: number
}

export interface RegionsData {
  generatedAt: string
  regions: RegionInfo[]
}

export interface ProductWindowSummary {
  avgPrice: number
  avgVolume: number
  high: number
  low: number
}

export interface HubMarketData {
  regionId: number
  marketSystemId: number
  buildSystemId: number
  costIndex: number
  /** Reaction job cost index for the hub build system. */
  reactionCostIndex?: number
  prices: Record<string, number>
  /** Hub buy order max prices (instant sell). Optional until market.json is rebuilt. */
  buyPrices?: Record<string, number>
  products: Record<string, Partial<Record<TimeRange, ProductWindowSummary>>>
  /** ISO timestamp per product type id; used by rebuild-market to skip fresh history */
  productsFetchedAt?: Record<string, string>
}

export interface HaulRate {
  valid: boolean
  iskPerM3: number
  jumps: number | null
  samples: number
  fromSystemId: number
  toSystemId: number
}

export interface MarketData {
  generatedAt: string
  hubs: Record<HubId, HubMarketData>
  haulRates: Record<string, HaulRate>
}

export interface MarketHistoryEntry {
  date: string
  average: number
  highest: number
  lowest: number
  volume: number
}

export type StructureType = 'npc' | 'raitaru' | 'azbel' | 'sotiyo' | 'custom'

/** Upwell engineering complex hull role bonuses (percent reduction). Rigs are separate. */
export const STRUCTURE_HULL_PRESETS: Record<
  Exclude<StructureType, 'npc' | 'custom'>,
  { hullMeBonusPercent: number; hullTeBonusPercent: number; hullJobCostBonusPercent: number }
> = {
  raitaru: { hullMeBonusPercent: 1, hullTeBonusPercent: 15, hullJobCostBonusPercent: 3 },
  azbel: { hullMeBonusPercent: 2, hullTeBonusPercent: 20, hullJobCostBonusPercent: 4 },
  sotiyo: { hullMeBonusPercent: 3, hullTeBonusPercent: 25, hullJobCostBonusPercent: 5 },
}

/** @deprecated Use STRUCTURE_HULL_PRESETS. Kept for migration reads. */
export const STRUCTURE_PRESETS: Record<
  Exclude<StructureType, 'npc' | 'custom'>,
  { structureMeBonusPercent: number; structureTeBonusPercent: number; structureJobCostBonusPercent: number }
> = {
  raitaru: { structureMeBonusPercent: 1, structureTeBonusPercent: 15, structureJobCostBonusPercent: 3 },
  azbel: { structureMeBonusPercent: 2, structureTeBonusPercent: 20, structureJobCostBonusPercent: 4 },
  sotiyo: { structureMeBonusPercent: 3, structureTeBonusPercent: 25, structureJobCostBonusPercent: 5 },
}

export interface ManufacturingRigModifiers {
  rigMeBonusPercent: number
  rigTeBonusPercent: number
  rigJobCostBonusPercent: number
}

export const DEFAULT_MANUFACTURING_RIGS: ManufacturingRigModifiers = {
  rigMeBonusPercent: 0,
  rigTeBonusPercent: 0,
  rigJobCostBonusPercent: 0,
}

export type RefineryType = 'none' | 'athanor' | 'tatara' | 'custom'

export type ReactionFamilyGroup = 'composite' | 'biochemical' | 'hybrid'

export interface ReactionFamilyModifiers {
  rigMeBonusPercent: number
  rigTeBonusPercent: number
  taxPercent: number
}

export const REACTION_FAMILY_GROUPS: ReactionFamilyGroup[] = [
  'composite',
  'biochemical',
  'hybrid',
]

export const DEFAULT_REACTION_FAMILY_MODIFIERS: ReactionFamilyModifiers = {
  rigMeBonusPercent: 0,
  rigTeBonusPercent: 0,
  taxPercent: 0,
}

export function defaultReactionFamilyModifiers(): Record<
  ReactionFamilyGroup,
  ReactionFamilyModifiers
> {
  return {
    composite: { ...DEFAULT_REACTION_FAMILY_MODIFIERS },
    biochemical: { ...DEFAULT_REACTION_FAMILY_MODIFIERS },
    hybrid: { ...DEFAULT_REACTION_FAMILY_MODIFIERS },
  }
}

export interface ReactionFacilitySettings {
  reactionSystemId: number
  refineryType: RefineryType
  /** Hull TE role bonus for custom refinery; presets use REFINERY_HULL_PRESETS. */
  hullTeBonusPercent: number
  familyModifiers: Record<ReactionFamilyGroup, ReactionFamilyModifiers>
}

export const REFINERY_HULL_PRESETS: Record<
  Exclude<RefineryType, 'none' | 'custom'>,
  { hullTeBonusPercent: number }
> = {
  athanor: { hullTeBonusPercent: 0 },
  tatara: { hullTeBonusPercent: 25 },
}

export function defaultReactionFacility(manufacturingSystemId: number): ReactionFacilitySettings {
  return {
    reactionSystemId: manufacturingSystemId,
    refineryType: 'none',
    hullTeBonusPercent: 0,
    familyModifiers: defaultReactionFamilyModifiers(),
  }
}

/** Resolved facility bonuses for cost math and breakdown display. */
export interface FacilityBonusDetail {
  hullMeBonusPercent: number
  hullTeBonusPercent: number
  hullJobCostBonusPercent: number
  rigMeBonusPercent: number
  rigTeBonusPercent: number
  rigJobCostBonusPercent: number
  effectiveMeBonusPercent: number
  effectiveTeBonusPercent: number
  effectiveJobCostBonusPercent: number
  taxPercent: number
}

export interface StructureModifiers {
  meBonusPercent: number
  teBonusPercent: number
  jobCostBonusPercent: number
  taxPercent: number
}

export interface GlobalSettings {
  primaryHub: HubId
  /** Solar system ID where manufacturing jobs are run. Drives cost index and haul routes. */
  manufacturingSystemId: number
  sellHubId: HubId
  meDefault: number
  teDefault: number
  structureType: StructureType
  /** Custom hull ME bonus (player structures only; presets use STRUCTURE_HULL_PRESETS). */
  structureMeBonusPercent: number
  /** Custom hull TE bonus (player structures only). */
  structureTeBonusPercent: number
  /** Custom hull job cost bonus (player structures only). */
  structureJobCostBonusPercent: number
  /** M-Set rig bonuses fitted on the manufacturing structure. */
  manufacturingRigs: ManufacturingRigModifiers
  /** Manufacturing tax charged by the structure owner (player structures only). */
  structureTaxPercent: number
  /** Refinery and per-type reaction rig/tax settings. */
  reactionFacility: ReactionFacilitySettings
  priceMethod: 'sell_orders' | 'buy_orders'
  /** Per product-category assumed BPO lifetime runs for T1 amortization. */
  blueprintLifetimeRunsByCategory: BpoLifetimeRunsByCategory
  /** Assumed level (0-5) for invention encryption + datacore skills, used to estimate T2 success chance. */
  inventionSkillLevel: number
  /** Include blueprint acquisition cost (amortized BPO / invention) in profit and budget. */
  includeBlueprintCost: boolean
  /** Assumed manufacturing and market skill levels used in profit and ranking calculations. */
  skills: SkillLevels
  /** SSO character whose production station and inventory are used on Plan. */
  productionCharacterId?: number | null
  /** Selected station or structure ID for manufacturing and inventory. */
  productionLocationId?: number | null
  productionLocationKind?: ProductionLocationKind | null
  /** Selected station or structure ID for reaction jobs. */
  reactionLocationId?: number | null
  reactionLocationKind?: ProductionLocationKind | null
}

/** Global settings plus per-job run count for manufacturing cost and profit math. */
export type ManufacturingSettings = GlobalSettings & { batchSize: number }

export interface SkillLevels {
  industry: number
  advancedIndustry: number
  science: number
  accounting: number
  brokerRelations: number
  massProduction: number
  advancedMassProduction: number
  /** Reactions skill: −4% reaction time per level. */
  reactions: number
  [key: string]: number
}

export interface MineralStock {
  tritanium: number
  pyerite: number
  mexallon: number
  isogen: number
  nocxium: number
  zydrine: number
  megacyte: number
}

export interface WatchlistItem {
  productTypeId: number
  addedAt: string
}

export type PlanSlotSource = 'skills' | 'manual'
export type PlanBuildMode = 'buy' | 'build'

export interface PlanRootEntry {
  id: string
  productTypeId: number
  runs: number
  productionDurationHours: number
}

export interface PlanNodeOverride {
  runs?: number
  copies?: number
  runsPerBpc?: number
  forceInclude?: boolean
  me?: number
  te?: number
}

export interface ManufacturingPlanTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  productionWindowHours: number
  slotSource: PlanSlotSource
  manufacturingSlots: number
  defaultRunsPerBpc: number
  roots: PlanRootEntry[]
  modeOverrides: Record<number, PlanBuildMode>
  nodeOverrides: Record<number, PlanNodeOverride>
}

/** Computed plan node (not persisted). */
export interface PlanNode {
  productTypeId: number
  name: string
  tier?: BlueprintTier
  /** Recipe kind when this node has a blueprint (manufacturing vs reaction). */
  recipeKind?: RecipeKind
  mode: PlanBuildMode
  totalDemandQty: number
  demandByParent: { parentProductTypeId: number; qty: number }[]
  parentProductTypeIds: number[]
  childProductTypeIds: number[]
  runs: number
  bpcCount: number
  concurrentCopies: number
  jobTimeSeconds: number
  outputQty: number
  isRoot: boolean
  isLeaf: boolean
  depth: number
  /** Has a manufacturing blueprint and is not a raw mineral. */
  canToggle: boolean
  /** Hub sell price per unit (material buys). */
  unitPrice?: number
  /** Hub price × demand qty (buy from market). */
  buyCost?: number
  /** Rolled-up build cost for required runs (same logic as production graph). */
  buildCost?: number
  /** buyCost − buildCost; positive means build is cheaper. */
  savings?: number
  /** Cost-based suggestion before user overrides. */
  recommendedMode?: PlanBuildMode
  /** Packaged self-product bought from market (structure / POS kits). */
  packagedBuyQty?: number
  /** Synthetic buy row derived from a build parent's packaged input. */
  packagedInput?: boolean
  /** Effective ME for this build node (after tier rules and overrides). */
  me?: number
  /** Effective TE for this build node (after tier rules and overrides). */
  te?: number
  /** T2 / faction BPOs use fixed ME/TE and cannot be overridden. */
  meTeLocked?: boolean
}

export interface PlanTimeBucket {
  hour: number
  supply: number
  demand: number
  inventory: number
}

export interface PlanNodeSimulation {
  productTypeId: number
  buckets: PlanTimeBucket[]
  shortages: { startHour: number; endHour: number; deficit: number }[]
}

export interface ScheduledPlanJob {
  productTypeId: number
  name: string
  slot: number
  startHour: number
  endHour: number
  runs: number
  outputQty: number
}

export type IndustryActivityId = 1 | 3 | 4 | 5 | 7 | 8 | 11

export type LiveIndustryJobStatus = 'active' | 'paused' | 'ready' | 'delivered' | 'cancelled' | 'reverted'

/** In-game industry job from ESI (not a plan simulation). */
export interface LiveIndustryJob {
  jobId: number
  characterId: number
  installerId: number
  /** ESI blueprint item instance ID (matches character blueprints item_id). */
  blueprintId: number
  activityId: IndustryActivityId
  activityLabel: string
  blueprintTypeId: number
  productTypeId: number
  productName: string
  facilityId: number
  locationId: number
  runs: number
  /** Licensed runs on the blueprint for this job (copy output runs, etc.). */
  licensedRuns?: number
  status: LiveIndustryJobStatus
  startAt: string
  endAt: string
  durationSeconds: number
  successfulRuns?: number
}

export interface AssetQuantity {
  typeId: number
  quantity: number
}

export type ProductionLocationKind = 'station' | 'structure'

/** A station or player structure where a character can manufacture. */
export interface ProductionLocation {
  id: string
  locationId: number
  kind: ProductionLocationKind
  name: string
  solarSystemId: number
  structureTypeId?: number
  source:
    | 'character_asset'
    | 'corp_asset'
    | 'corp_structure'
    | 'industry_job'
    | 'blueprint'
    | 'station'
}

export interface UserData {
  schemaVersion: number
  updatedAt: string
  settings: GlobalSettings
  watchlist: WatchlistItem[]
  planTemplates: ManufacturingPlanTemplate[]
  /** Last selected plan template tab; restored on reload. */
  selectedPlanTemplateId?: string | null
}

export interface HubConfig {
  id: HubId
  name: string
  regionId: number
  regionName: string
  sellStationId: number
  sellStationName: string
  buildSystemId: number
  buildSystemName: string
  marketSystemId: number
}

export interface SetupMaterialLine {
  typeId: number
  baseQtyPerRun: number
  quantity: number
  unitPrice: number
  lineTotal: number
  unitVolumeM3: number
  lineVolumeM3: number
}

export interface SetupCostBreakdown {
  batchSizeSetting: number
  productQuantity: number
  avgVolume: number
  volumeCapDays: number
  runs: number
  outputQty: number
  me: number
  materials: SetupMaterialLine[]
  materialCost: number
  /** Base (ME 0) material value used for job installation fees. */
  estimatedItemValue: number
  systemCostIndex: number
  structureType: StructureType
  structureMeBonusPercent: number
  structureTeBonusPercent: number
  structureJobCostBonusPercent: number
  structureTaxPercent: number
  facilityBonus?: FacilityBonusDetail
  jobCost: number
  bpoTypeId: number
  bpoUnitPrice: number
  bpoCost: number
  blueprintCost: BlueprintCostBreakdown
  upfrontCapital: number
  materialVolumeM3: number
  haulInIskPerM3: number
  haulIn: number
  /** Haul costs left out of setup/profit when the ranking excludes hauling. */
  haulExcluded?: boolean
  setupCost: number
}

/** How a blueprint's acquisition cost is charged into a batch. */
export interface BlueprintCostBreakdown {
  mode: 'bpo' | 'invention' | 'faction_bpc'
  /** Amortized (T1/faction) or consumable (T2) cost charged into this batch's profit. */
  charged: number
  /** Full cash to acquire the blueprint upfront for this batch. */
  upfront: number
  /** Charge products (ammo, scripts) skip blueprint cost: one cheap BPO makes huge volume. */
  chargeExcluded?: boolean
  /** Hub has no sell order or history for this BPO; charged/upfront blueprint cost is 0. */
  bpoPriceMissing?: boolean
  /** T1/faction (BPO). */
  bpoUnitPrice?: number
  researchFee?: number
  lifetimeRuns?: number
  lifetimeCategory?: BpoLifetimeCategoryKey
  /** T2 (invention). */
  datacoreCost?: number
  inventionChance?: number
  runsPerBPC?: number
  expectedRunsPerAttempt?: number
  costPerRun?: number
}

export interface IphBreakdown {
  me: number
  te: number
  industry: number
  advancedIndustry: number
  batchSizeSetting: number
  productQuantity: number
  avgVolume: number
  volumeCapDays: number
  runs: number
  outputQty: number
  baseTimePerRunSeconds: number
  teTimeFactor: number
  industryTimeFactor: number
  structureTeTimeFactor: number
  advancedIndustryTimeFactor: number
  jobTimeSeconds: number
  sellPricePerUnit: number
  priceMethod: 'sell_orders' | 'buy_orders'
  grossRevenue: number
  brokerFeePercent: number
  brokerFee: number
  salesTaxPercent: number
  salesTax: number
  netRevenue: number
  materialCost: number
  /** Base (ME 0) material value used for job installation fees. */
  estimatedItemValue: number
  systemCostIndex: number
  structureType: StructureType
  structureMeBonusPercent: number
  structureTeBonusPercent: number
  structureJobCostBonusPercent: number
  structureTaxPercent: number
  facilityBonus?: FacilityBonusDetail
  jobCost: number
  bpoTypeId: number
  bpoUnitPrice: number
  bpoCost: number
  blueprintCost: BlueprintCostBreakdown
  upfrontCapital: number
  materialVolumeM3: number
  haulInIskPerM3: number
  haulIn: number
  productVolumeM3: number
  haulOutIskPerM3: number
  haulOut: number
  /** Haul costs left out of setup/profit when the ranking excludes hauling. */
  haulExcluded?: boolean
  setupCost: number
  netProfit: number
  profitPerUnit: number
  productionPerDay: number
  sellablePerDay: number
  marketShare: number
  competitionFactor: number
  realizedDailyProfit: number
  iph: number
}

export interface RankedBlueprintRow {
  blueprint: BlueprintInfo
  product: TypeInfo
  setupCost: number
  /** Real cash needed to start one batch (full blueprint + materials + job + haul in). Used for budget filter. */
  upfrontCapital: number
  setupBreakdown: SetupCostBreakdown
  iphBreakdown: IphBreakdown
  haulIn: number
  haulOut: number
  capital: number
  netProfit: number
  margin: number
  iph: number
  avgVolume: number
  daysToClear: number
  volatility: number
  jobTimeSeconds: number
  marketShare: number
  competitionFactor: number
}

export interface SupplyChainNode {
  typeId: number
  /** Stable React Flow node id when typeId alone is not unique enough. */
  graphId?: string
  name: string
  quantity: number
  unitPrice: number
  totalCost: number
  mode: 'buy' | 'build' | 'react' | 'blueprint'
  buildCost?: number
  buyCost?: number
  savings?: number
  children?: SupplyChainNode[]
  isLeaf: boolean
  depth: number
  /** Product type for blueprint icon fallback. */
  productTypeId?: number
}

export const BPO_LIFETIME_CATEGORY_KEYS = [
  'ship',
  'module',
  'drone',
  'deployable',
  'structure',
  'default',
] as const

export type BpoLifetimeCategoryKey = (typeof BPO_LIFETIME_CATEGORY_KEYS)[number]

export type BpoLifetimeRunsByCategory = Record<BpoLifetimeCategoryKey, number>

export const DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY: BpoLifetimeRunsByCategory = {
  ship: 50,
  module: 500,
  drone: 2000,
  deployable: 30,
  structure: 20,
  default: 500,
}

export const MIN_BLUEPRINT_LIFETIME_RUNS = 1
export const MAX_BLUEPRINT_LIFETIME_RUNS = 100_000

export const DEFAULT_SKILL_LEVEL = 3

export const DEFAULT_SKILLS: SkillLevels = {
  industry: DEFAULT_SKILL_LEVEL,
  advancedIndustry: DEFAULT_SKILL_LEVEL,
  science: DEFAULT_SKILL_LEVEL,
  accounting: DEFAULT_SKILL_LEVEL,
  brokerRelations: 0,
  massProduction: DEFAULT_SKILL_LEVEL,
  advancedMassProduction: DEFAULT_SKILL_LEVEL,
  reactions: DEFAULT_SKILL_LEVEL,
}

/** Untrained skill levels used when importing from ESI or before sync completes. */
export const ZERO_SKILLS: SkillLevels = {
  industry: 0,
  advancedIndustry: 0,
  science: 0,
  accounting: 0,
  brokerRelations: 0,
  massProduction: 0,
  advancedMassProduction: 0,
  reactions: 0,
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  primaryHub: 'jita',
  manufacturingSystemId: 30000144,
  sellHubId: 'jita',
  meDefault: MAX_ME,
  teDefault: MAX_TE,
  structureType: 'npc',
  structureMeBonusPercent: 0,
  structureTeBonusPercent: 0,
  structureJobCostBonusPercent: 0,
  manufacturingRigs: { ...DEFAULT_MANUFACTURING_RIGS },
  structureTaxPercent: 0,
  reactionFacility: defaultReactionFacility(30000144),
  priceMethod: 'sell_orders',
  blueprintLifetimeRunsByCategory: { ...DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY },
  inventionSkillLevel: 4,
  includeBlueprintCost: true,
  skills: { ...DEFAULT_SKILLS },
  productionCharacterId: null,
  productionLocationId: null,
  productionLocationKind: null,
  reactionLocationId: null,
  reactionLocationKind: null,
}

/** T2 invented blueprint copy base efficiency without a decryptor. */
export const T2_INVENTED_ME = 2
export const T2_INVENTED_TE = 4

export const HUBS: HubConfig[] = [
  {
    id: 'jita',
    name: 'Jita',
    regionId: 10000002,
    regionName: 'The Forge',
    sellStationId: 60003760,
    sellStationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
    buildSystemId: 30000144,
    buildSystemName: 'Perimeter',
    marketSystemId: 30000142,
  },
  {
    id: 'amarr',
    name: 'Amarr',
    regionId: 10000043,
    regionName: 'Domain',
    sellStationId: 60008494,
    sellStationName: 'Amarr VIII (Oris) - Emperor Family Academy',
    buildSystemId: 30002187,
    buildSystemName: 'Amarr',
    marketSystemId: 30002187,
  },
  {
    id: 'dodixie',
    name: 'Dodixie',
    regionId: 10000032,
    regionName: 'Sinq Laison',
    sellStationId: 60011866,
    sellStationName: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant',
    buildSystemId: 30002659,
    buildSystemName: 'Dodixie',
    marketSystemId: 30002659,
  },
  {
    id: 'rens',
    name: 'Rens',
    regionId: 10000030,
    regionName: 'Heimatar',
    sellStationId: 60004588,
    sellStationName: 'Rens VI - Moon 8 - Brutor Tribe Treasury',
    buildSystemId: 30002510,
    buildSystemName: 'Rens',
    marketSystemId: 30002510,
  },
  {
    id: 'hek',
    name: 'Hek',
    regionId: 10000042,
    regionName: 'Metropolis',
    sellStationId: 60005686,
    sellStationName: 'Hek VIII - Moon 12 - Boundless Creation Factory',
    buildSystemId: 30002053,
    buildSystemName: 'Hek',
    marketSystemId: 30002053,
  },
  {
    id: 'ympwl',
    name: 'Y-MPWL',
    regionId: 10000047,
    regionName: 'Providence',
    sellStationId: 0,
    sellStationName: 'Y-MPWL',
    buildSystemId: 30003726,
    buildSystemName: 'Y-MPWL',
    marketSystemId: 30003726,
  },
]

export const REGION_IDS: Record<HubId, number> = {
  jita: 10000002,
  amarr: 10000043,
  dodixie: 10000032,
  rens: 10000030,
  hek: 10000042,
  ympwl: 10000047,
}

export const MINERAL_TYPE_IDS: Record<keyof MineralStock, number> = {
  tritanium: 34,
  pyerite: 35,
  mexallon: 36,
  isogen: 37,
  nocxium: 38,
  zydrine: 39,
  megacyte: 40,
}
