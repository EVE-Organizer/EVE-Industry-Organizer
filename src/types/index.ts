export type HubId = 'jita' | 'amarr' | 'dodixie' | 'rens' | 'hek' | 'ympwl' | 'vale'

export const MAX_ME = 10
export const MAX_TE = 20
export const MIN_BATCH_SIZE = 1
export const MAX_BATCH_SIZE = 10_000
export const BATCH_SIZE_STEP = 10
export const DEFAULT_BATCH_SIZE = 100

/** Blueprint ranking filter: target job duration (hours in UI, seconds in settings). */
export const MIN_RANKING_TIME_HOURS = 1
export const MAX_RANKING_TIME_HOURS = 720
export const DEFAULT_RANKING_TIME_HOURS = 720

export type BlueprintTier = 't1' | 't2' | 'faction'

export const BLUEPRINT_TIERS: BlueprintTier[] = ['t1', 't2', 'faction']

export type RecipeKind = 'manufacturing' | 'reaction'

/** Recipe kinds shown in blueprint ranking filters. */
export const RANKING_RECIPE_KINDS: RecipeKind[] = ['manufacturing', 'reaction']
export const DEFAULT_RECIPE_KINDS: RecipeKind[] = ['manufacturing', 'reaction']

export type ReactionFamily = 'composite' | 'biochemical' | 'polymer' | 'molecular'

export type TimeRange = '1d' | '1w' | '1m' | '1y' | 'all'

export interface TypeInfo {
  typeId: number
  name: string
  group: string
  category: string
  volume: number
  /** Item mass in kg from SDE. Omitted on older types.json builds. */
  mass?: number
  /** Flavor / usage text from SDE. Omitted on older types.json builds. */
  description?: string
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
  /** Copy job time (seconds) on the T1 BPO (SDE activity 5). */
  copyTime?: number
  /** Invention job time (seconds) on the T1 BPC (SDE activity 8). */
  inventionTime?: number
}

export interface BlueprintInfo {
  blueprintTypeId: number
  productTypeId: number
  productQuantity: number
  manufacturingTime: number
  /** Copy job time (seconds) for this blueprint type (SDE activity 5). */
  copyTime?: number
  /** Invention job time (seconds) when this BPO is the invention input (SDE activity 8). */
  inventionTime?: number
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
  primaryAttribute?: EveAttributeId
  secondaryAttribute?: EveAttributeId
}

export type EveAttributeId =
  | 'intelligence'
  | 'memory'
  | 'perception'
  | 'willpower'
  | 'charisma'

export interface SkillAttributePair {
  primaryAttribute: EveAttributeId
  secondaryAttribute: EveAttributeId
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
  /** ESI order_count; 0 when missing from cache or API. */
  orderCount: number
}

export interface BpcContractListing {
  contractId: number
  price: number
  buyout: number
  me: number
  te: number
  runs: number
  expires: string
  stationId?: number
}

export interface BpcContractSummary {
  count: number
  minBuyout: number
  listings: BpcContractListing[]
}

