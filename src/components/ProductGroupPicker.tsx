import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProductGroupCategoryNode } from '@/services/data/sdeLoader'
import { CategoryBadge } from '@/components/CategoryBadge'
import { EveImage } from '@/components/EveImage'
import { NAV_TYPE_IDS } from '@/lib/eveImages'

const ALL_GROUPS_VALUE = 'all'

function filterTree(
  tree: ProductGroupCategoryNode[],
  query: string,
): ProductGroupCategoryNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return tree

  return tree
    .map(({ category, groups }) => ({
      category,
      groups: groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          category.toLowerCase().includes(q) ||
          g.itemNames.some((name) => name.toLowerCase().includes(q)),
      ),
    }))
    .filter((node) => node.groups.length > 0)
}

function findGroupIcon(tree: ProductGroupCategoryNode[], name: string): number | undefined {
  for (const node of tree) {
    const match = node.groups.find((g) => g.name === name)
    if (match) return match.iconTypeId
  }
  return undefined
}

interface ProductGroupPickerProps {
  value: string
  onChange: (value: string) => void
  tree: ProductGroupCategoryNode[]
  className?: string
}

export function ProductGroupPicker({ value, onChange, tree, className = '' }: ProductGroupPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query])
  const totalGroups = useMemo(() => tree.reduce((n, c) => n + c.groups.length, 0), [tree])

  const selectedLabel = value === ALL_GROUPS_VALUE ? 'All groups' : value
  const selectedIconId =
    value === ALL_GROUPS_VALUE ? NAV_TYPE_IDS.blueprints : findGroupIcon(tree, value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function select(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  function openPicker() {
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div ref={rootRef} className={`relative min-w-[min(100%,14rem)] max-w-xs ${className}`}>
      <div
        className={`input input-bordered input-sm flex items-center gap-2 w-full pr-8 ${
          open ? 'input-primary' : ''
        }`}
      >
        {selectedIconId ? (
          <EveImage id={selectedIconId} size={20} framed alt="" lazy={false} />
        ) : null}
        <input
          ref={inputRef}
          type="text"
          className="grow min-w-0 bg-transparent outline-none text-sm"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Search groups or items…"
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
              inputRef.current?.blur()
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
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-eve-border bg-base-200 shadow-lg py-1"
          role="listbox"
        >
          <li role="option" aria-selected={value === ALL_GROUPS_VALUE}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-base-300/80 ${
                value === ALL_GROUPS_VALUE ? 'bg-primary/10 text-primary' : ''
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(ALL_GROUPS_VALUE)}
            >
              <EveImage id={NAV_TYPE_IDS.blueprints} size={20} framed alt="" />
              <span className="font-medium">All groups</span>
              <span className="ml-auto text-xs opacity-50 tabular-nums">{totalGroups}</span>
            </button>
          </li>

          {filteredTree.length === 0 ? (
            <li className="px-3 py-4 text-sm opacity-50 text-center">No groups match</li>
          ) : (
            filteredTree.map(({ category, groups }) => (
              <li key={category}>
                <div className="sticky top-0 z-10 px-3 py-1.5 bg-base-200 border-y border-eve-border/50">
                  <CategoryBadge category={category} />
                </div>
                <ul>
                  {groups.map((group) => (
                    <li key={group.name} role="option" aria-selected={value === group.name}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 pl-5 pr-3 py-2 text-left text-sm hover:bg-base-300/80 ${
                          value === group.name ? 'bg-primary/10 text-primary' : ''
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => select(group.name)}
                      >
                        <EveImage id={group.iconTypeId} size={20} framed alt="" />
                        <span className="truncate">{group.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
