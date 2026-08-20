import { useEffect, useState, type RefObject } from 'react'
import type { FitShipStats } from '@/lib/fitting/types'

interface FitStatsDockProps {
  stats: FitShipStats
  rangeKm: number
  statsPanelRef: RefObject<HTMLElement | null>
}

export function FitStatsDock({ stats, rangeKm, statsPanelRef }: FitStatsDockProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = statsPanelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.05, rootMargin: '-8px 0px 0px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [statsPanelRef])

  if (!show) return null

  const { load, tank, weapons, navigation, capacitor } = stats
  const capLabel =
    capacitor.stablePercent != null
      ? `${capacitor.stablePercent}%`
      : capacitor.lastsSeconds != null
        ? `${capacitor.lastsSeconds}s`
        : '—'

  return (
    <div
      className="hidden sm:block fixed bottom-4 right-4 z-20 w-56 rounded-lg border border-eve-border bg-base-200/95 backdrop-blur-sm shadow-lg"
      aria-live="polite"
      aria-label="Compact fit stats"
    >
      <div className="px-3 py-2 border-b border-eve-border/50">
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-50">Fit preview</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 text-center">
        {weapons ? (
          <DockMetric label="DPS" value={weapons.appliedDps.toLocaleString()} accent />
        ) : null}
        <DockMetric label="EHP" value={tank.totalEhp.toLocaleString()} />
        <DockMetric label="Speed" value={`${navigation.maxVelocity}`} sub="m/s" />
        <DockMetric label="Cap" value={capLabel} />
      </div>
      <div className="px-3 pb-3 space-y-1.5 border-t border-eve-border/40 pt-2">
        <DockLoad label="PG" used={load.powerUsed} cap={load.powerOutput} ok={load.powerOk} />
        <DockLoad label="CPU" used={load.cpuUsed} cap={load.cpuOutput} ok={load.cpuOk} />
        {weapons ? (
          <p className="text-[10px] opacity-45 text-center pt-0.5">@ {rangeKm} km</p>
        ) : null}
      </div>
    </div>
  )
}

function DockMetric({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className={`text-sm font-semibold tabular-nums truncate ${accent ? 'text-primary' : ''}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide opacity-50">{label}</div>
      {sub ? <div className="text-[10px] opacity-40">{sub}</div> : null}
    </div>
  )
}

function DockLoad({
  label,
  used,
  cap,
  ok,
}: {
  label: string
  used: number
  cap: number
  ok: boolean
}) {
  const fill = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-8 shrink-0 opacity-60">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-base-300 overflow-hidden">
        <div
          className={`h-full rounded-full ${ok ? 'bg-primary/70' : 'bg-warning'}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      <span className={`shrink-0 tabular-nums ${ok ? 'opacity-80' : 'text-warning'}`}>
        {used.toFixed(1)}/{cap.toFixed(1)}
        {!ok ? ' !' : ''}
      </span>
    </div>
  )
}
