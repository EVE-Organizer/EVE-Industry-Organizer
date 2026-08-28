import type { FitResists, FitShipStats, FleetLinkId } from '@/pages/FitSkills/types'

interface FitLoadStatsProps {
  stats: FitShipStats
  rangeKm: number
  onRangeKmChange: (km: number) => void
  fleetLinks: FleetLinkId[]
  onFleetLinksChange: (links: FleetLinkId[]) => void
  implantSource?: string
}

const FLEET_OPTIONS: { id: FleetLinkId; label: string }[] = [
  { id: 'skirmish', label: 'Skirmish' },
  { id: 'armored', label: 'Armored' },
  { id: 'information', label: 'Info' },
  { id: 'siege', label: 'Siege' },
  { id: 'miningForeman', label: 'Foreman' },
]

const RESIST_KEYS = ['em', 'thermal', 'kinetic', 'explosive'] as const
const RESIST_LABELS = ['EM', 'Thermal', 'Kinetic', 'Explosive']

function pct(used: number, cap: number): number {
  if (cap <= 0) return 0
  return Math.round((used / cap) * 100)
}

function LoadBar({ used, cap, ok, label }: { used: number; cap: number; ok: boolean; label: string }) {
  const fill = Math.min(100, pct(used, cap))
  const over = !ok
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-14 shrink-0 text-xs opacity-60">{label}</span>
      <div className="flex-1 min-w-[5rem]">
        <div className="h-1 rounded-full bg-base-300 overflow-hidden">
          <div
            className={`h-full rounded-full ${over ? 'bg-warning' : 'bg-primary/70'}`}
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
      <span
        className={`shrink-0 text-xs tabular-nums text-right ${over ? 'text-warning' : 'opacity-90'}`}
      >
        {used.toFixed(1)} / {cap.toFixed(1)}
        {over ? ' !' : ''}
      </span>
    </div>
  )
}

