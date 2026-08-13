import type { SkillInfo, TypeInfo } from '@/types'
import type { ParsedEftFit } from '@/lib/eftParse'
import { formatSkillLevel } from '@/lib/skillFields'

export type FitSlot = 'ship' | 'high' | 'mid' | 'low' | 'rig' | 'subsystem' | 'drone' | 'charge' | 'implant' | 'module'

export interface FittingItemRecord {
  slot: FitSlot
  pg?: number
  cpu?: number
  pgOut?: number
  cpuOut?: number
  cal?: number
  calOut?: number
  skills?: [number, number][]
}

export type FitRole = 'dps' | 'tank' | 'logi' | 'general'
export type FitGoal = 'fits' | 'flies'

export const FITTING_SKILL_IDS = {
  cpuManagement: 3426,
  powerGridManagement: 3413,
  weaponUpgrades: 3318,
  advancedWeaponUpgrades: 11207,
  shieldUpgrades: 3425,
  energyGridUpgrades: 3424,
  electronicsUpgrades: 3427,
} as const

const FITTING_SKILL_SET = new Set<number>(Object.values(FITTING_SKILL_IDS))

/** CCP rank-1 skillpoints to reach each level. */
const SP_AT_LEVEL = [0, 250, 1415, 8000, 45255, 256000]

/** ponytail: no attribute remap/implants; 30 SP/min is unmapped ~20/20. */
export const DEFAULT_SP_PER_MIN = 30

const WEAPON_GROUP_RE =
  /turret|launcher|smartbomb|missile|rocket|torpedo|railgun|blaster|pulse|beam|autocannon|artillery|precursor|disintegrator|energy weapon|hybrid weapon|projectile weapon/i

const DPS_SUPPORT_IDS = [3310, 3311, 3312, 3315, 3316, 3317, 20312, 12441, 12442, 20212, 20314, 21071]
const TANK_SUPPORT_IDS = [3416, 3419, 16069, 21802, 3394, 12365, 21059]
const LOGI_SUPPORT_IDS = [3421, 3422, 3423, 16069, 27902, 21803, 24568]

export interface FitPiece {
  name: string
  typeId: number | null
  slot: FitSlot | 'unknown'
  quantity: number
  pg: number
  cpu: number
  cal: number
  required: { skillId: number; level: number }[]
  enough: boolean
  missing: { skillId: number; name: string; need: number; have: number }[]
}

export interface ResourceCheck {
  used: number
  output: number
  ok: boolean
}

export interface SkillGapRow {
  skillId: number
  name: string
  need: number
  have: number
  enough: boolean
  kind: 'fit' | 'use' | 'fitting'
}

export interface TrainQueueItem {
  skillId: number
  name: string
  from: number
  to: number
  sp: number
  minutes: number
}

export interface FitSkillAnalysis {
  hullName: string
  fitName: string
  hullTypeId: number | null
  unresolved: string[]
  online: boolean
  pg: ResourceCheck
  cpu: ResourceCheck
  cal: ResourceCheck
  fittingLevels: Record<number, number>
  pieces: FitPiece[]
  fitSkills: SkillGapRow[]
  useSkills: SkillGapRow[]
  owned: FitPiece[]
  queueFits: TrainQueueItem[]
  queueFlies: TrainQueueItem[]
  queueFitsMinutes: number
  queueFliesMinutes: number
  budgetMinutes: number
  queueFitsWithinBudget: TrainQueueItem[]
  queueFliesWithinBudget: TrainQueueItem[]
}

export function buildTypeNameIndex(types: TypeInfo[]): Map<string, TypeInfo> {
  const map = new Map<string, TypeInfo>()
  for (const type of types) {
    map.set(type.name.toLowerCase(), type)
  }
  return map
}

export function esiLevelsFromSkills(
  skills: { skill_id: number; trained_skill_level: number }[] | undefined,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const skill of skills ?? []) {
    map.set(skill.skill_id, Math.min(5, Math.max(0, skill.trained_skill_level)))
  }
  return map
}

const LEVEL_TOKEN = /^(i|ii|iii|iv|v|[0-5])$/i

export function parsePastedSkillLevels(text: string, skills: SkillInfo[]): Map<number, number> {
  const byName = new Map(skills.map((s) => [s.name.toLowerCase(), s.skillId]))
  const levels = new Map<number, number>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const colon = line.match(/^(.+?)[:]\s*(\S+)\s*$/)
    const spaced = line.match(/^(.+?)\s+(\S+)\s*$/)
    const match = colon ?? spaced
    if (!match) continue
    const name = match[1]!.trim().toLowerCase()
    const level = parseSkillLevelToken(match[2]!)
    const skillId = byName.get(name)
    if (skillId == null || level == null) continue
    levels.set(skillId, level)
  }
  return levels
}

