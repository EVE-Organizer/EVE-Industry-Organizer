import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { PlanProductIcon, PLAN_ROW_ICON_SIZE } from '@/components/plan/PlanProductIcon'
import type { BlueprintInfo, BlueprintTier, SkillLevels, TypeInfo } from '@/types'
import { isReactionRecipe } from '@/lib/recipes'
import { meetsBuildRequirements } from '@/lib/buildRequirements'

const MAX_RESULTS = 12
const MENU_GAP_PX = 6
const MENU_Z_INDEX = 60

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
  /** Focus the input when mounted (Plan page primary action). */
  autoFocus?: boolean
  /** Larger, higher-contrast field for the Plan compose area. */
  prominent?: boolean
  /** When set, only these tiers appear in search results. */
  tierFilter?: BlueprintTier[]
  /** When set (non-empty), only these product groups appear. */
  groupFilter?: string[]
  /** When true, hide blueprints the current skills cannot build. */
  buildableOnly?: boolean
  skills?: SkillLevels
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

function passesFilters(
  bp: BlueprintInfo,
  tierFilter: BlueprintTier[] | undefined,
  groupFilter: string[] | undefined,
  buildableOnly: boolean | undefined,
  skills: SkillLevels | undefined,
): boolean {
  if (tierFilter && tierFilter.length > 0 && !tierFilter.includes(bp.tier)) return false
  if (groupFilter && groupFilter.length > 0 && !groupFilter.includes(bp.productGroup)) {
    return false
  }
  if (buildableOnly && skills && !meetsBuildRequirements(bp, skills)) return false
  return true
}

export function BlueprintSearchPicker({
  blueprints,
  typeMap,
  favoriteIds = [],
  onSelect,
  className = '',
  placeholder = 'Search blueprint by name…',
  autoFocus = false,
  prominent = false,
  tierFilter,
  groupFilter,
  buildableOnly,
  skills,
}: BlueprintSearchPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!autoFocus) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [autoFocus])

  const eligibleBlueprints = useMemo(
    () =>
      blueprints.filter((bp) =>
        passesFilters(bp, tierFilter, groupFilter, buildableOnly, skills),
      ),
    [blueprints, tierFilter, groupFilter, buildableOnly, skills],
  )

  const blueprintByProduct = useMemo(() => {
    const map = new Map<number, BlueprintInfo>()
    for (const bp of eligibleBlueprints) map.set(bp.productTypeId, bp)
    return map
  }, [eligibleBlueprints])

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
    for (const bp of eligibleBlueprints) {
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
  }, [eligibleBlueprints, typeMap, query])

  const showFavorites = open && query.trim().length < 2 && favorites.length > 0
  const showSearch = open && query.trim().length >= 2
  const showMenu = showFavorites || showSearch
  const items = showFavorites ? favorites : filtered

  const updateMenuPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + MENU_GAP_PX,
      left: rect.left,
      width: rect.width,
      zIndex: MENU_Z_INDEX,
    })
  }, [])

  useLayoutEffect(() => {
    if (!showMenu) return
    updateMenuPosition()
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [showMenu, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
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
      className={`plan-search-wrap${prominent ? ' plan-search-wrap--prominent' : ''}${open ? ' plan-search-wrap--open' : ''} ${className}`}
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
        ref={inputRef}
        type="search"
        className={`plan-search-wrap__input ${open ? 'input-primary' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {showMenu &&
        createPortal(
          <ul
            ref={menuRef}
            className="plan-search-wrap__menu"
            style={menuStyle}
            role="listbox"
          >
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
          </ul>,
          document.body,
        )}
    </div>
  )
}