function ResistGrid({ shield, armor }: { shield: FitResists; armor: FitResists }) {
  return (
    <table className="w-full text-[11px] tabular-nums">
      <thead>
        <tr className="opacity-50">
          <th className="text-left font-normal pb-1 w-12" />
          {RESIST_LABELS.map((h) => (
            <th key={h} className="text-right font-normal pb-1 px-1">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(
          [
            ['Shield', shield],
            ['Armor', armor],
          ] as const
        ).map(([name, res]) => (
          <tr key={name}>
            <td className="text-left opacity-60 py-0.5">{name}</td>
            {RESIST_KEYS.map((key) => (
              <td key={key} className="text-right px-1 py-0.5">
                {Math.round((1 - res[key]) * 100)}%
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'primary' | 'default'
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-center min-w-0 ${
        accent === 'primary'
          ? 'border-primary/40 bg-primary/10'
          : 'border-eve-border/70 bg-base-300/30'
      }`}
    >
      <div
        className={`text-lg font-semibold tabular-nums leading-tight truncate ${
          accent === 'primary' ? 'text-primary' : ''
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide opacity-50 mt-0.5">{label}</div>
      {sub ? <div className="text-[10px] opacity-40 mt-0.5 truncate">{sub}</div> : null}
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <th
        colSpan={2}
        className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 bg-base-300/50 px-3 py-1.5 text-left border-y border-eve-border/40"
      >
        {children}
      </th>
    </tr>
  )
}

function StatLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <tr className="border-b border-eve-border/20 last:border-0">
      <td className="py-1.5 pl-3 pr-2 text-xs opacity-65 whitespace-nowrap">{label}</td>
      <td className="py-1.5 pr-3 text-right">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        {hint ? <span className="ml-2 text-[10px] opacity-45">{hint}</span> : null}
      </td>
    </tr>
  )
}

export function FitLoadStats({
  stats,
  rangeKm,
  onRangeKmChange,
  fleetLinks,
  onFleetLinksChange,
  implantSource,
}: FitLoadStatsProps) {
  const { load, tank, weapons, capacitor, navigation, drones, unmappedTraits } = stats

  function toggleLink(id: FleetLinkId) {
    if (fleetLinks.includes(id)) onFleetLinksChange(fleetLinks.filter((l) => l !== id))
    else onFleetLinksChange([...fleetLinks, id])
  }

  const capLabel =
    capacitor.stablePercent != null
      ? `${capacitor.stablePercent}% stable`
      : capacitor.lastsSeconds != null
        ? `${capacitor.lastsSeconds}s`
        : '—'

  return (
    <div className="min-w-0 flex flex-col gap-3">
      {/* key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {weapons ? (
          <MetricTile
            label="Applied DPS"
            value={weapons.appliedDps.toLocaleString()}
            sub={`@ ${rangeKm} km · ${weapons.ammoName ?? 'no charge'}`}
            accent="primary"
          />
        ) : null}
        <MetricTile label="Total EHP" value={tank.totalEhp.toLocaleString()} sub="omni profile" />
        <MetricTile label="Max speed" value={`${navigation.maxVelocity}`} sub="m/s" />
        <MetricTile label="Capacitor" value={capLabel} sub={`${capacitor.usage} / ${capacitor.peakRecharge} GJ/s`} />
      </div>

      {/* main stats panel */}
      <div className="rounded-lg border border-eve-border overflow-hidden bg-base-300/15">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <SectionHead>Fitting</SectionHead>
              <tr className="border-b border-eve-border/20">
                <td colSpan={2} className="px-3 py-2 space-y-1.5">
                  <LoadBar
                    label="PG"
                    used={load.powerUsed}
                    cap={load.powerOutput}
                    ok={load.powerOk}
                  />
                  <LoadBar label="CPU" used={load.cpuUsed} cap={load.cpuOutput} ok={load.cpuOk} />
                  {load.calibrationOutput != null ? (
                    <div className="flex justify-between text-xs pt-0.5">
                      <span className="opacity-60">Calibration</span>
                      <span
                        className={`tabular-nums ${load.calibrationOk ? '' : 'text-warning'}`}
                      >
                        {load.calibrationUsed ?? 0} / {load.calibrationOutput}
                      </span>
                    </div>
                  ) : null}
                </td>
              </tr>

              <SectionHead>Tank</SectionHead>
              <StatLine
                label="Hit points"
                value={`${tank.shield.hp.toLocaleString()} / ${tank.armor.hp.toLocaleString()} / ${tank.hull.hp.toLocaleString()}`}
                hint="S / A / H"
              />
              <StatLine
                label="Effective HP"
                value={`${tank.shield.ehp.toLocaleString()} / ${tank.armor.ehp.toLocaleString()}`}
                hint="shield / armor"
              />
              <tr className="border-b border-eve-border/20">
                <td colSpan={2} className="px-3 py-2">
                  <ResistGrid shield={tank.shield.resists} armor={tank.armor.resists} />
                </td>
              </tr>

              {weapons ? (
                <>
                  <SectionHead>Weapons</SectionHead>
                  <StatLine label="Raw DPS" value={weapons.rawDps.toLocaleString()} />
                  <StatLine
                    label="Applied DPS"
                    value={weapons.appliedDps.toLocaleString()}
                    hint={`@ ${rangeKm} km`}
                  />
                  <StatLine
                    label="Range"
                    value={`${weapons.optimalKm} + ${weapons.falloffKm} km`}
                    hint="opt + fall"
                  />
                  <StatLine label="Tracking" value={`${weapons.tracking} rad/s`} />
                </>
              ) : null}

              <SectionHead>Capacitor & navigation</SectionHead>
              <StatLine label="Cap capacity" value={`${capacitor.capacity} GJ`} />
              <StatLine
                label="Cap balance"
                value={`${capacitor.usage} use · ${capacitor.peakRecharge} peak GJ/s`}
              />
              <StatLine label="Align time" value={`${navigation.alignSeconds} s`} />
              <StatLine label="Signature" value={`${navigation.signature} m`} />
              {navigation.lockRange ? (
                <StatLine label="Lock range" value={`${Math.round(navigation.lockRange / 1000)} km`} />
              ) : null}
              {navigation.warpSpeed ? (
                <StatLine label="Warp speed" value={`${navigation.warpSpeed} AU/s`} />
              ) : null}

              {drones ? (
                <>
                  <SectionHead>Drones</SectionHead>
                  <StatLine label="Drone DPS" value={drones.dps.toLocaleString()} />
                  <StatLine
                    label="Drone bay"
                    value={`${drones.bandwidth} Mbit/s · ${drones.bay} m³`}
                  />
                </>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-eve-border/50 bg-base-300/25">
          <label className="flex items-center gap-1.5 text-xs shrink-0">
            <span className="opacity-50">Range</span>
            <input
              type="number"
              min={0}
              step={0.5}
              className="input input-bordered input-xs w-14 tabular-nums h-7 min-h-0"
              value={rangeKm}
              onChange={(e) => onRangeKmChange(Number(e.target.value))}
            />
            <span className="opacity-40">km</span>
          </label>
          <div className="w-px h-5 bg-eve-border/50 hidden sm:block" />
          <div className="flex flex-wrap gap-1">
            {FLEET_OPTIONS.map((opt) => {
              const on = fleetLinks.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`btn btn-xs h-7 min-h-0 rounded-md ${
                    on ? 'btn-primary' : 'btn-ghost bg-base-200/50 opacity-70 hover:opacity-100'
                  }`}
                  onClick={() => toggleLink(opt.id)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {implantSource ? (
            <>
              <div className="w-px h-5 bg-eve-border/50 hidden sm:block" />
              <span className="text-[10px] opacity-45 truncate">{implantSource}</span>
            </>
          ) : null}
        </div>
      </div>

      {unmappedTraits.length ? (
        <details className="group rounded-lg border border-eve-border/60 bg-base-300/10 text-sm">
          <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-2 select-none">
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-50">
              Hull bonuses
            </span>
            <span className="badge badge-xs badge-ghost opacity-60">{unmappedTraits.length}</span>
          </summary>
          <ul className="px-3 pb-3 space-y-1.5 text-xs opacity-75 leading-relaxed border-t border-eve-border/30 pt-2">
            {unmappedTraits.map((text) => (
              <li key={text} className="pl-2 border-l-2 border-primary/25">
                {text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