function parseSkillLevelToken(token: string): number | null {
  const t = token.trim().toLowerCase()
  if (!LEVEL_TOKEN.test(t)) return null
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 }
  if (t in roman) return roman[t]!
  const n = Number(t)
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : null
}

export function skillpointsToLevel(rank: number, level: number): number {
  const clamped = Math.min(5, Math.max(0, Math.floor(level)))
  return SP_AT_LEVEL[clamped]! * rank
}

export function skillpointsBetween(rank: number, from: number, to: number): number {
  return Math.max(0, skillpointsToLevel(rank, to) - skillpointsToLevel(rank, from))
}

export function formatTrainTime(minutes: number): string {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function groupOf(type: TypeInfo | undefined): string {
  return type?.group ?? ''
}

function isWeaponGroup(group: string): boolean {
  return WEAPON_GROUP_RE.test(group)
}

function requiresSkill(record: FittingItemRecord | undefined, skillId: number): boolean {
  return (record?.skills ?? []).some(([id]) => id === skillId)
}

function pgMult(record: FittingItemRecord, group: string, levels: Record<number, number>): number {
  let mult = 1
  if (isWeaponGroup(group)) {
    mult *= 1 - 0.02 * (levels[FITTING_SKILL_IDS.advancedWeaponUpgrades] ?? 0)
  }
  if (requiresSkill(record, FITTING_SKILL_IDS.shieldUpgrades)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.shieldUpgrades] ?? 0)
  }
  if (requiresSkill(record, FITTING_SKILL_IDS.energyGridUpgrades)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.energyGridUpgrades] ?? 0)
  }
  return mult
}

function cpuMult(record: FittingItemRecord, group: string, levels: Record<number, number>): number {
  let mult = 1
  if (isWeaponGroup(group)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.weaponUpgrades] ?? 0)
  }
  if (requiresSkill(record, FITTING_SKILL_IDS.electronicsUpgrades)) {
    mult *= 1 - 0.05 * (levels[FITTING_SKILL_IDS.electronicsUpgrades] ?? 0)
  }
  return mult
}

function shipOutput(base: number, bonusSkillLevel: number): number {
  return base * (1 + 0.05 * bonusSkillLevel)
}

function usedResources(
  pieces: { record: FittingItemRecord; group: string; quantity: number }[],
  levels: Record<number, number>,
): { pg: number; cpu: number; cal: number } {
  let pg = 0
  let cpu = 0
  let cal = 0
  for (const piece of pieces) {
    const slot = piece.record.slot
    if (slot === 'charge' || slot === 'drone' || slot === 'implant' || slot === 'ship') continue
    pg += (piece.record.pg ?? 0) * pgMult(piece.record, piece.group, levels)
    cpu += (piece.record.cpu ?? 0) * cpuMult(piece.record, piece.group, levels)
    cal += piece.record.cal ?? 0
  }
  return { pg, cpu, cal }
}

