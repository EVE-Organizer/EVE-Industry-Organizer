export type HubId = 'jita' | 'amarr' | 'dodixie' | 'rens' | 'hek' | 'ympwl'

export const MAX_ME = 10
export const MAX_TE = 20
export const MIN_BATCH_SIZE = 10
export const MAX_BATCH_SIZE = 500
export const BATCH_SIZE_STEP = 10
export const DEFAULT_BATCH_SIZE = 100

export type BlueprintTier = 't1' | 't2' | 'faction'

export const BLUEPRINT_TIERS: BlueprintTier[] = ['t1', 't2', 'faction']

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

/** Upwell engineering complex role bonuses (percent reduction). Tax is set per structure. */
export const STRUCTURE_PRESETS: Record<
  Exclude<StructureType, 'npc' | 'custom'>,
  { structureMeBonusPercent: number; structureTeBonusPercent: number; structureJobCostBonusPercent: number }
> = {
  raitaru: { structureMeBonusPercent: 1, structureTeBonusPercent: 15, structureJobCostBonusPercent: 3 },
  azbel: { structureMeBonusPercent: 2, structureTeBonusPercent: 20, structureJobCostBonusPercent: 4 },
  sotiyo: { structureMeBonusPercent: 3, structureTeBonusPercent: 25, structureJobCostBonusPercent: 5 },
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
  /** Extra material reduction from structure role bonus (player structures only). */
  structureMeBonusPercent: number
  /** Extra job time reduction from structure role bonus (player structures only). */
  structureTeBonusPercent: number
  /** Job installation cost reduction from structure role bonus (player structures only). */
  structureJobCostBonusPercent: number
  /** Manufacturing tax charged by the structure owner (player structures only). */
  structureTaxPercent: number
  priceMethod: 'sell_orders' | 'buy_orders'
  /** Per product-category assumed BPO lifetime runs for T1 amortization. */
  blueprintLifetimeRunsByCategory: BpoLifetimeRunsByCategory
  /** Assumed level (0-5) for invention encryption + datacore skills, used to estimate T2 success chance. */
  inventionSkillLevel: number
  /** Include blueprint acquisition cost (amortized BPO / invention) in profit and budget. */
  includeBlueprintCost: boolean
  /** Assumed manufacturing and market skill levels used in profit and ranking calculations. */
  skills: SkillLevels
}

/** Global settings plus per-job run count for manufacturing cost and profit math. */
export type ManufacturingSettings = GlobalSettings & { batchSize: number }

export interface SkillLevels {
  industry: number
  advancedIndustry: number
  science: number
  accounting: number
  brokerRelations: number
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

export interface UserData {
  schemaVersion: number
  updatedAt: string
  settings: GlobalSettings
  watchlist: WatchlistItem[]
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
  systemCostIndex: number
  structureType: StructureType
  structureMeBonusPercent: number
  structureTeBonusPercent: number
  structureJobCostBonusPercent: number
  structureTaxPercent: number
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
  advancedIndustry: number
  batchSizeSetting: number
  productQuantity: number
  avgVolume: number
  volumeCapDays: number
  runs: number
  outputQty: number
  baseTimePerRunSeconds: number
  teTimeFactor: number
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
  systemCostIndex: number
  structureType: StructureType
  structureMeBonusPercent: number
  structureTeBonusPercent: number
  structureJobCostBonusPercent: number
  structureTaxPercent: number
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
  mode: 'buy' | 'build' | 'blueprint'
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
  brokerRelations: DEFAULT_SKILL_LEVEL,
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
  structureTaxPercent: 0,
  priceMethod: 'sell_orders',
  blueprintLifetimeRunsByCategory: { ...DEFAULT_BPO_LIFETIME_RUNS_BY_CATEGORY },
  inventionSkillLevel: 4,
  includeBlueprintCost: true,
  skills: { ...DEFAULT_SKILLS },
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
