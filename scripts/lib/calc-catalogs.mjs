/**
 * Compact SDE catalogs for cost / facility / skill math.
 * Named fields only — no raw dogma maps.
 */
import { typeIconUrl } from './eve-image-urls.mjs'
import { buildAttributesByType } from './blueprint-groups.mjs'
import { buildAllTypeRecords } from './type-records.mjs'

export const SKILL_FIELD_IDS = [
  3380, 3388, 3387, 24625, 45748, 45749, 45746, 3402, 3406, 24624, 3395, 3397, 3398, 3396, 77725,
  3400, 22242, 26224, 11444, 11454, 11450, 11445, 52307, 81050, 11448, 11453, 11446, 11433, 11443,
  11447, 11452, 11529, 11442, 11451, 11441, 11455, 11449, 11487, 81896, 23087, 21790, 23121, 21791,
  3408, 52308, 55025, 16622, 3443, 16597, 3386, 3410, 16281, 25544, 17940, 22551, 29637, 28374,
  32918, 33856, 22536, 3385, 3389, 60377, 60378, 60379, 60380, 12189, 60381, 90040, 18025, 46152,
  46153, 46154, 46155, 46156,
]

const ATTR = {
  rank: 275,
  primary: 180,
  secondary: 181,
  prereqSkill: [182, 183, 184],
  prereqLevel: [277, 278, 279],
  manufacturingTimeBonus: 440,
  advancedIndustryJobTime: 1961,
  itemTypeManufactureTime: 1982,
  copySpeedBonus: 452,
  reactionTimeBonus: 2660,
  manufacturingSlots: 450,
  scienceSlots: 471,
  reactionSlots: 2661,
  strEngMat: 2600,
  strEngCost: 2601,
  strEngTime: 2602,
  strReactionTime: 2721,
  rigSize: 1547,
  metaLevel: 422,
  engRigTe: 2593,
  engRigMe: 2594,
  engRigCost: 2595,
  rxnRigTe: 2713,
  rxnRigMe: 2714,
}

const ATTR_TO_KEY = {
  164: 'charisma',
  165: 'intelligence',
  166: 'memory',
  167: 'perception',
  168: 'willpower',
}

const INDUSTRY_ACTIVITIES = new Set(['1', '5', '8', '11'])
const ENG_COMPLEX_GROUP = 'Engineering Complex'
const REFINERY_GROUP = 'Refinery'
const RIG_SIZE = { 2: 'm', 3: 'l', 4: 'xl' }

const EXCLUDE_RE =
  /event|\blimited\b|festival|holiday|special edition|\bskins?\b|apparel|\blegacy\b|limited time/i

const SKILL_FIELD_ID_SET = new Set(SKILL_FIELD_IDS)

/** Industry 4% / Advanced Industry 3% live on dogma effects; used only when attrs are missing. */
export const EFFECT_TIME_BONUS = { 3380: 0.04, 3388: 0.03 }

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dogmaValue(attrs, attributeId) {
  const row = attrs.get(String(attributeId)) ?? attrs.get(attributeId)
  return num(row?.valueFloat || row?.valueInt)
}

export function isExcludedCatalogText(...parts) {
  return parts.some((part) => part && EXCLUDE_RE.test(part))
}

/** Dogma multiplier 0.85 → 15 percent reduction. */
export function percentFromMultiplier(multiplier) {
  if (!(multiplier > 0) || multiplier >= 1) return 0
  return Math.round((1 - multiplier) * 1000) / 10
}

/** Dogma percent attr −2 / −20 → 2 / 20. */
export function percentFromAttr(value) {
  if (!value) return 0
  return Math.abs(value)
}

/** Dogma percent attr −4 → 0.04 fraction for cost.ts. */
export function fractionFromPercentAttr(value) {
  if (!value) return 0
  return Math.abs(value) / 100
}

function manufacturingFamiliesFromName(name) {
  if (/blueprint copy|invention|me research|te research|laboratory optimization/i.test(name)) {
    return []
  }
  if (/equipment and consumable manufacturing/i.test(name)) return ['ammo', 'drones', 'equipment']
  if (/structure and component manufacturing/i.test(name)) {
    return ['components_t2', 'components_capital', 'structures']
  }
  if (/advanced component manufacturing/i.test(name)) return ['components_t2']
  if (/basic capital component manufacturing/i.test(name)) return ['components_capital']
  if (/structure manufacturing/i.test(name)) return ['structures']
  if (/equipment manufacturing/i.test(name)) return ['equipment']
  if (/ammunition manufacturing|ammunition efficiency|ammunition me|ammunition te/i.test(name)) {
    return ['ammo']
  }
  if (/drone and fighter/i.test(name)) return ['drones']
  if (/advanced small ship/i.test(name)) return ['ships_t2_small']
  if (/advanced medium ship/i.test(name)) return ['ships_t2_medium']
  if (/advanced large ship/i.test(name)) return ['ships_t2_large']
  if (/basic small ship/i.test(name)) return ['ships_t1_small']
  if (/basic medium ship/i.test(name)) return ['ships_t1_medium']
  if (/basic large ship/i.test(name)) return ['ships_t1_large']
  if (/capital ship/i.test(name)) return ['ships_capital']
  if (/ship manufacturing|ship efficiency/i.test(name)) {
    return [
      'ships_t1_small',
      'ships_t1_medium',
      'ships_t1_large',
      'ships_t2_small',
      'ships_t2_medium',
      'ships_t2_large',
      'ships_capital',
    ]
  }
  return []
}

