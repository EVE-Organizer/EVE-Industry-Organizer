import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EveImage } from '@/components/EveImage'
import type { ProductionLocation } from '@/types'

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

function LocationArt({ typeId, slotSize }: { typeId: number; slotSize: number }) {
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

interface LocationComboboxProps<TPreset> {
  size?: 'sm' | 'md'
  triggerTypeId: number
  triggerLabel: string
  searchPlaceholder: string
  searchAriaLabel: string
  locations: ProductionLocation[]
  selectedLocation?: ProductionLocation | null
  locationTypeId: (location: ProductionLocation) => number
  locationDetail: (location: ProductionLocation) => string
  onSelectLocation: (location: ProductionLocation) => void
  presets: TPreset[]
  presetKey: (preset: TPreset) => string
  presetLabel: (preset: TPreset) => string
  presetTypeId: (preset: TPreset) => number
  presetSelected: (preset: TPreset) => boolean
  presetHint?: (preset: TPreset) => string | undefined
  onSelectPreset: (preset: TPreset) => void
  showCharacterLocations: boolean
  isLoading: boolean
  hasAll: boolean
  missing: string[]
  error?: unknown
  locationsHeading: string
  emptyLocations: string
  errorFallback: string
  listClassName?: string
  children?: ReactNode
}

export function LocationCombobox<TPreset>({
  size = 'md',
  triggerTypeId,
  triggerLabel,
  searchPlaceholder,
  searchAriaLabel,
  locations,
  selectedLocation,
  locationTypeId,
  locationDetail,
  onSelectLocation,
  presets,
  presetKey,
  presetLabel,
  presetTypeId,
  presetSelected,
  presetHint,
  onSelectPreset,
  showCharacterLocations,
  isLoading,
  hasAll,
  missing,
  error,
  locationsHeading,
  emptyLocations,
  errorFallback,
  listClassName = 'max-h-[min(36rem,70vh)]',
  children,
}: LocationComboboxProps<TPreset>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredLocations = useMemo(() => {
    const q = query.trim()
    if (!q) return locations
    return locations.filter((location) => matchesQuery(location.name, q))
  }, [locations, query])

  const filteredPresets = useMemo(() => {
    const q = query.trim()
    if (!q) return presets
    return presets.filter((preset) => matchesQuery(presetLabel(preset), q))
  }, [presets, presetLabel, query])

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

  function pickLocation(location: ProductionLocation) {
    onSelectLocation(location)
    setOpen(false)
  }

  function pickPreset(preset: TPreset) {
    onSelectPreset(preset)
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
          <LocationArt typeId={triggerTypeId} slotSize={triggerSlot} />
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
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={searchAriaLabel}
              />
            </div>

            <ul className={`${listClassName} overflow-y-auto py-1`} role="listbox">
              {noMatches ? (
                <li className="px-3 py-2 text-xs opacity-60">No matching locations.</li>
              ) : null}

              {showLocationSection ? (
                <>
                  {!hasSearch ? (
                    <li className="menu-title px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-50">
                      {locationsHeading}
                    </li>
                  ) : null}
                  {!hasAll ? (
                    <li className="px-3 py-2 text-xs text-warning">
                      Missing scopes: {missing.join(', ')}. Re-authorize from the nav bar.
                    </li>
                  ) : isLoading ? (
                    <li className="px-3 py-2 text-xs opacity-60">Loading locations…</li>
                  ) : !hasSearch && locations.length === 0 ? (
                    <li className="px-3 py-2 text-xs opacity-60">{emptyLocations}</li>
                  ) : (
                    filteredLocations.map((location) => {
                      const selected = selectedLocation?.id === location.id
                      return (
                        <li key={location.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                              selected ? 'bg-primary/10 text-primary' : ''
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickLocation(location)}
                          >
                            <LocationArt typeId={locationTypeId(location)} slotSize={optionSlot} />
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{location.name}</span>
                              <span className="ml-1 text-xs opacity-50">
                                {locationDetail(location)}
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
                  {filteredPresets.map((preset) => {
                    const selected = presetSelected(preset)
                    return (
                      <li key={presetKey(preset)} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                            selected ? 'bg-primary/10 text-primary' : ''
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickPreset(preset)}
                        >
                          <LocationArt typeId={presetTypeId(preset)} slotSize={optionSlot} />
                          <span className="font-medium truncate" title={presetHint?.(preset)}>
                            {presetLabel(preset)}
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
          {error instanceof Error ? error.message : errorFallback}
        </p>
      ) : null}

      {children}
    </div>
  )
}
