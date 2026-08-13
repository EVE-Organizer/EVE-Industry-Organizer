/** Build compact fitting dogma for the fit-skills tool. */

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function attrNum(attrs, id) {
  const row = attrs?.get(String(id))
  if (!row) return 0
  return num(row.valueFloat || row.valueInt)
}

function requiredSkills(attrs) {
  const skills = []
  for (const [skillAttr, levelAttr] of [
    ['182', '277'],
    ['183', '278'],
    ['184', '279'],
  ]) {
    const skillId = attrNum(attrs, skillAttr)
    const level = attrNum(attrs, levelAttr)
    if (skillId > 0 && level > 0) skills.push({ skillId, level })
  }
  return skills
}

const ELECTRONICS_UPGRADES_ID = 3432

const TURRET_GROUPS = new Set(['Energy Weapon', 'Projectile Weapon', 'Hybrid Weapon', 'Precursor Weapon'])
const LAUNCHER_GROUPS = new Set([
  'Missile Launcher Rocket',
  'Missile Launcher Light',
  'Missile Launcher Rapid Light',
  'Missile Launcher Heavy Assault',
  'Missile Launcher Heavy',
  'Missile Launcher Rapid Heavy',
  'Missile Launcher Cruise',
  'Missile Launcher Torpedo',
  'Missile Launcher XL Cruise',
  'Missile Launcher XL Torpedo',
  'Missile Launcher Rapid Torpedo',
  'Missile Launcher Bomb',
  'Missile Launcher Defender',
])

function weaponKind(groupName) {
  if (TURRET_GROUPS.has(groupName)) return 'turret'
  if (LAUNCHER_GROUPS.has(groupName) || groupName.startsWith('Missile Launcher')) return 'launcher'
  if (groupName === 'Smart Bomb') return 'smartbomb'
  return undefined
}

function weaponFamily(groupName) {
  if (groupName === 'Energy Weapon' || groupName === 'Rig Energy Weapon') return 'energy'
  if (groupName === 'Projectile Weapon' || groupName === 'Rig Projectile Weapon') return 'projectile'
  if (groupName === 'Hybrid Weapon' || groupName === 'Rig Hybrid Weapon') return 'hybrid'
  if (groupName.startsWith('Missile Launcher') || groupName === 'Rig Launcher') return 'launcher'
  if (groupName === 'Armor Repairer') return 'armorRepair'
  return undefined
}

function rigDrawback(groupName, attrs) {
  const pct = attrNum(attrs, 1138)
  if (pct === 0) return undefined

  const family = weaponFamily(groupName)
  if (family === 'energy' || family === 'projectile' || family === 'hybrid' || family === 'launcher') {
    if (attrNum(attrs, 64) > 1) return { family, stat: 'cpu', pct }
    if (attrNum(attrs, 204) !== 0 || attrNum(attrs, 310) !== 0) return { family, stat: 'power', pct }
    return undefined
  }

  if (groupName === 'Rig Armor') {
    if (attrNum(attrs, 806) !== 0 || attrNum(attrs, 312) !== 0) {
      return { family: 'armorRepair', stat: 'power', pct }
    }
  }

  return undefined
}

export function buildFittingRecords(types, groups, categories, typeAttributes) {
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const categoryById = new Map(
    categories.map((category) => [category.categoryID, category.categoryName]),
  )
  const attrsByType = new Map()
  for (const row of typeAttributes) {
    if (!attrsByType.has(row.typeID)) attrsByType.set(row.typeID, new Map())
    attrsByType.get(row.typeID).set(row.attributeID, row)
  }

  const records = []
  for (const type of types) {
    if (type.published !== '1') continue
    const group = groupById.get(type.groupID)
    const category = categoryById.get(group?.categoryID ?? '') ?? 'Unknown'
    const groupName = group?.groupName ?? 'Unknown'
    const attrs = attrsByType.get(type.typeID)
    const cpu = attrNum(attrs, 50)
    const power = attrNum(attrs, 30)
    const cpuOutput = attrNum(attrs, 48)
    const powerOutput = attrNum(attrs, 11)
    const skills = requiredSkills(attrs)
    const drawback = rigDrawback(groupName, attrs)
    const kind = weaponKind(groupName)
    const family = weaponFamily(groupName)

    const isShip = category === 'Ship'
    const isModule = category === 'Module'
    const isCharge = category === 'Charge' && skills.length > 0
    const isDrone = category === 'Drone' && skills.length > 0
    if (!isShip && !isModule && !isCharge && !isDrone) continue

    const record = {
      typeId: num(type.typeID),
      name: type.typeName,
      group: groupName,
      category,
    }
    if (isShip) {
      record.cpuOutput = cpuOutput
      record.powerOutput = powerOutput
    } else {
      if (cpu) record.cpu = cpu
      if (power) record.power = power
    }
    if (skills.length) record.skills = skills
    if (kind) record.weapon = kind
    if (family) record.family = family
    if (drawback) record.rigDrawback = drawback
    if (skills.some((skill) => skill.skillId === ELECTRONICS_UPGRADES_ID)) {
      record.electronicsUpgrades = true
    }
    records.push(record)
  }

  return records.sort((a, b) => a.typeId - b.typeId)
}
