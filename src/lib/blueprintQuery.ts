import type { BlueprintTier, GlobalSettings, HubId, RecipeKind, TimeRange } from '@/types'
import {
  BLUEPRINT_TIERS,
  DEFAULT_RANKING_TIME_HOURS,
  DEFAULT_RECIPE_KINDS,
  DEFAULT_SETTINGS,
  HUBS,
  MAX_RANKING_TIME_HOURS,
  MIN_RANKING_TIME_HOURS,
  RANKING_RECIPE_KINDS,
} from '@/types'
import type { BlueprintSortKey, SortDirection } from '@/lib/ranking'
import {
  defaultMinSetupCost,
  defaultMaxSetupCost,
  setupBudgetToSlider,
  SETUP_BUDGET_SLIDER_STEPS,
} from '@/lib/ranking'

export interface BlueprintQuery {
  hub: HubId
  mfgSystem: number
  tiers: BlueprintTier[]
  /** Empty = all product groups. Non-empty = only these groups. */
  groups: string[]
  window: TimeRange
  priceMethod: GlobalSettings['priceMethod']
  budgetMinSlider: number
  budgetMaxSlider: number
  buildableOnly: boolean
  /**
   * Hide T1 blueprints with no market BPO and no public BPC at the selected hub or Jita.
   * Also covers charges (e.g. Condenser Packs) that skip blueprint cost but still have no listing.
   */
  requireBlueprintPrice: boolean
  /** Manufacturing BPOs and/or reaction formulas to rank. Default: both. */
  recipeKinds: RecipeKind[]
  includeHaul: boolean
  /** Minimum average daily hub volume (0 = no filter). Uses the selected price window. */
  minVolume: number
  /** Target total job time (hours) for profit and cost; runs sync per blueprint. */
  rankingTimeHours: number
  sortBy: BlueprintSortKey
  sortDir: SortDirection
}

const VALID_TIERS = new Set<string>(BLUEPRINT_TIERS)
const VALID_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']
const VALID_PRICE_METHODS: GlobalSettings['priceMethod'][] = ['sell_orders', 'buy_orders']
const VALID_SORT_KEYS: BlueprintSortKey[] = ['setupCost', 'netProfit', 'iph', 'margin', 'avgVolume']
const VALID_SORT_DIRS: SortDirection[] = ['asc', 'desc']
const VALID_HUBS: HubId[] = HUBS.map((hub) => hub.id)

const VALID_RECIPE_KINDS = new Set<string>(RANKING_RECIPE_KINDS)

export const RECIPE_KIND_LABELS: Record<RecipeKind, string> = {
  manufacturing: 'Blueprints',
  reaction: 'Formulas',
}

export function recipeKindsEqual(a: RecipeKind[], b: RecipeKind[]): boolean {
  if (a.length !== b.length) return false
  const sorted = (kinds: RecipeKind[]) => [...kinds].sort().join(',')
  return sorted(a) === sorted(b)
}

export function defaultQuery(settings: GlobalSettings): BlueprintQuery {
  return {
    hub: settings.primaryHub,
    mfgSystem: settings.manufacturingSystemId,
    tiers: ['t1'],
    groups: [],
    window: settings.priceWindow ?? DEFAULT_SETTINGS.priceWindow,
    priceMethod: settings.priceMethod,
    budgetMinSlider: setupBudgetToSlider(defaultMinSetupCost()),
    budgetMaxSlider: setupBudgetToSlider(defaultMaxSetupCost()),
    buildableOnly: false,
    requireBlueprintPrice: true,
    recipeKinds: [...DEFAULT_RECIPE_KINDS],
    includeHaul: settings.includeHaulCost ?? true,
    minVolume: 0,
    rankingTimeHours: DEFAULT_RANKING_TIME_HOURS,
    sortBy: 'iph',
    sortDir: 'desc',
  }
}

/** Serializes a query to URLSearchParams, omitting values that match the settings-derived defaults. */
export function queryToSearchParams(q: BlueprintQuery, settings: GlobalSettings): URLSearchParams {
  const def = defaultQuery(settings)
  const p = new URLSearchParams()

  if (q.hub !== def.hub) p.set('hub', q.hub)
  if (q.mfgSystem !== def.mfgSystem) p.set('sys', String(q.mfgSystem))
  if (!tiersEqual(q.tiers, def.tiers)) p.set('tier', q.tiers.join(','))
  if (!groupsEqual(q.groups, def.groups)) p.set('group', q.groups.join(','))
  if (q.window !== def.window) p.set('win', q.window)
  if (q.priceMethod !== def.priceMethod) p.set('price', q.priceMethod)
  if (q.budgetMinSlider !== def.budgetMinSlider) p.set('bmin', String(q.budgetMinSlider))
  if (q.budgetMaxSlider !== def.budgetMaxSlider) p.set('bmax', String(q.budgetMaxSlider))
  if (q.buildableOnly !== def.buildableOnly) p.set('buildable', '1')
  if (q.requireBlueprintPrice !== def.requireBlueprintPrice) {
    p.set('bpprice', q.requireBlueprintPrice ? '1' : '0')
  }
  if (!recipeKindsEqual(q.recipeKinds, def.recipeKinds)) {
    p.set('recipe', q.recipeKinds.join(','))
  }
  if (q.includeHaul !== def.includeHaul) p.set('haul', q.includeHaul ? '1' : '0')
  if (q.minVolume !== def.minVolume) p.set('vmin', String(q.minVolume))
  if (q.rankingTimeHours !== def.rankingTimeHours) p.set('time', String(q.rankingTimeHours))
  if (q.sortBy !== def.sortBy) p.set('sort', q.sortBy)
  if (q.sortDir !== def.sortDir) p.set('dir', q.sortDir)

  return p
}

