import { useEffect, useMemo, useRef, useState } from 'react'
import type { RegionsData } from '@/types'
import type { MapSystem } from '@/types/map'

const MAX_RESULTS = 20

interface MapSystemSearchProps {
  systems: MapSystem[]
  regions?: RegionsData
  onSelect: (systemId: number) => void
  className?: string
  variant?: 'inline' | 'overlay'
}

function matchScore(systemName: string, regionName: string, query: string): number | null {
  const name = systemName.toLowerCase()
  const region = regionName.toLowerCase()
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  if (region === query) return 3
  if (region.startsWith(query)) return 4
  if (region.includes(query)) return 5
  return null
}

function securityColor(security: number): string {
  if (security >= 0.5) return 'text-success'
  if (security > 0) return 'text-warning'
  return 'text-error'
}

function formatSecurity(security: number): string {
  return security.toFixed(1)
}

export function MapSystemSearch({
  systems,
  regions,
  onSelect,
  className = '',
  variant = 'inline',
}: MapSystemSearchProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const regionNameById = useMemo(
    () => new Map(regions?.regions.map((r) => [r.regionId, r.name]) ?? []),
    [regions],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return systems
      .map((system) => {
        const regionName = regionNameById.get(system.regionId) ?? ''
        const score = matchScore(system.name, regionName, q)
        return score === null ? null : { system, regionName, score }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.score - b.score || a.system.name.localeCompare(b.system.name))
      .slice(0, MAX_RESULTS)
      .map((row) => row.system)
  }, [systems, regionNameById, query])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function select(systemId: number) {
    onSelect(systemId)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const isOverlay = variant === 'overlay'

  const input = (
    <input
      ref={inputRef}
      type="search"
      className={
        isOverlay
          ? 'map-system-search__input'
          : `plan-search-wrap__input input-xs !h-8 !min-h-8 !text-xs ${open ? 'input-primary' : ''}`
      }
      role="combobox"
      aria-expanded={open}
      aria-autocomplete="list"
      placeholder={isOverlay ? 'System or region…' : 'Search system or region…'}
      value={query}
      onChange={(e) => {
        setQuery(e.target.value)
        setOpen(true)
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false)
          setQuery('')
          inputRef.current?.blur()
        }
        if (e.key === 'Enter' && filtered.length > 0) {
          select(filtered[0]!.systemId)
        }
      }}
    />
  )

  const menu =
    open && query.trim().length > 0 ? (
      <ul
        className={
          isOverlay
            ? 'map-system-search__menu'
            : 'absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-eve-border bg-base-200 shadow-lg'
        }
        role="listbox"
      >
        {filtered.length === 0 ? (
          <li className="px-2.5 py-1.5 text-[11px] opacity-50 text-center">No systems match</li>
        ) : (
          filtered.map((sys) => {
            const regionName = regionNameById.get(sys.regionId) ?? ''
            return (
              <li key={sys.systemId} role="option">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-[11px] hover:bg-base-300/80"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(sys.systemId)}
                >
                  <span className="font-medium truncate">{sys.name}</span>
                  <span className="ml-auto flex items-center gap-2 shrink-0 opacity-60">
                    {regionName ? <span className="max-w-[5rem] truncate">{regionName}</span> : null}
                    <span className={`tabular-nums ${securityColor(sys.security)}`}>
                      {formatSecurity(sys.security)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    ) : null

  if (isOverlay) {
    return (
      <div ref={rootRef} className={`map-system-search--overlay ${className}`}>
        <div className="map-system-search__field">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="map-system-search__icon h-3.5 w-3.5 shrink-0 opacity-45"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          {input}
        </div>
        {menu}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={`plan-search-wrap ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="plan-search-wrap__icon"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
      {input}
      {menu}
    </div>
  )
}
