/**
 * Build gateIntel.json: stargate location IDs + smartbomb / HIC / dictor type IDs.
 */

const STARGATE_GROUP_ID = '10'
const SMART_BOMB_GROUP_ID = '72'
const INTERDICTOR_GROUP_ID = '541'
const HIC_GROUP_ID = '894'

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildGateIntelData({ invTypes, mapDenormalize }) {
  const smartBombTypeIds = []
  const interdictorTypeIds = []
  const hicTypeIds = []

  for (const type of invTypes) {
    if (type.published !== '1') continue
    const typeId = num(type.typeID)
    if (!typeId) continue
    switch (type.groupID) {
      case SMART_BOMB_GROUP_ID:
        smartBombTypeIds.push(typeId)
        break
      case INTERDICTOR_GROUP_ID:
        interdictorTypeIds.push(typeId)
        break
      case HIC_GROUP_ID:
        hicTypeIds.push(typeId)
        break
      default:
        break
    }
  }

  const gatesByLocationId = {}
  for (const row of mapDenormalize) {
    if (row.groupID !== STARGATE_GROUP_ID) continue
    const locationId = num(row.itemID)
    const systemId = num(row.solarSystemID)
    if (!locationId || !systemId) continue
    const name = String(row.itemName ?? '').trim() || `Gate ${locationId}`
    gatesByLocationId[String(locationId)] = { systemId, name }
  }

  return {
    generatedAt: new Date().toISOString(),
    smartBombTypeIds: smartBombTypeIds.sort((a, b) => a - b),
    interdictorTypeIds: interdictorTypeIds.sort((a, b) => a - b),
    hicTypeIds: hicTypeIds.sort((a, b) => a - b),
    gatesByLocationId,
  }
}