export function analyzeFit(options: {
  parsed: ParsedEftFit
  typesByName: Map<string, TypeInfo>
  fittingByTypeId: Map<number, FittingItemRecord>
  skills: SkillInfo[]
  characterLevels: Map<number, number>
  role: FitRole
  budgetDays: number
  spPerMin?: number
}): FitSkillAnalysis {
  const {
    parsed,
    typesByName,
    fittingByTypeId,
    skills,
    characterLevels,
    role,
    budgetDays,
  } = options
  const spPerMin = options.spPerMin ?? DEFAULT_SP_PER_MIN
  const skillById = new Map(skills.map((s) => [s.skillId, s]))
  const unresolved: string[] = [...parsed.unknown]

  function lookup(name: string): TypeInfo | undefined {
    return typesByName.get(name.toLowerCase())
  }

  const hullType = parsed.hullName ? lookup(parsed.hullName) : undefined
  if (parsed.hullName && !hullType) unresolved.push(parsed.hullName)
  const hullRecord = hullType ? fittingByTypeId.get(hullType.typeId) : undefined

  const modulePieces: { record: FittingItemRecord; group: string; quantity: number }[] = []
  const pieces: FitPiece[] = []

  function addPiece(name: string, quantity: number, fallbackSlot: FitSlot): void {
    const type = lookup(name)
    if (!type) {
      unresolved.push(name)
      pieces.push({
        name,
        typeId: null,
        slot: 'unknown',
        quantity,
        pg: 0,
        cpu: 0,
        cal: 0,
        required: [],
        enough: false,
        missing: [{ skillId: 0, name: 'Unknown type', need: 1, have: 0 }],
      })
      return
    }
    const record = fittingByTypeId.get(type.typeId) ?? { slot: fallbackSlot }
    const required = (record.skills ?? []).map(([skillId, level]) => ({ skillId, level }))
    const missing = required
      .filter((req) => (characterLevels.get(req.skillId) ?? 0) < req.level)
      .map((req) => ({
        skillId: req.skillId,
        name: skillById.get(req.skillId)?.name ?? `Skill ${req.skillId}`,
        need: req.level,
        have: characterLevels.get(req.skillId) ?? 0,
      }))
    pieces.push({
      name: type.name,
      typeId: type.typeId,
      slot: record.slot,
      quantity,
      pg: record.pg ?? 0,
      cpu: record.cpu ?? 0,
      cal: record.cal ?? 0,
      required,
      enough: missing.length === 0,
      missing,
    })
    if (record.slot !== 'charge') {
      modulePieces.push({ record, group: groupOf(type), quantity })
    }
  }

  if (hullType) addPiece(hullType.name, 1, 'ship')

  for (const line of parsed.lines) {
    if (line.emptySlot) continue
    addPiece(line.name, line.quantity, 'module')
    if (line.chargeName) addPiece(line.chargeName, line.quantity, 'charge')
  }

  const hasWeapons = modulePieces.some((p) => isWeaponGroup(p.group))
  const needWu = hasWeapons
  const needAwu = hasWeapons && modulePieces.some((p) => isWeaponGroup(p.group) && (p.record.pg ?? 0) > 0)
  const needShield = modulePieces.some((p) => requiresSkill(p.record, FITTING_SKILL_IDS.shieldUpgrades))
  const needEgu = modulePieces.some((p) => requiresSkill(p.record, FITTING_SKILL_IDS.energyGridUpgrades))
  const needEu = modulePieces.some((p) => requiresSkill(p.record, FITTING_SKILL_IDS.electronicsUpgrades))
  const needPg = modulePieces.some((p) => (p.record.pg ?? 0) > 0)
  const needCpu = modulePieces.some((p) => (p.record.cpu ?? 0) > 0)

  const currentFitting: Record<number, number> = {
    [FITTING_SKILL_IDS.powerGridManagement]: characterLevels.get(FITTING_SKILL_IDS.powerGridManagement) ?? 0,
    [FITTING_SKILL_IDS.cpuManagement]: characterLevels.get(FITTING_SKILL_IDS.cpuManagement) ?? 0,
    [FITTING_SKILL_IDS.weaponUpgrades]: characterLevels.get(FITTING_SKILL_IDS.weaponUpgrades) ?? 0,
    [FITTING_SKILL_IDS.advancedWeaponUpgrades]: characterLevels.get(FITTING_SKILL_IDS.advancedWeaponUpgrades) ?? 0,
    [FITTING_SKILL_IDS.shieldUpgrades]: characterLevels.get(FITTING_SKILL_IDS.shieldUpgrades) ?? 0,
    [FITTING_SKILL_IDS.energyGridUpgrades]: characterLevels.get(FITTING_SKILL_IDS.energyGridUpgrades) ?? 0,
    [FITTING_SKILL_IDS.electronicsUpgrades]: characterLevels.get(FITTING_SKILL_IDS.electronicsUpgrades) ?? 0,
  }

  const pgOutBase = hullRecord?.pgOut ?? 0
  const cpuOutBase = hullRecord?.cpuOut ?? 0
  const calOut = hullRecord?.calOut ?? 0

  function check(levels: Record<number, number>): { pg: ResourceCheck; cpu: ResourceCheck; cal: ResourceCheck; online: boolean } {
    const used = usedResources(modulePieces, levels)
    const pgOut = shipOutput(pgOutBase, levels[FITTING_SKILL_IDS.powerGridManagement] ?? 0)
    const cpuOut = shipOutput(cpuOutBase, levels[FITTING_SKILL_IDS.cpuManagement] ?? 0)
    const pg = { used: used.pg, output: pgOut, ok: used.pg <= pgOut + 1e-6 }
    const cpu = { used: used.cpu, output: cpuOut, ok: used.cpu <= cpuOut + 1e-6 }
    const cal = { used: used.cal, output: calOut, ok: calOut === 0 || used.cal <= calOut + 1e-6 }
    return { pg, cpu, cal, online: pg.ok && cpu.ok && cal.ok }
  }

  const fittingLevels = cheapestFittingLevels({
    current: currentFitting,
    needPg,
    needCpu,
    needWu,
    needAwu,
    needShield,
    needEgu,
    needEu,
    skillById,
    fits: (levels) => check(levels).online,
  })

  const withFitting = check(fittingLevels)
  const requiredFit = new Map<number, number>()
  const requiredUse = new Map<number, number>()

  for (const piece of pieces) {
    const isUse = piece.slot === 'charge' || piece.slot === 'drone'
    for (const req of piece.required) {
      const target = isUse ? requiredUse : requiredFit
      target.set(req.skillId, Math.max(target.get(req.skillId) ?? 0, req.level))
    }
  }

  for (const [skillId, level] of Object.entries(fittingLevels)) {
    const id = Number(skillId)
    if (level > (characterLevels.get(id) ?? 0)) {
      requiredFit.set(id, Math.max(requiredFit.get(id) ?? 0, level))
    }
  }

  const fitSkills = toGapRows(requiredFit, characterLevels, skillById, 'fit')
  const useSkills = toGapRows(requiredUse, characterLevels, skillById, 'use')

  const fliesNeed = new Map(requiredFit)
  for (const [id, level] of requiredUse) fliesNeed.set(id, Math.max(fliesNeed.get(id) ?? 0, level))
  for (const [id, level] of requiredFit) {
    if (!FITTING_SKILL_SET.has(id)) fliesNeed.set(id, Math.max(level, 5))
  }
  for (const extraId of extraSkillsForRole(role, pieces, modulePieces)) {
    fliesNeed.set(extraId, Math.max(fliesNeed.get(extraId) ?? 0, 4))
  }

  const queueFits = buildQueue(requiredFit, characterLevels, skillById, spPerMin)
  const queueFlies = buildQueue(fliesNeed, characterLevels, skillById, spPerMin)
  const budgetMinutes = Math.max(0, budgetDays) * 24 * 60

  return {
    hullName: hullType?.name ?? parsed.hullName,
    fitName: parsed.fitName,
    hullTypeId: hullType?.typeId ?? null,
    unresolved: [...new Set(unresolved)],
    online: withFitting.online,
    pg: withFitting.pg,
    cpu: withFitting.cpu,
    cal: withFitting.cal,
    fittingLevels,
    pieces,
    fitSkills,
    useSkills,
    owned: pieces,
    queueFits,
    queueFlies,
    queueFitsMinutes: queueFits.reduce((sum, item) => sum + item.minutes, 0),
    queueFliesMinutes: queueFlies.reduce((sum, item) => sum + item.minutes, 0),
    budgetMinutes,
    queueFitsWithinBudget: cutQueue(queueFits, budgetMinutes),
    queueFliesWithinBudget: cutQueue(queueFlies, budgetMinutes),
  }
}

