/**
 * Build compact galaxy map data (systems x/z + jump edges) for the /map page.
 * Positions use official SDE position2D (Modern/Catalyst 2D map layout).
 */

const NEW_EDEN_MIN = 30_000_000
const NEW_EDEN_MAX = 30_999_999

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * @param {Array<Record<string, unknown>>} records - mapSolarSystems.jsonl rows
 */
export function systemsFromSdeJsonl(records) {
  return records
    .map((raw) => {
      const systemId = num(raw._key)
      if (systemId < NEW_EDEN_MIN || systemId > NEW_EDEN_MAX) return null

      const pos = raw.position2D
      if (!pos || typeof pos !== 'object') return null
      const x = num(pos.x)
      const y = num(pos.y)
      if (x === 0 && y === 0) return null

      const nameField = raw.name
      const name =
        typeof nameField === 'object' && nameField !== null
          ? String(nameField.en ?? nameField.de ?? systemId)
          : String(nameField ?? systemId)

      return {
        systemId,
        name,
        regionId: num(raw.regionID),
        constellationId: num(raw.constellationID),
        security: num(raw.securityStatus),
        x,
        z: y,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.systemId - b.systemId)
}

/**
 * @param {Array<{ systemId: number }>} systems
 * @param {Array<Record<string, string>>} mapSolarSystemJumps
 */
export function buildMapData(systems, mapSolarSystemJumps) {
  const systemIds = new Set(systems.map((s) => s.systemId))

  const seen = new Set()
  const jumps = []
  for (const row of mapSolarSystemJumps) {
    const from = num(row.fromSolarSystemID)
    const to = num(row.toSolarSystemID)
    if (!from || !to || from === to) continue
    if (!systemIds.has(from) || !systemIds.has(to)) continue
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    const key = `${lo}-${hi}`
    if (seen.has(key)) continue
    seen.add(key)
    jumps.push([lo, hi])
  }

  return {
    generatedAt: new Date().toISOString(),
    systems,
    jumps,
  }
}
