import { useEffect, useMemo, useRef, useState } from 'react'
import { EveImage } from '@/components/EveImage'
import { useAuthStore } from '@/stores/authStore'
import { useAuthScopes } from '@/hooks/useAuthScopes'
import { useProductionLocations } from '@/hooks/useCharacterIndustryData'
import { findProductionLocation } from '@/lib/productionLocations'
import { structureTypeFromTypeId } from '@/lib/structureTypeFromTypeId'
import {
  patchStructureType,
  STRUCTURE_TYPE_IDS,
  STRUCTURE_TYPES,
  structureTypeLabel,
} from '@/lib/structureSettings'
import type { GlobalSettings, ProductionLocation, StructureType } from '@/types'

interface ManufacturingLocationPickerProps {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  size?: 'sm' | 'md'
  /** Show buy-list inventory hint when a character station is selected (Plan page). */
  showInventoryHint?: boolean
}

function LocationArt({
  structureType,
  slotSize,
}: {
  structureType: StructureType
  slotSize: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-eve-border bg-base-300/80 shadow-sm"
      style={{ width: slotSize, height: slotSize }}
      aria-hidden
    >
      <EveImage
        id={STRUCTURE_TYPE_IDS[structureType]}
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

function locationStructureType(location: ProductionLocation): StructureType {
  return structureTypeFromTypeId(location.structureTypeId)
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

export function ManufacturingLocationPicker({
  settings,
  onChange,
  size = 'md',
  showInventoryHint = false,
}: ManufacturingLocationPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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
        settings.productionLocationId,
        settings.productionLocationKind,
      ),
    [locations, settings.productionLocationId, settings.productionLocationKind],
  )

  const triggerLabel = selectedLocation
    ? selectedLocation.name
    : structureTypeLabel(settings.structureType)

  const triggerStructureType = selectedLocation
    ? locationStructureType(selectedLocation)
    : settings.structureType

  const filteredLocations = useMemo(() => {
    const q = query.trim()
    if (!q) return locations
    return locations.filter((location) => matchesQuery(location.name, q))
  }, [locations, query])

  const filteredPresets = useMemo(() => {
    const q = query.trim()
    if (!q) return STRUCTURE_TYPES
    return STRUCTURE_TYPES.filter((type) => matchesQuery(structureTypeLabel(type), q))
  }, [query])

  const showCharacterLocations = configured && activeCharacterId != null
  const hasSearch = query.trim().length > 0
  const showLocationSection =
    showCharacterLocations && (!hasSearch || filteredLocations.length > 0 || isLoading || !hasAll)
  const showPresetSection = !hasSearch || filteredPresets.length > 0
  const noMatches =
    hasSearch && filteredLocations.length === 0 && filteredPresets.length === 0

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
    if (settings.productionLocationId == null || isLoading) return
    if (selectedLocation) return
    onChange({ productionLocationId: null, productionLocationKind: null })
  }, [
    activeCharacterId,
    isLoading,
    onChange,
    selectedLocation,
    settings.productionLocationId,
  ])

  // Keep build system aligned when a saved character location loads asynchronously.
  useEffect(() => {
    if (settings.productionLocationId == null || isLoading || !selectedLocation) return
    const systemId = selectedLocation.solarSystemId
    if (systemId <= 0 || settings.manufacturingSystemId === systemId) return
    onChange({ manufacturingSystemId: systemId })
  }, [
    isLoading,
    onChange,
    selectedLocation,
    settings.manufacturingSystemId,
    settings.productionLocationId,
  ])

  function selectPreset(type: StructureType) {
    onChange({
      productionLocationId: null,
      productionLocationKind: null,
      ...patchStructureType(type),
    })
    setOpen(false)
  }

  function selectLocation(location: ProductionLocation) {
    onChange({
      productionLocationId: location.locationId,
      productionLocationKind: location.kind,
      manufacturingSystemId: location.solarSystemId || settings.manufacturingSystemId,
      ...patchStructureType(locationStructureType(location)),
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
          <LocationArt structureType={triggerStructureType} slotSize={triggerSlot} />
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
                placeholder="Search locations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Search manufacturing locations"
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
                      No build locations found. Run a job, store assets, or keep blueprints at a
                      station.
                    </li>
                  ) : (
                    filteredLocations.map((location) => {
                      const selected = selectedLocation?.id === location.id
                      const structureType = locationStructureType(location)
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
                            <LocationArt structureType={structureType} slotSize={optionSlot} />
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
                  {filteredPresets.map((type) => {
                    const selected = !selectedLocation && type === settings.structureType
                    return (
                      <li key={type} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                            selected ? 'bg-primary/10 text-primary' : ''
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPreset(type)}
                        >
                          <LocationArt structureType={type} slotSize={optionSlot} />
                          <span className="font-medium truncate">{structureTypeLabel(type)}</span>
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
          {error instanceof Error ? error.message : 'Failed to load manufacturing locations'}
        </p>
      ) : null}

      {showInventoryHint && selectedLocation ? (
        <p className="text-[11px] opacity-60 mt-1">
          Buy-list inventory matches {selectedLocation.name} for the nav bar character.
        </p>
      ) : null}
    </div>
  )
}
