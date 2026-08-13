/** Compact ship/module dogma for the fit skill finder. */

export const FITTING_CATEGORIES = new Set([
  'Ship',
  'Module',
  'Charge',
  'Drone',
  'Subsystem',
  'Fighter',
  'Implant',
])

const ATTR = {
  // Live SDE/ESI: ships put PG/CPU output on 11/48; modules put usage on 30/50.
  pgOut: '11',
  pg: '30',
  cpuOut: '48',
  cpu: '50',
  cal: '1153',
  calOut: '1132',
  meta: '422',
  rigSize: '1547',
  skillPairs: [
    ['182', '277'],
    ['183', '278'],
    ['184', '279'],
    ['1285', '1286'],
    ['1289', '1287'],
    ['1290', '1288'],
  ],
}

const EFFECT_SLOT = {
  11: 'low',
  12: 'high',
  13: 'mid',
  2663: 'rig',
  3772: 'subsystem',
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function attrValue(attrs, attributeId) {
  const row = attrs.get(attributeId)
  if (!row) return 0
  return num(row.valueFloat || row.valueInt)
}

function slotFromCategory(category) {
  if (category === 'Ship') return 'ship'
  if (category === 'Charge') return 'charge'
  if (category === 'Drone' || category === 'Fighter') return 'drone'
  if (category === 'Subsystem') return 'subsystem'
  if (category === 'Implant') return 'implant'
  return 'module'
}

export function buildFittingRecords(typeAttributes, typeEffects, typeRecords) {
  const attrsByType = new Map()
  for (const row of typeAttributes) {
    if (!attrsByType.has(row.typeID)) attrsByType.set(row.typeID, new Map())
    attrsByType.get(row.typeID).set(row.attributeID, row)
  }

  const slotByType = new Map()
  for (const row of typeEffects) {
    const slot = EFFECT_SLOT[num(row.effectID)]
    if (!slot) continue
    slotByType.set(row.typeID, slot)
  }

  const items = {}
  for (const type of typeRecords) {
    if (!FITTING_CATEGORIES.has(type.category)) continue
    const typeKey = String(type.typeId)
    const attrs = attrsByType.get(typeKey) ?? attrsByType.get(type.typeId) ?? new Map()
    const pg = attrValue(attrs, ATTR.pg)
    const cpu = attrValue(attrs, ATTR.cpu)
    const pgOut = attrValue(attrs, ATTR.pgOut)
    const cpuOut = attrValue(attrs, ATTR.cpuOut)
    const cal = attrValue(attrs, ATTR.cal)
    const calOut = attrValue(attrs, ATTR.calOut)
    const meta = attrValue(attrs, ATTR.meta)
    const rigSize = attrValue(attrs, ATTR.rigSize)
    const skills = []
    for (const [skillAttr, levelAttr] of ATTR.skillPairs) {
      const skillId = attrValue(attrs, skillAttr)
      const level = attrValue(attrs, levelAttr)
      if (skillId > 0 && level > 0) skills.push([skillId, level])
    }

    const effectSlot = slotByType.get(typeKey) ?? slotByType.get(String(type.typeId))
    const slot = effectSlot ?? slotFromCategory(type.category)

    if (
      pg === 0 &&
      cpu === 0 &&
      pgOut === 0 &&
      cpuOut === 0 &&
      cal === 0 &&
      calOut === 0 &&
      meta === 0 &&
      rigSize === 0 &&
      skills.length === 0
    ) {
      if (slot === 'module' || slot === 'implant') continue
    }

    const record = { slot }
    if (pg > 0) record.pg = pg
    if (cpu > 0) record.cpu = cpu
    if (pgOut > 0) record.pgOut = pgOut
    if (cpuOut > 0) record.cpuOut = cpuOut
    if (cal > 0) record.cal = cal
    if (calOut > 0) record.calOut = calOut
    if (meta > 0) record.meta = meta
    if (rigSize > 0) record.rigSize = rigSize
    if (skills.length) record.skills = skills
    items[type.typeId] = record
  }

  return items
}
