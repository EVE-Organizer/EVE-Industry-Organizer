import type { BlueprintTier, GlobalSettings, HubId, TimeRange } from '@/types'
import {
  BATCH_SIZE_STEP,
  BLUEPRINT_TIERS,
  DEFAULT_BATCH_SIZE,
  HUBS,
  MAX_BATCH_SIZE,
  MIN_BATCH_SIZE,
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
  includeHaul: boolean
  /** Minimum average daily hub volume (0 = no filter). Volume window may differ from price window. */
  minVolume: number
  /** Manufacturing runs per job for profit and cost calculations on this page. */
  batchSize: number
  sortBy: BlueprintSortKey
  sortDir: SortDirection
}

const VALID_TIERS = new Set<string>(BLUEPRINT_TIERS)
const VALID_WINDOWS: TimeRange[] = ['1d', '1w', '1m', '1y', 'all']
const VALID_PRICE_METHODS: GlobalSettings['priceMethod'][] = ['sell_orders', 'buy_orders']
const VALID_SORT_KEYS: BlueprintSortKey[] = ['setupCost', 'netProfit', 'iph', 'margin', 'avgVolume']
const VALID_SORT_DIRS: SortDirection[] = ['asc', 'desc']
const VALID_HUBS: HubId[] = HUBS.map((hub) => hub.id)

export function defaultQuery(settings: GlobalSettings): BlueprintQuery {
  return {
    hub: settings.primaryHub,
    mfgSystem: settings.manufacturingSystemId,
    tiers: ['t1'],
    groups: [],
    window: '1w',
    priceMethod: settings.priceMethod,
    budgetMinSlider: setupBudgetToSlider(defaultMinSetupCost()),
    budgetMaxSlider: setupBudgetToSlider(defaultMaxSetupCost()),
    buildableOnly: false,
    includeHaul: true,
    minVolume: 100,
    batchSize: DEFAULT_BATCH_SIZE,
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
  if (q.includeHaul !== def.includeHaul) p.set('haul', q.includeHaul ? '1' : '0')
  if (q.minVolume !== def.minVolume) p.set('vmin', String(q.minVolume))
  if (q.batchSize !== def.batchSize) p.set('batch', String(q.batchSize))
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

  const rawHaul = params.get('haul')
  const includeHaul = rawHaul === null ? def.includeHaul : rawHaul === '1'

  const rawVmin = params.get('vmin')
  const minVolume = rawVmin ? clampMinVolume(parseFloat(rawVmin)) : def.minVolume

  const rawBatch = params.get('batch')
  const batchSize = rawBatch ? clampBatchSize(parseInt(rawBatch, 10)) : def.batchSize

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
    includeHaul,
    minVolume,
    batchSize,
    sortBy,
    sortDir,
  }
}

export function formatGroupFilterSubtitle(groups: string[]): string {
  if (groups.length === 0) return ''
  if (groups.length === 1) return ` in ${groups[0]}`
  return ` in ${groups.length} groups`
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

function clampMinVolume(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

function clampBatchSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE
  const stepped = Math.round(value / BATCH_SIZE_STEP) * BATCH_SIZE_STEP
  return Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, stepped))
}

function clampSlider(value: number): number {
  if (isNaN(value)) return 0
  return Math.min(SETUP_BUDGET_SLIDER_STEPS, Math.max(0, Math.round(value)))
}
