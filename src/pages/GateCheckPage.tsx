import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GateCheckLegend, GateCheckResultsTable } from '@/components/gateCheck/GateCheckResults'
import { MapSystemSearch } from '@/components/map/MapSystemSearch'
import { LoadingState, PageHeader } from '@/components/Layout'
import {
  findSystemByName,
  parseRouteFlag,
  routeFlagLabel,
  useGateCheckRoute,
  useMapSystemsIndex,
} from '@/hooks/useGateCheckRoute'
import { useMapData } from '@/hooks/useMapData'
import { useSdeData } from '@/hooks/useSdeData'
import type { RouteFlag } from '@/services/market/marketService'

const ROUTE_FLAGS: RouteFlag[] = ['secure', 'shortest', 'insecure']

function SelectedSystemField({
  label,
  systemId,
  systemName,
  systems,
  regions,
  onSelect,
  onClear,
}: {
  label: string
  systemId: number | null
  systemName: string
  systems: Parameters<typeof MapSystemSearch>[0]['systems']
  regions: Parameters<typeof MapSystemSearch>[0]['regions']
  onSelect: (systemId: number) => void
  onClear: () => void
}) {
  return (
    <label className="form-control w-full">
      <span className="label-text text-xs font-medium mb-1">{label}</span>
      {systemId != null ? (
        <div className="flex items-center gap-2 rounded-lg border border-eve-border bg-base-200 px-3 py-2">
          <span className="text-sm font-medium truncate flex-1">{systemName}</span>
          <button type="button" className="btn btn-xs btn-ghost shrink-0" onClick={onClear}>
            Change
          </button>
        </div>
      ) : (
        <MapSystemSearch systems={systems} regions={regions} onSelect={onSelect} className="w-full" />
      )}
    </label>
  )
}