export interface ContractsData {
  generatedAt: string
  snapshotSource?: string
  hubs: Partial<Record<HubId, { byBlueprintTypeId: Record<string, BpcContractSummary> }>>
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

export type ManufacturingRigTier = 'none' | 't1' | 't2' | 'custom'

/** One fitted M/L/XL manufacturing rig from ESI assets + type dogma. */
export interface FittedManufacturingRig {
  typeId: number
  name: string
  meBase: number
  teBase: number
  jobCostBase: number
}

export interface ManufacturingFamilyRigTiers {
  meRig: ManufacturingRigTier
  teRig: ManufacturingRigTier
}

export interface ManufacturingRigModifiers {
  /** Fitted ME rig tier; custom uses rigMeBonusPercent as pasted from in-game tooltip. */
  meRig: ManufacturingRigTier
  /** Fitted TE rig tier; custom uses rigTeBonusPercent as pasted from in-game tooltip. */
  teRig: ManufacturingRigTier
  rigMeBonusPercent: number
  rigTeBonusPercent: number
  rigJobCostBonusPercent: number
  /**
   * ESI-imported rigs. When present, ME/TE apply only to matching product groups
   * (e.g. Ammunition Manufacturing does not buff ships).
   */
  fitted?: FittedManufacturingRig[]
  /** Per-category ME/TE. */
  familyRigs?: Partial<Record<string, ManufacturingFamilyRigTiers>>
}

export const DEFAULT_MANUFACTURING_RIGS: ManufacturingRigModifiers = {
  meRig: 'none',
  teRig: 'none',
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
  /** Cached security of manufacturingSystemId; scales rig bonuses (HS 1x, LS 1.9x, null/WH 2.1x). */
  buildSystemSecurity: number
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
  /** Hub price / history window for material and product pricing (Plan + Blueprints default). */
  priceWindow: TimeRange
  /** Include haul in/out in setup and profit (Plan + Blueprints default). */
  includeHaulCost: boolean
  /** Assumed level (0-5) for invention encryption + datacore skills, used to estimate T2 success chance. */
  inventionSkillLevel: number
  /** Include blueprint acquisition cost (BPO upfront / BPC per batch / invention) in profit and budget. */
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
  /** Mining ISK/hr page: reference hull for m³/hr scale. */
  miningShipId?: MiningShipId
  /** Mining ISK/hr page: yield buff toggles (stack multiplicatively). */
  miningBuffIds?: MiningBuffId[]
  /** Where you mine with fleet boosts (Orca in HS, Rorqual in LS/NS/WH). */
  miningBoostSpace?: MiningBoostSpace
  /** Identical mining ships in your fleet (scales m³/hr and ISK/hr). */
  miningFleetSize?: number
  /** Mixed mining fleet: hull types and counts (sum m³/hr for ISK/hr rankings). */
  miningFleet?: MiningFleetLine[]
  /** Foreman booster hull on grid (Porpoise, Orca, Rorqual). Null = solo mining. */
  miningBoosterHull?: MiningBoosterHullId | null
  /** Active Mining Foreman burst charge when a booster hull is set. */
  miningForemanBurst?: MiningForemanBurstId
  /** Loaded Foreman charges (one per burst module). Porpoise 2, Orca/Rorqual 3. */
  miningForemanBursts?: MiningForemanBurstId[]
  /** Mining Foreman burst module tech (T2 is +25% strength). */
  miningBurstTech?: MiningBurstTech
  /** Orca/Rorqual industrial core (typical +30% burst strength). */
  miningIndustrialCore?: boolean
  /** Mining Laser / Ice Harvester Upgrade module. */
  miningUpgrade?: MiningUpgradeId
  /** How many upgrade modules (1–3). Ignored when upgrade is none. */
  miningUpgradeCount?: number
  /** Mid-slot Mining Survey Chipset (crit chance and crit yield). */
  miningSurveyChipset?: MiningSurveyChipsetId
  /** Strip miner / ice harvester crystals. */
  miningCrystal?: MiningCrystalId
  /** Mining ISK/hr: Upwell / NPC refine facility, rig, and security. */
  miningReprocessFacility?: MiningReprocessFacility
  /** Selected station or structure used for mining reprocess yield. */
  miningReprocessLocationId?: number | null
  miningReprocessLocationKind?: ProductionLocationKind | null
}

/** Global settings plus per-job run count for manufacturing cost and profit math. */
export type ManufacturingSettings = GlobalSettings & {
  batchSize: number
  /** Blueprint ranking: total job time; runs are derived per blueprint from this. */
  rankingTargetTimeSeconds?: number
}

export interface SkillLevels {
  industry: number
  advancedIndustry: number
  science: number
  accounting: number
  brokerRelations: number
  /** Advanced Broker Relations: +5% relist discount per level on modify-order fees. */
  advancedBrokerRelations: number
  massProduction: number
  advancedMassProduction: number
  /** Reactions skill: −4% reaction time per level. */
  reactions: number
  /** Laboratory Operation: +1 concurrent science job per level. */
  laboratoryOperation: number
  /** Advanced Laboratory Operation: +1 more concurrent science job per level. */
  advancedLaboratoryOperation: number
  /** Mining: +5% ore/moon yield per level. */
  mining: number
  /** Astrogeology: +5% ore/moon yield per level. */
  astrogeology: number
  /** Ice Harvesting: −5% ice harvester cycle time per level. */
  iceHarvesting: number
  /** Gas Cloud Harvesting: −5% gas harvester cycle time per level. */
  gasCloudHarvesting: number
  /** Mining Barge: hull-specific Strip Miner yield and Ice Harvester cycle bonuses. */
  miningBarge: number
  /** Exhumers: additional hull-specific Strip Miner yield and cycle bonuses. */
  exhumers: number
  /** Industrial Command Ships: Porpoise/Orca foreman burst strength. */
  industrialCommandShips: number
  /** Capital Industrial Ships: Rorqual foreman burst strength. */
  capitalIndustrialShips: number
  /** Mining Frigate: Venture and Prospect hull bonuses. */
  miningFrigate: number
  /** Expedition Frigates: Prospect and Endurance hull bonuses. */
  expeditionFrigates: number
  /** Mining Director: foreman burst strength. */
  miningDirector: number
  /** Reprocessing: +3% NPC station yield per level. */
  reprocessing: number
  /** Reprocessing Efficiency: +2% yield per level. */
  reprocessingEfficiency: number
  simpleOreProcessing: number
  coherentOreProcessing: number
  variegatedOreProcessing: number
  complexOreProcessing: number
  mercoxitOreProcessing: number
  abyssalOreProcessing: number
  erraticOreProcessing: number
  iceProcessing: number
  ubiquitousMoonOreProcessing: number
  commonMoonOreProcessing: number
  uncommonMoonOreProcessing: number
  rareMoonOreProcessing: number
  exceptionalMoonOreProcessing: number
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
  /** Off jobs stay in the list but are left out of the plan. Default on. */
  enabled?: boolean
}

export interface PlanNodeOverride {
  runs?: number
  copies?: number
  runsPerBpc?: number
  forceInclude?: boolean
  me?: number
  te?: number
  /** Per-item buy hub for live market price; omit = Jita default. */
  buyHub?: HubId
  /** Custom buy price in ISK; mutually exclusive with buyHub. */
  buyPrice?: number
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
  /** Industry activity for this bar (copy / invent / manufacture / reaction). */
  activity?: PlanJobActivity
  /** Which concurrent-job pool this job occupies. */
  pool?: PlanJobPool
}

export type PlanJobActivity = 'copy' | 'invention' | 'manufacture' | 'reaction'
export type PlanJobPool = 'science' | 'manufacturing'

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
    | 'public_structure'
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
  /** Spot vs window average vs missing (for modal badges). */
  priceSource?: 'spot' | 'window_avg' | 'buy_max' | 'missing'
}