function reactionFamiliesFromName(name) {
  if (/biochemical/i.test(name)) return ['biochemical']
  if (/hybrid/i.test(name)) return ['hybrid']
  if (/composite|reactor efficiency/i.test(name)) return ['composite', 'biochemical', 'hybrid']
  return []
}

function rigActivity(name) {
  if (/reactor/i.test(name)) return 'reaction'
  if (/blueprint copy/i.test(name)) return 'copy'
  if (/invention/i.test(name)) return 'invention'
  if (/laboratory optimization/i.test(name)) return 'copy'
  if (/manufacturing/i.test(name)) return 'manufacturing'
  return null
}

function rigSizeFromName(name) {
  if (/xl-set/i.test(name)) return 'xl'
  if (/l-set/i.test(name)) return 'l'
  if (/m-set/i.test(name)) return 'm'
  return null
}

export function collectRecipeTypeIds(blueprints) {
  const ids = new Set()
  const blueprintTypeIds = []
  for (const bp of blueprints) {
    ids.add(bp.productTypeId)
    if (bp.blueprintTypeId != null) {
      ids.add(bp.blueprintTypeId)
      blueprintTypeIds.push(bp.blueprintTypeId)
    }
    for (const material of bp.materials ?? []) ids.add(material.typeId)
  }
  return { ids, blueprintTypeIds }
}

export function collectUsedSkillIds({ activitySkills, attrsByType, extraIds = SKILL_FIELD_IDS }) {
  const ids = new Set(extraIds)
  for (const row of activitySkills ?? []) {
    if (!INDUSTRY_ACTIVITIES.has(String(row.activityID))) continue
    const skillId = num(row.skillID)
    if (skillId > 0) ids.add(skillId)
  }

  const pending = [...ids]
  while (pending.length) {
    const skillId = pending.pop()
    const attrs = attrsByType.get(String(skillId)) ?? attrsByType.get(skillId)
    if (!attrs) continue
    for (let i = 0; i < 3; i++) {
      const prereqId = dogmaValue(attrs, ATTR.prereqSkill[i])
      if (prereqId > 0 && !ids.has(prereqId)) {
        ids.add(prereqId)
        pending.push(prereqId)
      }
    }
  }
  return ids
}

function skillCalcFields(skillId, attrs) {
  const itemType = fractionFromPercentAttr(dogmaValue(attrs, ATTR.itemTypeManufactureTime))
  const industry = fractionFromPercentAttr(dogmaValue(attrs, ATTR.manufacturingTimeBonus))
  const advanced = fractionFromPercentAttr(dogmaValue(attrs, ATTR.advancedIndustryJobTime))
  const manufacturingTimeBonusPerLevel =
    itemType || industry || advanced || EFFECT_TIME_BONUS[skillId] || 0
  const copyTimeBonusPerLevel = fractionFromPercentAttr(dogmaValue(attrs, ATTR.copySpeedBonus))
  const reactionTimeBonusPerLevel = fractionFromPercentAttr(
    dogmaValue(attrs, ATTR.reactionTimeBonus),
  )
  const extraJobSlotsPerLevel = dogmaValue(attrs, ATTR.manufacturingSlots)
  const extraScienceJobSlotsPerLevel = dogmaValue(attrs, ATTR.scienceSlots)
  const extraReactionJobSlotsPerLevel = dogmaValue(attrs, ATTR.reactionSlots)

  return {
    ...(manufacturingTimeBonusPerLevel ? { manufacturingTimeBonusPerLevel } : {}),
    ...(copyTimeBonusPerLevel ? { copyTimeBonusPerLevel } : {}),
    ...(reactionTimeBonusPerLevel ? { reactionTimeBonusPerLevel } : {}),
    ...(extraJobSlotsPerLevel ? { extraJobSlotsPerLevel } : {}),
    ...(extraScienceJobSlotsPerLevel ? { extraScienceJobSlotsPerLevel } : {}),
    ...(extraReactionJobSlotsPerLevel ? { extraReactionJobSlotsPerLevel } : {}),
  }
}