function extraSkillsForRole(
  role: FitRole,
  pieces: FitPiece[],
  modulePieces: { group: string }[],
): number[] {
  if (role === 'general') return []
  const groups = modulePieces.map((p) => p.group).join(' ')
  const names = pieces.map((p) => p.name).join(' ')
  const hay = `${groups} ${names}`
  if (role === 'dps') return DPS_SUPPORT_IDS
  if (role === 'tank') {
    if (/shield/i.test(hay)) return TANK_SUPPORT_IDS
    if (/armor|plate|repairer/i.test(hay)) return TANK_SUPPORT_IDS
    return TANK_SUPPORT_IDS
  }
  if (role === 'logi') {
    if (/remote|logistics|capacitor emission/i.test(hay)) return LOGI_SUPPORT_IDS
    return LOGI_SUPPORT_IDS
  }
  return []
}

function toGapRows(
  needed: Map<number, number>,
  have: Map<number, number>,
  skillById: Map<number, SkillInfo>,
  kind: SkillGapRow['kind'],
): SkillGapRow[] {
  const rows: SkillGapRow[] = []
  for (const [skillId, need] of needed) {
    const trained = have.get(skillId) ?? 0
    rows.push({
      skillId,
      name: skillById.get(skillId)?.name ?? `Skill ${skillId}`,
      need,
      have: trained,
      enough: trained >= need,
      kind: FITTING_SKILL_SET.has(skillId) ? 'fitting' : kind,
    })
  }
  rows.sort((a, b) => Number(a.enough) - Number(b.enough) || a.name.localeCompare(b.name))
  return rows
}

function expandPrereqs(
  needed: Map<number, number>,
  skillById: Map<number, SkillInfo>,
): Map<number, number> {
  const out = new Map(needed)
  const stack = [...out.keys()]
  while (stack.length) {
    const skillId = stack.pop()!
    const info = skillById.get(skillId)
    if (!info) continue
    for (const req of info.prerequisites) {
      const prev = out.get(req.skillId) ?? 0
      if (req.level > prev) {
        out.set(req.skillId, req.level)
        stack.push(req.skillId)
      }
    }
  }
  return out
}

