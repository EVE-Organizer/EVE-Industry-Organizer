import { useEffect, useMemo, useRef, useState } from 'react'
import { EveImage } from '@/components/EveImage'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { useProductionLocations } from '@/hooks/useCharacterIndustryData'
import { findProductionLocation } from '@/lib/productionLocations'
import {
  MINING_REPROCESS_HULLS,
  miningReprocessHullFromLocation,
  miningReprocessHullLabel,
  miningReprocessSpaceFromSystem,
  normalizeMiningReprocessFacility,
} from '@/lib/miningReprocess'
import type {
  GlobalSettings,
  MiningReprocessHull,
  ProductionLocation,
  SystemInfo,
} from '@/types'

interface ReprocessLocationPickerProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  systems?: SystemInfo[]
  size?: 'sm' | 'md'
}

function HullArt({ hull, slotSize }: { hull: MiningReprocessHull; slotSize: number }) {
  const typeId = MINING_REPROCESS_HULLS.find((row) => row.id === hull)?.typeId ?? 1529
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-eve-border bg-base-300/80 shadow-sm"
      style={{ width: slotSize, height: slotSize }}
      aria-hidden
    >
      <EveImage
        id={typeId}
        variant="render"
        size={slotSize}
        framed={false}
        alt=""
        lazy={false}
        className="max-w-full max-h-full object-contain"
      />
    </span>
  )
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

