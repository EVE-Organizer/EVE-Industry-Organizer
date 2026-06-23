/**
 * Trade hub definitions for data scripts. Keep in sync with src/types/index.ts HUBS.
 *
 * Player hubs (no NPC sell station) set sellSystemId + sellStationName instead of sellStationId.
 */
export const HUBS = [
  {
    hubId: 'jita',
    regionId: 10000002,
    marketSystemId: 30000142,
    sellStationId: 60003760,
    buildSystemId: 30000144,
    isBuildHubSystem: true,
  },
  {
    hubId: 'amarr',
    regionId: 10000043,
    marketSystemId: 30002187,
    sellStationId: 60008494,
    buildSystemId: 30002187,
  },
  {
    hubId: 'dodixie',
    regionId: 10000032,
    marketSystemId: 30002659,
    sellStationId: 60011866,
    buildSystemId: 30002659,
  },
  {
    hubId: 'rens',
    regionId: 10000030,
    marketSystemId: 30002510,
    sellStationId: 60004588,
    buildSystemId: 30002510,
  },
  {
    hubId: 'hek',
    regionId: 10000042,
    marketSystemId: 30002053,
    sellStationId: 60005686,
    buildSystemId: 30002053,
  },
  {
    hubId: 'xhq7v',
    regionId: 10000047,
    marketSystemId: 30003731,
    buildSystemId: 30003731,
    sellSystemId: 30003731,
    sellStationName: 'XHQ-7V',
  },
]

export const HUB_REGION_IDS = Object.fromEntries(HUBS.map((hub) => [hub.hubId, hub.regionId]))

export const HUB_MARKET_SYSTEMS = Object.fromEntries(
  HUBS.map((hub) => [hub.hubId, hub.marketSystemId]),
)

/** @param {typeof HUBS[number]} hub @param {Map<string, object>} stationById */
export function resolveSellSystemId(hub, stationById) {
  if (hub.sellSystemId != null) return hub.sellSystemId
  const row = stationById.get(String(hub.sellStationId))
  if (!row?.solarSystemID) return null
  return Number(row.solarSystemID)
}