export interface SetupCostBreakdown {
  targetJobTimeSeconds: number
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
  mode: 'bpo' | 'bpc' | 'invention' | 'faction_bpc'
  /** Consumable (BPC/T2) cost charged into this batch's profit; reusable BPO is 0. */
  charged: number
  /** Full cash to acquire the blueprint upfront for this batch. */
  upfront: number
  /** Charge products (ammo, scripts) skip blueprint cost: one cheap BPO makes huge volume. */
  chargeExcluded?: boolean
  /** No BPO or BPC price at selected hub or Jita; charged/upfront blueprint cost is 0. */
  bpoPriceMissing?: boolean
  /** Buy hub used for materials; blueprint may still come from sourceHub. */
  selectedHub?: HubId
  /** Hub where BPO/BPC acquisition price was resolved. */
  sourceHub?: HubId
  /** T1 reusable BPO. */
  bpoUnitPrice?: number
  /** T1 consumable BPC from contracts. */
  bpcCostPerRun?: number
  bpcRuns?: number
  bpcBuyout?: number
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
  /** Reactions skill level; set for reaction formulas only. */
  reactions?: number
  /** 1 − (reactions × 4%); set for reaction formulas only. */
  reactionsTimeFactor?: number
  targetJobTimeSeconds: number
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

export const DEFAULT_SKILL_LEVEL = 3

export const DEFAULT_SKILLS: SkillLevels = {
  industry: DEFAULT_SKILL_LEVEL,
  advancedIndustry: DEFAULT_SKILL_LEVEL,
  science: DEFAULT_SKILL_LEVEL,
  accounting: DEFAULT_SKILL_LEVEL,
  brokerRelations: 0,
  advancedBrokerRelations: 0,
  massProduction: DEFAULT_SKILL_LEVEL,
  advancedMassProduction: DEFAULT_SKILL_LEVEL,
  reactions: DEFAULT_SKILL_LEVEL,
  laboratoryOperation: DEFAULT_SKILL_LEVEL,
  advancedLaboratoryOperation: DEFAULT_SKILL_LEVEL,
  mining: 4,
  astrogeology: 4,
  iceHarvesting: 4,
  gasCloudHarvesting: 4,
  miningBarge: 4,
  exhumers: 4,
  industrialCommandShips: 4,
  capitalIndustrialShips: 4,
  miningFrigate: 4,
  expeditionFrigates: 4,
  miningDirector: 4,
  reprocessing: 0,
  reprocessingEfficiency: 0,
  simpleOreProcessing: 0,
  coherentOreProcessing: 0,
  variegatedOreProcessing: 0,
  complexOreProcessing: 0,
  mercoxitOreProcessing: 0,
  abyssalOreProcessing: 0,
  erraticOreProcessing: 0,
  iceProcessing: 0,
  ubiquitousMoonOreProcessing: 0,
  commonMoonOreProcessing: 0,
  uncommonMoonOreProcessing: 0,
  rareMoonOreProcessing: 0,
  exceptionalMoonOreProcessing: 0,
}

/** Untrained skill levels used when importing from ESI or before sync completes. */
export const ZERO_SKILLS: SkillLevels = {
  industry: 0,
  advancedIndustry: 0,
  science: 0,
  accounting: 0,
  brokerRelations: 0,
  advancedBrokerRelations: 0,
  massProduction: 0,
  advancedMassProduction: 0,
  reactions: 0,
  laboratoryOperation: 0,
  advancedLaboratoryOperation: 0,
  mining: 0,
  astrogeology: 0,
  iceHarvesting: 0,
  gasCloudHarvesting: 0,
  miningBarge: 0,
  exhumers: 0,
  industrialCommandShips: 0,
  capitalIndustrialShips: 0,
  miningFrigate: 0,
  expeditionFrigates: 0,
  miningDirector: 0,
  reprocessing: 0,
  reprocessingEfficiency: 0,
  simpleOreProcessing: 0,
  coherentOreProcessing: 0,
  variegatedOreProcessing: 0,
  complexOreProcessing: 0,
  mercoxitOreProcessing: 0,
  abyssalOreProcessing: 0,
  erraticOreProcessing: 0,
  iceProcessing: 0,
  ubiquitousMoonOreProcessing: 0,
  commonMoonOreProcessing: 0,
  uncommonMoonOreProcessing: 0,
  rareMoonOreProcessing: 0,
  exceptionalMoonOreProcessing: 0,
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  primaryHub: 'jita',
  manufacturingSystemId: 30000144,
  buildSystemSecurity: 1,
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
  priceWindow: '1m',
  includeHaulCost: true,
  inventionSkillLevel: 4,
  includeBlueprintCost: true,
  skills: { ...DEFAULT_SKILLS },
  productionCharacterId: null,
  productionLocationId: null,
  productionLocationKind: null,
  reactionLocationId: null,
  reactionLocationKind: null,
  miningShipId: 'retriever',
  miningBuffIds: [],
  miningBoostSpace: 'highsec',
  miningFleetSize: 1,
  miningBoosterHull: null,
  miningForemanBurst: 'miningLaserOptimization',
  miningForemanBursts: ['miningLaserOptimization'],
  miningBurstTech: 't2',
  miningIndustrialCore: true,
  miningUpgrade: 'none',
  miningUpgradeCount: 3,
  miningSurveyChipset: 'msc2',
  miningCrystal: 'none',
  miningReprocessFacility: { hull: 'npc', rig: 'none', space: 'highsec' },
  miningReprocessLocationId: null,
  miningReprocessLocationKind: null,
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
  {
    id: 'vale',
    name: '4-HWWF',
    regionId: 10000003,
    regionName: 'Vale of the Silent',
    sellStationId: 0,
    sellStationName: '4-HWWF',
    buildSystemId: 30000288,
    buildSystemName: '1W-0KS',
    marketSystemId: 30000240,
  },
]

export const REGION_IDS: Record<HubId, number> = {
  jita: 10000002,
  amarr: 10000043,
  dodixie: 10000032,
  rens: 10000030,
  hek: 10000042,
  ympwl: 10000047,
  vale: 10000003,
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

export type MiningSubtype = 'ore' | 'moon' | 'ice' | 'gas'
export type MiningSpaceClass = 'highsec' | 'lowsec' | 'nullsec' | 'wormhole'

/** Where ore/ice/moon is refined for Mining ISK/hr. */
export type MiningReprocessHull = 'npc' | 'upwell' | 'athanor' | 'tatara'
export type MiningReprocessRig = 'none' | 't1' | 't2'
export type MiningReprocessSpace = 'highsec' | 'lowsec' | 'nullsec'

export interface MiningReprocessFacility {
  hull: MiningReprocessHull
  rig: MiningReprocessRig
  space: MiningReprocessSpace
}

export const DEFAULT_MINING_REPROCESS_FACILITY: MiningReprocessFacility = {
  hull: 'npc',
  rig: 'none',
  space: 'highsec',
}

export type MiningShipId =
  | 'retriever'
  | 'covetor'
  | 'procurer'
  | 'hulk'
  | 'mackinaw'
  | 'skiff'
  | 'venture'
  | 'prospect'
  | 'endurance'

/** Strip Miner I / Ice Harvester I / modulated guns / MDCSM II. */
export type MiningMinerModuleId = 'strip' | 'modulated' | 'deepCore'

/** One hull type and how many identical ships in a mixed mining fleet. */
export interface MiningFleetLine {
  shipId: MiningShipId
  count: number
  miner?: MiningMinerModuleId
  crystal?: MiningCrystalId
  upgrade?: MiningUpgradeId
  upgradeCount?: number
  surveyChipset?: MiningSurveyChipsetId
  buffIds?: MiningBuffId[]
}

export type MiningBuffId =
  | 'mlu3'
  | 'highwall'
  | 'yeti'
  | 'gasHarvesting'
  | 'porpoiseBoost'
  | 'orcaBoost'
  | 'rorqualBoost'
  | 'mindlink'

/** Fleet boost context: solo = no foreman ship. */
export type MiningBoostSpace = 'solo' | MiningSpaceClass

export type MiningBoosterHullId = 'porpoise' | 'orca' | 'rorqual'
export type MiningBurstTech = 't1' | 't2'
export type MiningUpgradeId = 'none' | 'mlu1' | 'mlu2'
/** Mid-slot survey chipset on mining barges and exhumers. */
export type MiningSurveyChipsetId = 'none' | 'msc1' | 'msc2'
/** Mining crystal letter (A/B/C) and tech tier (I/II). Legacy saves may still use t1/t2 (= Type A). */
export type MiningCrystalId = 'none' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'

/** Mining Foreman Command Burst charges (yield-related and common alternatives). */
export type MiningForemanBurstId =
  | 'miningLaserOptimization'
  | 'miningLaserEfficiency'
  | 'miningLaserFieldEnhancement'
  | 'miningEquipmentPreservation'

export interface MiningReprocessMat {
  typeId: number
  quantityPerBatch: number
}

export interface MiningItem {
  typeId: number
  name: string
  group: string
  volume: number
  portionSize: number
  subtype: MiningSubtype
  foundIn: MiningSpaceClass[]
  compressedTypeId: number | null
  reprocess: MiningReprocessMat[]
  iconUrl: string
}

export interface MiningFocusOutput {
  typeId: number
  name: string
}

export interface MiningData {
  generatedAt: string
  defaults: {
    m3PerHr: number
    m3PerHrBySubtype?: Partial<Record<MiningSubtype, number>>
    reprocessYield: number
  }
  focusOutputs: Record<MiningSubtype, MiningFocusOutput[]>
  items: MiningItem[]
}

export type MiningIphSortKey = 'compressed' | 'minerals' | 'focus' | 'vol'

export interface MiningReprocessLine {
  typeId: number
  name: string
  qtyPerM3: number
  price: number
  iskPerHr: number
}

export interface MiningRankedRow {
  item: MiningItem
  rawPrice: number
  compressedPrice: number | null
  rawValuePerM3: number
  compressedValuePerM3: number | null
  mineralsValuePerM3: number
  rawIph: number
  compressedIph: number | null
  mineralsIph: number
  focusIph: number | null
  /** Focused reprocess output units per hour (null when no material focus). */
  focusQtyPerHr: number | null
  focusTypeId: number | null
  /** Hub liquidity volume (max of raw vs compressed when applicable). */
  volDay: number
  volDayRaw?: number
  volDayCompressed?: number
  volDayMinerals?: number
  volDayFocus?: number
  /** Effective reprocess yield for this ore (NPC base × skills). */
  reprocessYield: number
  reprocessLines: MiningReprocessLine[]
}
