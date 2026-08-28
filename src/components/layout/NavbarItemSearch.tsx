import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EveImage } from '@/components/EveImage'
import { useSdeData } from '@/hooks/useSdeData'
import { buildTypeMap } from '@/services/data/sdeLoader'
import {
  loadRecentItemSearchIds,
  MAX_RECENT_ITEM_SEARCHES,
  recordRecentItemSearch,
} from '@/lib/recentItemSearch'
import type { TypeInfo } from '@/types'

const MAX_RESULTS = 12
const ICON_SIZE = 32

type PickerItem = {
  typeId: number
  name: string
  group: string
}

function toPickerItem(type: TypeInfo): PickerItem {
  return {
    typeId: type.typeId,
    name: type.name,
    group: type.group,
  }
}

export function NavbarItemSearch({ className = '' }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data: sde } = useSdeData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentIds, setRecentIds] = useState(loadRecentItemSearchIds)

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])

  const recentItems = useMemo(() => {
    const items: PickerItem[] = []
    for (const typeId of recentIds) {
      const type = typeMap.get(typeId)
      if (!type) continue
      items.push(toPickerItem(type))
      if (items.length >= MAX_RECENT_ITEM_SEARCHES) break
    }
    return items
  }, [recentIds, typeMap])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !sde) return []
    const results: PickerItem[] = []
    for (const type of sde.types) {
      if (!type.name.toLowerCase().includes(q)) continue
      results.push(toPickerItem(type))
    }
    results.sort((a, b) => a.name.localeCompare(b.name))
    return results.slice(0, MAX_RESULTS)
  }, [sde, query])

  const showRecent = open && query.trim().length < 2
  const showSearch = open && query.trim().length >= 2
  const items = showRecent ? recentItems : filtered

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

  function select(typeId: number) {
    setRecentIds(recordRecentItemSearch(typeId))
    navigate(`/item/${typeId}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      ref={rootRef}
      className={`navbar-item-search plan-search-wrap${open ? ' plan-search-wrap--open' : ''} ${className}`}
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
        className={`plan-search-wrap__input input input-bordered input-xs ${open ? 'text-primary' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={sde ? 'Search items…' : 'Loading items…'}
        disabled={!sde}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {(showRecent || showSearch) && (
        <ul className="navbar-item-search__menu">
          {showRecent ? (
            <li className="px-2.5 py-1.5 text-[10px] uppercase tracking-wide opacity-40">Recent</li>
          ) : null}
          {items.length === 0 ? (
            <li className="px-3 py-2 text-xs opacity-50">
              {showRecent ? 'No recent searches' : 'No items match'}
            </li>
          ) : (
            items.map((item) => (
              <li key={item.typeId}>
                <button
                  type="button"
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-base-300/80 text-left transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(item.typeId)}
                >
                  <EveImage id={item.typeId} size={ICON_SIZE} framed alt={item.name} lazy={false} />
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