export function ReprocessLocationPicker({
  settings,
  onChange,
  systems,
  size = 'md',
}: ReprocessLocationPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const facility = normalizeMiningReprocessFacility(settings.miningReprocessFacility)
  const configured = useAuthStore((s) => s.configured)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const { hasAll, missing } = useAuthScopes(activeCharacterId)
  const { data: locations = [], isLoading, error } = useProductionLocations(
    configured && activeCharacterId != null ? activeCharacterId : null,
  )

  const selectedLocation = useMemo(
    () =>
      findProductionLocation(
        locations,
        settings.miningReprocessLocationId,
        settings.miningReprocessLocationKind,
      ),
    [locations, settings.miningReprocessLocationId, settings.miningReprocessLocationKind],
  )

  const triggerHull = selectedLocation
    ? miningReprocessHullFromLocation(selectedLocation.kind, selectedLocation.structureTypeId)
    : facility.hull
  const triggerLabel = selectedLocation
    ? selectedLocation.name
    : miningReprocessHullLabel(facility.hull)

  const filteredLocations = useMemo(() => {
    const q = query.trim()
    if (!q) return locations
    return locations.filter((location) => matchesQuery(location.name, q))
  }, [locations, query])

  const filteredPresets = useMemo(() => {
    const q = query.trim()
    if (!q) return MINING_REPROCESS_HULLS
    return MINING_REPROCESS_HULLS.filter((hull) => matchesQuery(hull.label, q))
  }, [query])

  const showCharacterLocations = configured && activeCharacterId != null
  const hasSearch = query.trim().length > 0
  const showLocationSection =
    showCharacterLocations && (!hasSearch || filteredLocations.length > 0 || isLoading || !hasAll)
  const showPresetSection = !hasSearch || filteredPresets.length > 0
  const noMatches = hasSearch && filteredLocations.length === 0 && filteredPresets.length === 0

  const triggerSlot = size === 'sm' ? 40 : 44
  const optionSlot = size === 'sm' ? 36 : 40
  const triggerClass =
    size === 'sm'
      ? 'input input-bordered input-sm !h-12 !min-h-12 py-1'
      : 'input input-bordered !h-14 !min-h-14 py-1.5'

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (settings.miningReprocessLocationId == null || isLoading) return
    if (selectedLocation) return
    onChange({ miningReprocessLocationId: null, miningReprocessLocationKind: null })
  }, [
    activeCharacterId,
    isLoading,
    onChange,
    selectedLocation,
    settings.miningReprocessLocationId,
  ])

  useEffect(() => {
    if (settings.miningReprocessLocationId == null || isLoading || !selectedLocation) return
    const hull = miningReprocessHullFromLocation(
      selectedLocation.kind,
      selectedLocation.structureTypeId,
    )
    const space = miningReprocessSpaceFromSystem(
      systems,
      selectedLocation.solarSystemId,
      facility.space,
    )
    const next = normalizeMiningReprocessFacility({
      ...facility,
      hull,
      space,
      rig: hull === 'npc' ? 'none' : facility.rig,
    })
    if (
      next.hull === facility.hull &&
      next.space === facility.space &&
      next.rig === facility.rig
    ) {
      return
    }
    onChange({ miningReprocessFacility: next })
  }, [
    facility,
    isLoading,
    onChange,
    selectedLocation,
    settings.miningReprocessLocationId,
    systems,
  ])

  function selectPreset(hull: MiningReprocessHull) {
    onChange({
      miningReprocessLocationId: null,
      miningReprocessLocationKind: null,
      miningReprocessFacility: normalizeMiningReprocessFacility({
        ...facility,
        hull,
        rig: hull === 'npc' ? 'none' : facility.rig,
      }),
    })
    setOpen(false)
  }

  function selectLocation(location: ProductionLocation) {
    const hull = miningReprocessHullFromLocation(location.kind, location.structureTypeId)
    onChange({
      miningReprocessLocationId: location.locationId,
      miningReprocessLocationKind: location.kind,
      miningReprocessFacility: normalizeMiningReprocessFacility({
        ...facility,
        hull,
        space: miningReprocessSpaceFromSystem(systems, location.solarSystemId, facility.space),
        rig: hull === 'npc' ? 'none' : facility.rig,
      }),
    })
    setOpen(false)
  }

  return (
    <div className="w-full min-w-0">
      <div ref={rootRef} className="relative w-full min-w-0">
        <button
          type="button"
          className={`${triggerClass} flex items-center gap-3 w-full overflow-hidden pr-8 text-left ${
            open ? 'input-primary' : ''
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <HullArt hull={triggerHull} slotSize={triggerSlot} />
          <span className="grow min-w-0 truncate text-sm">{triggerLabel}</span>
        </button>
        <span
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-40"
          aria-hidden
        >
          ▾
        </span>

        {open ? (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-eve-border bg-base-200 shadow-lg">
            <div className="sticky top-0 z-10 border-b border-eve-border/60 bg-base-200 p-2">
              <input
                ref={searchRef}
                type="search"
                className={`input input-bordered w-full ${size === 'sm' ? 'input-sm' : ''}`}
                placeholder="Search reprocess locations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Search reprocess locations"
              />
            </div>

            <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
              {noMatches ? (
                <li className="px-3 py-2 text-xs opacity-60">No matching locations.</li>
              ) : null}

              {showLocationSection ? (
                <>
                  {!hasSearch ? (
                    <li className="menu-title px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-50">
                      Your locations
                    </li>
                  ) : null}
                  {!hasAll ? (
                    <li className="px-3 py-2 text-xs text-warning">
                      Missing scopes: {missing.join(', ')}. Re-authorize from the nav bar.
                    </li>
                  ) : isLoading ? (
                    <li className="px-3 py-2 text-xs opacity-60">Loading locations…</li>
                  ) : !hasSearch && locations.length === 0 ? (
                    <li className="px-3 py-2 text-xs opacity-60">
                      No locations found. Run a job or store assets at a station or structure.
                    </li>
                  ) : (
                    filteredLocations.map((location) => {
                      const selected = selectedLocation?.id === location.id
                      const hull = miningReprocessHullFromLocation(
                        location.kind,
                        location.structureTypeId,
                      )
                      return (
                        <li key={location.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                              selected ? 'bg-primary/10 text-primary' : ''
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectLocation(location)}
                          >
                            <HullArt hull={hull} slotSize={optionSlot} />
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{location.name}</span>
                              <span className="ml-1 text-xs opacity-50">
                                {location.kind === 'structure' ? '(structure)' : '(station)'}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </>
              ) : null}

              {showPresetSection ? (
                <>
                  {!hasSearch ? (
                    <li className="menu-title px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-50">
                      Presets
                    </li>
                  ) : null}
                  {filteredPresets.map((hull) => {
                    const selected = !selectedLocation && hull.id === facility.hull
                    return (
                      <li key={hull.id} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                            selected ? 'bg-primary/10 text-primary' : ''
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPreset(hull.id)}
                        >
                          <HullArt hull={hull.id} slotSize={optionSlot} />
                          <span className="font-medium truncate" title={hull.hint}>
                            {hull.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-error mt-1">
          {error instanceof Error ? error.message : 'Failed to load reprocess locations'}
        </p>
      ) : null}
    </div>
  )
}