export function buildSkillRecords(types, groups, typeAttributes, options = {}) {
  const skillGroupIds = new Set(
    groups.filter((group) => group.categoryID === '16').map((group) => group.groupID),
  )
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const attrsByType = buildAttributesByType(typeAttributes)
  const extraIds = [
    ...(options.skillFieldIds ?? SKILL_FIELD_IDS),
    ...(options.fittingSkillIds ?? []),
  ]
  const usedIds = collectUsedSkillIds({
    activitySkills: options.activitySkills,
    attrsByType,
    extraIds,
  })

  return types
    .filter((type) => skillGroupIds.has(type.groupID) && type.published === '1')
    .filter((type) => {
      const skillId = num(type.typeID)
      if (!usedIds.has(skillId)) return false
      if (SKILL_FIELD_ID_SET.has(skillId)) return true
      const groupName = groupById.get(type.groupID)?.groupName ?? ''
      return !isExcludedCatalogText(type.typeName, groupName)
    })
    .map((type) => {
      const skillId = num(type.typeID)
      const attrs =
        attrsByType.get(type.typeID) ??
        attrsByType.get(String(skillId)) ??
        attrsByType.get(skillId) ??
        new Map()
      const rank = dogmaValue(attrs, ATTR.rank) || 1
      const primaryAttribute = ATTR_TO_KEY[dogmaValue(attrs, ATTR.primary)]
      const secondaryAttribute = ATTR_TO_KEY[dogmaValue(attrs, ATTR.secondary)]
      const prerequisites = []
      for (let i = 0; i < 3; i++) {
        const prereqSkillId = dogmaValue(attrs, ATTR.prereqSkill[i])
        const level = dogmaValue(attrs, ATTR.prereqLevel[i])
        if (prereqSkillId > 0 && level > 0) prerequisites.push({ skillId: prereqSkillId, level })
      }
      return {
        skillId,
        name: type.typeName,
        rank,
        prerequisites,
        ...(primaryAttribute ? { primaryAttribute } : {}),
        ...(secondaryAttribute ? { secondaryAttribute } : {}),
        iconUrl: typeIconUrl(skillId),
        ...skillCalcFields(skillId, attrs),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function buildCalcTypeRecords(types, groupById, categoryById, blueprints) {
  const { ids, blueprintTypeIds } = collectRecipeTypeIds(blueprints)
  return buildAllTypeRecords(types, groupById, categoryById, blueprintTypeIds, {
    onlyIds: ids,
  }).filter((row) => !isExcludedCatalogText(row.name, row.group, row.category))
}

function hullKind(groupName) {
  if (groupName === ENG_COMPLEX_GROUP) return 'engineering'
  if (groupName === REFINERY_GROUP) return 'refinery'
  return null
}

function buildHull(type, groupName, attrs) {
  const kind = hullKind(groupName)
  if (!kind) return null
  const size = RIG_SIZE[dogmaValue(attrs, ATTR.rigSize)]
  if (!size) return null
  const roleBonuses =
    kind === 'refinery'
      ? {
          me: 0,
          te: percentFromMultiplier(dogmaValue(attrs, ATTR.strReactionTime)),
          jobCost: 0,
        }
      : {
          me: percentFromMultiplier(dogmaValue(attrs, ATTR.strEngMat)),
          te: percentFromMultiplier(dogmaValue(attrs, ATTR.strEngTime)),
          jobCost: percentFromMultiplier(dogmaValue(attrs, ATTR.strEngCost)),
        }
  return {
    typeId: num(type.typeID),
    name: type.typeName,
    kind,
    size,
    roleBonuses,
  }
}

function buildRig(type, groupName, attrs) {
  if (!/standup /i.test(type.typeName) || !/rig/i.test(groupName)) return null
  const activity = rigActivity(type.typeName)
  if (!activity) return null
  const size = rigSizeFromName(type.typeName) ?? RIG_SIZE[dogmaValue(attrs, ATTR.rigSize)]
  if (!size) return null
  const meta = dogmaValue(attrs, ATTR.metaLevel)
  const tier = meta >= 2 || / II$/.test(type.typeName) ? 't2' : 't1'
  const me = percentFromAttr(dogmaValue(attrs, ATTR.engRigMe) || dogmaValue(attrs, ATTR.rxnRigMe))
  const te = percentFromAttr(dogmaValue(attrs, ATTR.engRigTe) || dogmaValue(attrs, ATTR.rxnRigTe))
  const jobCost = percentFromAttr(dogmaValue(attrs, ATTR.engRigCost))
  const families =
    activity === 'reaction'
      ? reactionFamiliesFromName(type.typeName)
      : manufacturingFamiliesFromName(type.typeName)
  return {
    typeId: num(type.typeID),
    name: type.typeName,
    size,
    tier,
    activity,
    families,
    me,
    te,
    jobCost,
  }
}

export function buildUpwellCatalog(types, groups, typeAttributes) {
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const attrsByType = buildAttributesByType(typeAttributes)
  const hulls = []
  const rigs = []

  for (const type of types) {
    if (type.published !== '1') continue
    const groupName = groupById.get(type.groupID)?.groupName ?? ''
    if (isExcludedCatalogText(type.typeName, groupName)) continue
    const attrs =
      attrsByType.get(type.typeID) ?? attrsByType.get(String(num(type.typeID))) ?? new Map()
    const hull = buildHull(type, groupName, attrs)
    if (hull) hulls.push(hull)
    const rig = buildRig(type, groupName, attrs)
    if (rig) rigs.push(rig)
  }

  hulls.sort((a, b) => a.typeId - b.typeId)
  rigs.sort((a, b) => a.typeId - b.typeId)
  return { hulls, rigs }
}
