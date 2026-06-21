import { useEffect, useMemo, useRef, useState } from 'react'
import type { RegionsData, SystemInfo } from '@/types'

const MAX_RESULTS = 20

interface ManufacturingSystemPickerProps {
  value: number
  onChange: (systemId: number) => void
  systems: SystemInfo[]
  regions: RegionsData
  className?: string
}

function securityColor(security: number): string {
  if (security >= 0.5) return 'text-success'
  if (security > 0) return 'text-warning'
  return 'text-error'
}

function formatSecurity(security: number): string {
  return security.toFixed(1)
}

function formatCostIndex(costIndex: number | undefined): string {
  if (costIndex === undefined) return ''
  return `${(costIndex * 100).toFixed(2)}%`
}

export function ManufacturingSystemPicker({
  value,
  onChange,
  systems,
  regions,
  className = '',
}: ManufacturingSystemPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const regionNameById = useMemo(
    () => new Map(regions.regions.map((r) => [r.regionId, r.name])),
    [regions],
  )

  const selected = systems.find((s) => s.systemId === value)
  const selectedLabel = selected ? selected.name : `System ${value}`

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return systems
      .filter((s) => {
        const regionName = regionNameById.get(s.regionId) ?? ''
        return s.name.toLowerCase().includes(q) || regionName.toLowerCase().includes(q)
      })
      .slice(0, MAX_RESULTS)
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
    onChange(systemId)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={`relative min-w-[min(100%,14rem)] max-w-xs ${className}`}>
      <div
        className={`input input-bordered input-sm flex items-center gap-2 w-full pr-8 ${
          open ? 'input-primary' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          className="grow min-w-0 bg-transparent outline-none text-sm"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Search system or region…"
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
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
      </div>
      <span
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-40"
        aria-hidden
      >
        ▾
      </span>

      {open && (
        <ul
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-eve-border bg-base-200 shadow-lg"
          role="listbox"
        >
          {query.trim().length === 0 ? (
            <li className="px-3 py-3 text-sm opacity-50 text-center">
              Type to search systems or regions
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm opacity-50 text-center">No systems match</li>
          ) : (
            filtered.map((sys) => {
              const regionName = regionNameById.get(sys.regionId) ?? ''
              const isSelected = sys.systemId === value
              return (
                <li key={sys.systemId} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-base-300/80 ${
                      isSelected ? 'bg-primary/10 text-primary' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(sys.systemId)}
                  >
                    <span className="font-medium truncate">{sys.name}</span>
                    <span className="ml-auto flex items-center gap-2 shrink-0 text-xs opacity-60">
                      {sys.costIndex !== undefined && (
                        <span className="tabular-nums">{formatCostIndex(sys.costIndex)}</span>
                      )}
                      <span className={`tabular-nums ${securityColor(sys.security)}`}>
                        {formatSecurity(sys.security)}
                      </span>
                    </span>
                  </button>
                  {regionName && (
                    <div className="px-3 pb-1.5 -mt-1 text-xs opacity-40 truncate">{regionName}</div>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
