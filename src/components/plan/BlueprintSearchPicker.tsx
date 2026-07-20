import { useEffect, useMemo, useRef, useState } from 'react'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import type { BlueprintInfo, TypeInfo } from '@/types'
import { isReactionRecipe } from '@/lib/recipes'

const MAX_RESULTS = 12

type PickerItem = {
  productTypeId: number
  blueprintTypeId: number
  name: string
  group: string
}

interface BlueprintSearchPickerProps {
  blueprints: BlueprintInfo[]
  typeMap: Map<number, TypeInfo>
  favoriteIds?: number[]
  onSelect: (productTypeId: number) => void
  className?: string
  placeholder?: string
}

function buildPickerItem(
  bp: BlueprintInfo,
  typeMap: Map<number, TypeInfo>,
): PickerItem | null {
  const name = typeMap.get(bp.productTypeId)?.name
  if (!name) return null
  return {
    productTypeId: bp.productTypeId,
    blueprintTypeId: bp.blueprintTypeId,
    name,
    group: bp.productGroup,
  }
}

export function BlueprintSearchPicker({
  blueprints,
  typeMap,
  favoriteIds = [],
  onSelect,
  className = '',
  placeholder = 'Search blueprint by name…',
}: BlueprintSearchPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const blueprintByProduct = useMemo(() => {
    const map = new Map<number, BlueprintInfo>()
    for (const bp of blueprints) map.set(bp.productTypeId, bp)
    return map
  }, [blueprints])

  const favorites = useMemo(() => {
    const items: PickerItem[] = []
    for (const productTypeId of favoriteIds) {
      const bp = blueprintByProduct.get(productTypeId)
      if (!bp) continue
      const item = buildPickerItem(bp, typeMap)
      if (item) items.push(item)
    }
    items.sort((a, b) => a.name.localeCompare(b.name))
    return items
  }, [favoriteIds, blueprintByProduct, typeMap])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const results: PickerItem[] = []
    for (const bp of blueprints) {
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
  }, [blueprints, typeMap, query])

  const showFavorites = open && query.trim().length < 2 && favorites.length > 0
  const showSearch = open && query.trim().length >= 2
  const items = showFavorites ? favorites : filtered

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
    <div
      ref={rootRef}
      className={`plan-search-wrap${open ? ' plan-search-wrap--open' : ''} ${className}`}
    >
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
      {(showFavorites || showSearch) && (
        <ul className="plan-search-wrap__menu absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border border-eve-border bg-base-200 p-1 shadow-xl">
          {showFavorites ? (
            <li className="px-2.5 py-1.5 text-[10px] uppercase tracking-wide opacity-40">Favorites</li>
          ) : null}
          {items.length === 0 ? (
            <li className="px-3 py-2 text-xs opacity-50">No blueprints match</li>
          ) : (
            items.map((item) => (
              <li key={item.productTypeId}>
                <button
                  type="button"
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-base-300/80 text-left transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
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
                    <span className="block text-[10px] opacity-50 truncate">
                      {blueprintByProduct.get(item.productTypeId) &&
                      isReactionRecipe(blueprintByProduct.get(item.productTypeId)!)
                        ? 'Reaction'
                        : item.group}
                    </span>
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
