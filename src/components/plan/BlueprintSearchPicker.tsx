import { useEffect, useMemo, useRef, useState } from 'react'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import type { BlueprintInfo, TypeInfo } from '@/types'

const MAX_RESULTS = 12

interface BlueprintSearchPickerProps {
  blueprints: BlueprintInfo[]
  typeMap: Map<number, TypeInfo>
  excludeIds?: Set<number>
  onSelect: (productTypeId: number) => void
  className?: string
  placeholder?: string
}

export function BlueprintSearchPicker({
  blueprints,
  typeMap,
  excludeIds,
  onSelect,
  className = '',
  placeholder = 'Search blueprint by name…',
}: BlueprintSearchPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const results: { productTypeId: number; blueprintTypeId: number; name: string; group: string }[] = []
    for (const bp of blueprints) {
      if (excludeIds?.has(bp.productTypeId)) continue
      const name = typeMap.get(bp.productTypeId)?.name ?? ''
      if (!name.toLowerCase().includes(q)) continue
      results.push({
        productTypeId: bp.productTypeId,
        blueprintTypeId: bp.blueprintTypeId,
        name,
        group: bp.productGroup,
      })
      if (results.length >= MAX_RESULTS) break
    }
    results.sort((a, b) => a.name.localeCompare(b.name))
    return results
  }, [blueprints, typeMap, excludeIds, query])

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

  function select(productTypeId: number) {
    onSelect(productTypeId)
    setOpen(false)
    setQuery('')
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
      <input
        type="search"
        className={`plan-search-wrap__input ${open ? 'input-primary' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border border-eve-border bg-base-200 p-1 shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs opacity-50">No blueprints match</li>
          ) : (
            filtered.map((item) => (
              <li key={item.productTypeId}>
                <button
                  type="button"
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-base-300/80 text-left transition-colors"
                  onClick={() => select(item.productTypeId)}
                >
                  <PlanProductIcon
                    productTypeId={item.productTypeId}
                    blueprintTypeId={item.blueprintTypeId}
                    size={PLAN_ROW_ICON_SIZE}
                    alt={item.name}
                    lazy={false}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">{item.name}</span>
                    <span className="block text-[10px] opacity-50 truncate">{item.group}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
