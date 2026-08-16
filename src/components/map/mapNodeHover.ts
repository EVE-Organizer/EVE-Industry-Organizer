import { hubDisplayName } from '@/lib/hubDisplay'
import type { HubId } from '@/types'
import { HUBS } from '@/types'
import type { MapGraph, MapLayers, WarActivityResult } from '@/types/map'
import type { MapSystemDraw } from '@/lib/galaxyMapProject'
import { securityColor } from '@/lib/galaxyMapProject'
import { formatIsk } from '@/lib/profit'

export interface MapNodeHoverDetail {
  systemId: number
  name: string
  security: number
  securityColor: string
  badges: { label: string; tone: 'default' | 'info' | 'warning' | 'danger' | 'success' }[]
  lines: string[]
}

export function buildMapNodeHoverDetail(input: {
  system: MapSystemDraw
  graph: MapGraph
  layers: MapLayers
  manufacturingSystemId: number
  warResults: WarActivityResult[]
  campSystemIds: Set<number>
  haulInRoute: number[]
  haulOutRoute: number[]
  spikeHubIds: Set<HubId>
}): MapNodeHoverDetail {
  const {
    system,
    layers,
    manufacturingSystemId,
    warResults,
    campSystemIds,
    haulInRoute,
    haulOutRoute,
    spikeHubIds,
  } = input

  const badges: MapNodeHoverDetail['badges'] = []
  const lines: string[] = []

  if (system.systemId === manufacturingSystemId) {
    badges.push({ label: 'Your factory', tone: 'info' })
  }

  const hub = HUBS.find((h) => h.marketSystemId === system.systemId)
  if (hub && layers.tradeHubs) {
    badges.push({ label: hubDisplayName(hub.id), tone: 'default' })
    if (layers.volumeSpike && spikeHubIds.has(hub.id)) {
      badges.push({ label: 'Volume spike', tone: 'warning' })
    }
  }

  const war = warResults.find((w) => w.systemId === system.systemId)
  if (war?.isWar && layers.war) {
    badges.push({ label: 'War zone', tone: 'danger' })
    if (war.theaterSystemNames.length > 1) {
      lines.push(`Theater: ${war.theaterSystemNames.join(', ')}`)
    }
    lines.push(`${war.fleetKills} fleet kills · ${formatIsk(war.iskDestroyed)}`)
    lines.push(war.reason)
    if (war.kills[0]) {
      lines.push(
        `Top loss ${formatIsk(war.kills[0].totalValue)}${war.kills[0].shipName ? ` ${war.kills[0].shipName}` : ''}`,
      )
    }
    if (war.nearestHubSystemId != null) {
      const restockName =
        war.nearestHubSystemId === manufacturingSystemId
          ? 'your factory'
          : (input.graph.systems.get(war.nearestHubSystemId)?.name ??
            HUBS.find((h) => h.id === war.nearestHubId)?.name ??
            'restock')
      lines.push(
        `Restock via ${restockName}${war.nearestHubJumps !== null ? ` (${war.nearestHubJumps}j)` : ''}`,
      )
    }
  }

  if (campSystemIds.has(system.systemId) && layers.gateCamp && !war?.isWar) {
    badges.push({ label: 'Route danger', tone: 'warning' })
    lines.push('Recent gate camp or gank activity')
  }

  if (layers.haulCorridor) {
    if (haulInRoute.includes(system.systemId)) {
      badges.push({ label: 'Buy route', tone: 'info' })
    }
    if (haulOutRoute.includes(system.systemId)) {
      badges.push({ label: 'Sell route', tone: 'warning' })
    }
  }

  const neighborCount = input.graph.adjacency.get(system.systemId)?.length ?? 0
  if (badges.length === 0 && lines.length === 0) {
    lines.push(`${neighborCount} gate${neighborCount === 1 ? '' : 's'}`)
  }

  return {
    systemId: system.systemId,
    name: system.name,
    security: system.security,
    securityColor: securityColor(system.security),
    badges,
    lines,
  }
}