function buildQueue(
  needed: Map<number, number>,
  have: Map<number, number>,
  skillById: Map<number, SkillInfo>,
  spPerMin: number,
): TrainQueueItem[] {
  const full = expandPrereqs(needed, skillById)
  const remaining = new Map<number, number>()
  for (const [skillId, to] of full) {
    const from = have.get(skillId) ?? 0
    if (to > from) remaining.set(skillId, to)
  }

  const items: TrainQueueItem[] = []
  const trained = new Map(have)

  while (remaining.size) {
    const ready: number[] = []
    for (const skillId of remaining.keys()) {
      const info = skillById.get(skillId)
      const prereqs = info?.prerequisites ?? []
      if (prereqs.every((req) => (trained.get(req.skillId) ?? 0) >= req.level)) {
        ready.push(skillId)
      }
    }
    if (!ready.length) {
      ready.push([...remaining.keys()][0]!)
    }
    ready.sort((a, b) => (skillById.get(a)?.name ?? '').localeCompare(skillById.get(b)?.name ?? ''))
    const skillId = ready[0]!
    const to = remaining.get(skillId)!
    const from = trained.get(skillId) ?? 0
    const rank = skillById.get(skillId)?.rank ?? 1
    const sp = skillpointsBetween(rank, from, to)
    items.push({
      skillId,
      name: skillById.get(skillId)?.name ?? `Skill ${skillId}`,
      from,
      to,
      sp,
      minutes: sp / spPerMin,
    })
    trained.set(skillId, to)
    remaining.delete(skillId)
  }
  return items
}

function cutQueue(queue: TrainQueueItem[], budgetMinutes: number): TrainQueueItem[] {
  if (budgetMinutes <= 0) return []
  const out: TrainQueueItem[] = []
  let used = 0
  for (const item of queue) {
    if (used + item.minutes > budgetMinutes) break
    out.push(item)
    used += item.minutes
  }
  return out
}

function cheapestFittingLevels(options: {
  current: Record<number, number>
  needPg: boolean
  needCpu: boolean
  needWu: boolean
  needAwu: boolean
  needShield: boolean
  needEgu: boolean
  needEu: boolean
  skillById: Map<number, SkillInfo>
  fits: (levels: Record<number, number>) => boolean
}): Record<number, number> {
  const ids: number[] = []
  if (options.needPg) ids.push(FITTING_SKILL_IDS.powerGridManagement)
  if (options.needCpu) ids.push(FITTING_SKILL_IDS.cpuManagement)
  if (options.needWu) ids.push(FITTING_SKILL_IDS.weaponUpgrades)
  if (options.needAwu) ids.push(FITTING_SKILL_IDS.advancedWeaponUpgrades)
  if (options.needShield) ids.push(FITTING_SKILL_IDS.shieldUpgrades)
  if (options.needEgu) ids.push(FITTING_SKILL_IDS.energyGridUpgrades)
  if (options.needEu) ids.push(FITTING_SKILL_IDS.electronicsUpgrades)

  const start = { ...options.current }
  if (options.fits(start)) return start
  if (!ids.length) return start

  let best: Record<number, number> | null = null
  let bestSp = Infinity

  function rec(index: number, levels: Record<number, number>): void {
    if (index >= ids.length) {
      const wu = levels[FITTING_SKILL_IDS.weaponUpgrades] ?? 0
      const awu = levels[FITTING_SKILL_IDS.advancedWeaponUpgrades] ?? 0
      if (awu > 0 && wu < 4) return
      if (!options.fits(levels)) return
      let sp = 0
      for (const id of ids) {
        const rank = options.skillById.get(id)?.rank ?? 2
        sp += skillpointsBetween(rank, options.current[id] ?? 0, levels[id] ?? 0)
      }
      if (sp < bestSp) {
        bestSp = sp
        best = { ...levels }
      }
      return
    }
    const id = ids[index]!
    const from = options.current[id] ?? 0
    for (let level = from; level <= 5; level++) {
      rec(index + 1, { ...levels, [id]: level })
    }
  }

  rec(0, start)
  return best ?? { ...start, ...Object.fromEntries(ids.map((id) => [id, 5])) }
}

export function formatGapLevel(row: Pick<SkillGapRow, 'need' | 'have'>): string {
  return `${formatSkillLevel(row.have)} / ${formatSkillLevel(row.need)}`
}
