import { HUBS, type HubConfig, type HubId } from '@/types'

/** NPC trade hub with a fixed sell station (Jita, Amarr, etc.). */
export function isNpcTradeHub(hub: HubConfig): boolean {
  return hub.sellStationId > 0
}

/** User-facing hub label: "The Forge (Jita)" for NPC hubs, region only for player structures. */
export function formatHubLabel(hub: HubConfig): string {
  if (isNpcTradeHub(hub)) {
    return `${hub.regionName} (${hub.name})`
  }
  return hub.regionName
}

export function hubDisplayName(hubId: HubId): string {
  const hub = HUBS.find((h) => h.id === hubId)
  return hub ? formatHubLabel(hub) : hubId
}

/** Tailwind class for system security (high / low / null). */
export function securityColor(security: number): string {
  if (security >= 0.5) return 'text-success'
  if (security > 0) return 'text-warning'
  return 'text-error'
}

export function formatSecurity(security: number): string {
  return security.toFixed(1)
}
