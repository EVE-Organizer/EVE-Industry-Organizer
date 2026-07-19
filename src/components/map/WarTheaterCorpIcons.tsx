import { CorpLogo } from '@/components/EveImage'
import { EmojiBadge } from '@/components/map/MapLegend'
import { topCorpsFromKills } from '@/lib/warActivity'
import type { ZkillRelatedPilot } from '@/services/market/zkillService'
import type { WarKillEvidence } from '@/types/map'

interface CorpIconStackProps {
  corporationIds: number[]
  size?: number
  className?: string
  fallbackEmoji?: string
  fallbackColor?: string
}

export function CorpIconStack({
  corporationIds,
  size = 20,
  className = '',
  fallbackEmoji = '⚔️',
  fallbackColor = '#d946ef',
}: CorpIconStackProps) {
  const ids = corporationIds.filter((id) => id > 0).slice(0, 3)
  if (ids.length === 0) {
    return <EmojiBadge emoji={fallbackEmoji} color={fallbackColor} size={size + 4} />
  }

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      {ids.map((id, i) => (
        <span
          key={id}
          className={i > 0 ? '-ml-1.5' : ''}
          style={{ zIndex: ids.length - i }}
        >
          <CorpLogo corporationId={id} size={size} framed />
        </span>
      ))}
    </div>
  )
}

export function TheaterCorpIcons({
  kills,
  size = 20,
  className = '',
}: {
  kills: WarKillEvidence[]
  size?: number
  className?: string
}) {
  const corps = topCorpsFromKills(kills, 2)
  return (
    <CorpIconStack
      corporationIds={corps.map((c) => c.corporationId)}
      size={size}
      className={className}
    />
  )
}

export function topCorpFromPilots(
  pilots: ZkillRelatedPilot[],
): { corporationId: number; ticker: string | null; name: string } | null {
  const counts = new Map<
    number,
    { count: number; ticker: string | null; name: string }
  >()
  for (const pilot of pilots) {
    if (!pilot.corporationId) continue
    const cur =
      counts.get(pilot.corporationId) ?? {
        count: 0,
        ticker: pilot.corpTicker,
        name: pilot.corporationName,
      }
    cur.count++
    counts.set(pilot.corporationId, cur)
  }
  let best: {
    corporationId: number
    ticker: string | null
    name: string
    count: number
  } | null = null
  for (const [corporationId, stats] of counts) {
    if (!best || stats.count > best.count) {
      best = {
        corporationId,
        ticker: stats.ticker,
        name: stats.name,
        count: stats.count,
      }
    }
  }
  if (!best) return null
  return {
    corporationId: best.corporationId,
    ticker: best.ticker,
    name: best.name,
  }
}