export function GateCheckPage() {
  const { data: mapData, isLoading: mapLoading } = useMapData()
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const [searchParams, setSearchParams] = useSearchParams()

  const systems = mapData?.systems ?? []
  const { byId: systemsById, byName: systemsByName } = useMapSystemsIndex(systems)

  const [fromSystemId, setFromSystemId] = useState<number | null>(null)
  const [toSystemId, setToSystemId] = useState<number | null>(null)
  const [flag, setFlag] = useState<RouteFlag>(() => parseRouteFlag(searchParams.get('flag')))
  const [avoidSystemIds, setAvoidSystemIds] = useState<number[]>([])
  const [avoidPickerOpen, setAvoidPickerOpen] = useState(false)

  const fromName = fromSystemId != null ? (systemsById.get(fromSystemId)?.name ?? '') : ''
  const toName = toSystemId != null ? (systemsById.get(toSystemId)?.name ?? '') : ''

  const { result, error, loading, canCheck, checkRoute } = useGateCheckRoute({
    fromSystemId,
    toSystemId,
    flag,
    avoidSystemIds,
    systemsById,
  })

  useEffect(() => {
    if (!systems.length) return
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    if (fromParam) {
      const system = systemsByName.get(fromParam.toLowerCase()) ?? findSystemByName(systems, fromParam)
      if (system) setFromSystemId(system.systemId)
    }
    if (toParam) {
      const system = systemsByName.get(toParam.toLowerCase()) ?? findSystemByName(systems, toParam)
      if (system) setToSystemId(system.systemId)
    }
    setFlag(parseRouteFlag(searchParams.get('flag')))
  }, [systems, systemsByName, searchParams])

  const syncUrl = useCallback(
    (nextFrom: number | null, nextTo: number | null, nextFlag: RouteFlag) => {
      const params = new URLSearchParams()
      const from = nextFrom != null ? systemsById.get(nextFrom)?.name : null
      const to = nextTo != null ? systemsById.get(nextTo)?.name : null
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (nextFlag !== 'secure') params.set('flag', nextFlag)
      setSearchParams(params, { replace: true })
    },
    [setSearchParams, systemsById],
  )

  function selectFrom(systemId: number) {
    if (!Number.isFinite(systemId)) {
      setFromSystemId(null)
      syncUrl(null, toSystemId, flag)
      return
    }
    setFromSystemId(systemId)
    syncUrl(systemId, toSystemId, flag)
  }

  function selectTo(systemId: number) {
    if (!Number.isFinite(systemId)) {
      setToSystemId(null)
      syncUrl(fromSystemId, null, flag)
      return
    }
    setToSystemId(systemId)
    syncUrl(fromSystemId, systemId, flag)
  }

  function updateFlag(nextFlag: RouteFlag) {
    setFlag(nextFlag)
    syncUrl(fromSystemId, toSystemId, nextFlag)
  }

  function addAvoidSystem(systemId: number) {
    setAvoidSystemIds((prev) => (prev.includes(systemId) ? prev : [...prev, systemId]))
    setAvoidPickerOpen(false)
  }

  function removeAvoidSystem(systemId: number) {
    setAvoidSystemIds((prev) => prev.filter((id) => id !== systemId))
  }

  const avoidLabels = useMemo(
    () =>
      avoidSystemIds.map((id) => ({
        id,
        name: systemsById.get(id)?.name ?? `System ${id}`,
      })),
    [avoidSystemIds, systemsById],
  )

  if (mapLoading || sdeLoading) {
    return <LoadingState />
  }

  return (
    <div className="flex flex-col min-h-0 gap-6">
      <PageHeader
        title="Gate check"
        subtitle="Check gate kills, smartbombs, and bubble ships on your route before you jump."
      />

      <section className="card bg-base-200 border border-eve-border">
        <div className="card-body gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectedSystemField
              label="From"
              systemId={fromSystemId}
              systemName={fromName}
              systems={systems}
              regions={sde?.regions}
              onSelect={selectFrom}
              onClear={() => selectFrom(Number.NaN)}
            />
            <SelectedSystemField
              label="To"
              systemId={toSystemId}
              systemName={toName}
              systems={systems}
              regions={sde?.regions}
              onSelect={selectTo}
              onClear={() => selectTo(Number.NaN)}
            />
          </div>

          <fieldset>
            <legend className="text-xs font-medium mb-2">Prefer</legend>
            <div className="flex flex-wrap gap-2">
              {ROUTE_FLAGS.map((routeFlag) => (
                <label key={routeFlag} className="label cursor-pointer gap-2 py-1">
                  <input
                    type="radio"
                    name="route-flag"
                    className="radio radio-sm radio-primary"
                    checked={flag === routeFlag}
                    onChange={() => updateFlag(routeFlag)}
                  />
                  <span className="label-text text-sm">{routeFlagLabel(routeFlag)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium">Avoid systems</span>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => setAvoidPickerOpen((open) => !open)}
              >
                {avoidPickerOpen ? 'Hide picker' : 'Add system'}
              </button>
            </div>
            {avoidPickerOpen ? (
              <MapSystemSearch
                systems={systems}
                regions={sde?.regions}
                onSelect={addAvoidSystem}
                className="max-w-md mb-2"
              />
            ) : null}
            {avoidLabels.length ? (
              <div className="flex flex-wrap gap-2">
                {avoidLabels.map(({ id, name }) => (
                  <span key={id} className="badge badge-outline gap-1 py-3">
                    {name}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs px-1 min-h-0 h-auto"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeAvoidSystem(id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs opacity-50">No avoided systems.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canCheck || loading}
              onClick={() => void checkRoute()}
            >
              {loading ? 'Checking…' : 'Check route'}
            </button>
            {!canCheck && fromSystemId != null && toSystemId != null ? (
              <span className="text-xs opacity-60">Pick different origin and destination.</span>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div className="alert alert-warning text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <section className="card bg-base-200 border border-eve-border">
          <div className="card-body gap-4">
            <div>
              <h2 className="text-base font-semibold">Route</h2>
              <p className="text-xs opacity-60 mt-1">
                {result.fromName} → {result.toName} · {result.route.gateJumps} jump
                {result.route.gateJumps === 1 ? '' : 's'} · {routeFlagLabel(flag)}
              </p>
            </div>
            <GateCheckResultsTable
              jumps={result.route.jumps}
              fromName={result.fromName}
              toName={result.toName}
            />
          </div>
        </section>
      ) : null}

      <section className="card bg-base-200/60 border border-eve-border">
        <div className="card-body">
          <GateCheckLegend />
          <p className="text-[11px] opacity-50 mt-3">
            Gate intel comes from zKillboard killmails in the last hour. This is not live local intel.
          </p>
        </div>
      </section>
    </div>
  )
}
