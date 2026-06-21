import { useMemo } from 'react'
import { useSdeData } from '@/hooks/useSdeData'
import { rankStations } from '@/lib/stations'
import { HUBS } from '@/types'
import { PageHeader, LoadingState } from '@/components/Layout'
import { EveImage, HubLogo } from '@/components/EveImage'
import { MetricTile } from '@/components/MetricTile'
import { ScoreBar } from '@/components/ScoreBar'
import { formatDecimal } from '@/lib/profit'

const RANK_LABELS = ['1st', '2nd', '3rd'] as const

export function StationsPage() {
  const { data: sde, isLoading } = useSdeData()

  const rankings = useMemo(() => {
    if (!sde) return []
    const costIndices: Record<number, number> = {}
    for (const hub of HUBS) {
      const hubMarket = sde.market.hubs[hub.id]
      if (hubMarket) costIndices[hub.buildSystemId] = hubMarket.costIndex
    }
    for (const region of sde.regions.regions) {
      costIndices[region.buildSystemId] = region.costIndex
    }
    return rankStations(HUBS, sde.systems, costIndices)
  }, [sde])

  const maxScore = useMemo(
    () => (rankings.length ? Math.max(...rankings.map((r) => r.totalScore)) : 1),
    [rankings],
  )

  if (isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title="Home Stations"
        subtitle="Ranked by liquidity, cost index, and haul distance"
      />

      <div className="space-y-4">
        {rankings.map((r, i) => (
          <article
            key={r.hub.id}
            className={`card bg-base-200 border border-eve-border overflow-hidden${i === 0 ? ' border-primary/40 shadow-lg shadow-primary/5' : ''}`}
          >
            <div className="card-body gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <HubLogo hubId={r.hub.id} size={48} alt={r.hub.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge badge-sm shrink-0 ${i === 0 ? 'badge-primary' : 'badge-ghost'}`}
                      >
                        {RANK_LABELS[i] ?? `#${i + 1}`}
                      </span>
                      <h2 className="card-title text-lg p-0">{r.hub.name}</h2>
                      {i === 0 && <span className="badge badge-primary badge-sm">Recommended</span>}
                    </div>
                    <p className="text-xs opacity-60 mt-0.5">{r.hub.regionName}</p>
                    <p className="text-sm opacity-80 mt-2">{r.explanation}</p>
                  </div>
                </div>
                <div className="w-full sm:w-48 shrink-0">
                  <ScoreBar
                    value={r.totalScore}
                    max={maxScore}
                    label="Overall score"
                    accent={i === 0 ? 'bg-primary' : 'bg-secondary/70'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MetricTile
                  label="Liquidity"
                  value={r.liquidityScore}
                  accent="info"
                  icon={<EveImage id={16652} size={28} framed alt="" />}
                />
                <MetricTile
                  label="Cost index"
                  value={`${formatDecimal(r.costIndex * 100, 2)}%`}
                  accent="warning"
                  icon={<EveImage id={688} variant="bp" productTypeId={12753} size={32} framed alt="" />}
                />
                <MetricTile
                  label="Build system"
                  value={r.buildSystem.name}
                  accent="success"
                  icon={<EveImage id={7367} size={32} framed alt="" />}
                />
                <MetricTile
                  label="Security"
                  value={formatDecimal(r.buildSystem.security, 1)}
                  accent={r.buildSystem.security >= 0.5 ? 'success' : 'warning'}
                  icon={
                    <span
                      className={`flex items-center justify-center rounded-md border border-eve-border w-7 h-7 text-xs font-bold ${r.buildSystem.security >= 0.5 ? 'text-success bg-success/10' : 'text-warning bg-warning/10'}`}
                    >
                      {r.buildSystem.security >= 0 ? 'HS' : 'LS'}
                    </span>
                  }
                />
              </div>

              <div className="flex items-center gap-2 text-xs opacity-70 pt-1 border-t border-eve-border/50">
                <HubLogo hubId={r.hub.id} size={20} alt="" />
                <span>Sell at: {r.hub.sellStationName}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