/** Parses URLSearchParams into a BlueprintQuery, validating each value and falling back to defaults. */
export function searchParamsToQuery(
  params: URLSearchParams,
  settings: GlobalSettings,
): BlueprintQuery {
  const def = defaultQuery(settings)

  const rawHub = params.get('hub')
  const hub = rawHub && (VALID_HUBS as string[]).includes(rawHub) ? (rawHub as HubId) : def.hub

  const rawSys = params.get('sys')
  const mfgSystem = rawSys ? (parseInt(rawSys, 10) || def.mfgSystem) : def.mfgSystem

  const rawTier = params.get('tier')
  const tiers = parseTiers(rawTier, def.tiers)

  const groups = parseGroups(params.get('group'), def.groups)

  const rawWin = params.get('win')
  const window =
    rawWin && (VALID_WINDOWS as string[]).includes(rawWin) ? (rawWin as TimeRange) : def.window

  const rawPrice = params.get('price')
  const priceMethod =
    rawPrice && (VALID_PRICE_METHODS as string[]).includes(rawPrice)
      ? (rawPrice as GlobalSettings['priceMethod'])
      : def.priceMethod

  const rawBmin = params.get('bmin')
  const budgetMinSlider = rawBmin
    ? clampSlider(parseInt(rawBmin, 10))
    : def.budgetMinSlider

  const rawBmax = params.get('bmax')
  const budgetMaxSlider = rawBmax
    ? clampSlider(parseInt(rawBmax, 10))
    : def.budgetMaxSlider

  const buildableOnly = params.get('buildable') === '1'

  const rawBpPrice = params.get('bpprice')
  const requireBlueprintPrice =
    rawBpPrice === null ? def.requireBlueprintPrice : rawBpPrice === '1'

  const rawRecipe = params.get('recipe')
  const rawFormulas = params.get('formulas')
  let recipeKinds = parseRecipeKinds(rawRecipe, def.recipeKinds)
  if (rawFormulas === '0' && rawRecipe === null) {
    recipeKinds = ['manufacturing']
  }

  const rawHaul = params.get('haul')
  const includeHaul = rawHaul === null ? def.includeHaul : rawHaul === '1'

  const rawVmin = params.get('vmin')
  const minVolume = rawVmin ? clampMinVolume(parseFloat(rawVmin)) : def.minVolume

  const rawTime = params.get('time')
  const rankingTimeHours = rawTime
    ? clampRankingTimeHours(parseFloat(rawTime))
    : def.rankingTimeHours

  const rawSort = params.get('sort')
  const sortBy =
    rawSort && (VALID_SORT_KEYS as string[]).includes(rawSort)
      ? (rawSort as BlueprintSortKey)
      : def.sortBy

  const rawDir = params.get('dir')
  const sortDir =
    rawDir && (VALID_SORT_DIRS as string[]).includes(rawDir)
      ? (rawDir as SortDirection)
      : def.sortDir

  return {
    hub,
    mfgSystem,
    tiers,
    groups,
    window,
    priceMethod,
    budgetMinSlider,
    budgetMaxSlider,
    buildableOnly,
    requireBlueprintPrice,
    recipeKinds,
    includeHaul,
    minVolume,
    rankingTimeHours,
    sortBy,
    sortDir,
  }
}

export function formatGroupFilterSubtitle(groups: string[]): string {
  if (groups.length === 0) return ''
  if (groups.length === 1) return ` in ${groups[0]}`
  return ` in ${groups.length} groups`
}

function parseRecipeKinds(raw: string | null, fallback: RecipeKind[]): RecipeKind[] {
  if (raw === null) return fallback
  if (raw === '' || raw === 'all') return [...DEFAULT_RECIPE_KINDS]
  const parsed = [
    ...new Set(
      raw
        .split(',')
        .map((k) => k.trim())
        .filter((k): k is RecipeKind => VALID_RECIPE_KINDS.has(k)),
    ),
  ]
  return parsed.length > 0 ? parsed : fallback
}

function parseGroups(raw: string | null, fallback: string[]): string[] {
  if (raw === null) return fallback
  if (raw === '' || raw === 'all') return []
  return [...new Set(raw.split(',').map((g) => g.trim()).filter(Boolean))]
}

function groupsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sorted = (groups: string[]) => [...groups].sort().join(',')
  return sorted(a) === sorted(b)
}

function parseTiers(raw: string | null, fallback: BlueprintTier[]): BlueprintTier[] {
  if (raw === null) return fallback
  if (raw === '' || raw === 'all') return []
  const parsed = [
    ...new Set(
      raw
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is BlueprintTier => VALID_TIERS.has(t)),
    ),
  ]
  return parsed.length > 0 ? parsed : fallback
}

function tiersEqual(a: BlueprintTier[], b: BlueprintTier[]): boolean {
  if (a.length !== b.length) return false
  const sorted = (tiers: BlueprintTier[]) => [...tiers].sort().join(',')
  return sorted(a) === sorted(b)
}

/** Slider cap for min vol/day; typed values may exceed this. */
export const MAX_MIN_VOLUME_SLIDER = 100_000

export function clampMinVolume(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

export function clampRankingTimeHours(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RANKING_TIME_HOURS
  return Math.min(MAX_RANKING_TIME_HOURS, Math.max(MIN_RANKING_TIME_HOURS, value))
}

function clampSlider(value: number): number {
  if (isNaN(value)) return 0
  return Math.min(SETUP_BUDGET_SLIDER_STEPS, Math.max(0, Math.round(value)))
}
