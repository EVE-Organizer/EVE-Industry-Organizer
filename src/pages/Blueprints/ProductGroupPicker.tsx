import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProductGroupCategoryNode, ProductGroupEntry } from '@/services/data/sdeLoader'
import { CategoryBadge } from '@/pages/Blueprints/CategoryBadge'
import { EveImage } from '@/components/EveImage'
import { NAV_TYPE_IDS } from '@/lib/eveImages'

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

function allGroupNames(tree: ProductGroupCategoryNode[]): string[] {
  return tree.flatMap((node) => node.groups.map((g) => g.name))
}

function categoryIconId(groups: ProductGroupEntry[]): number | undefined {
  return groups[0]?.iconTypeId
}

function selectionState(
  names: string[],
  selected: Set<string>,
): 'none' | 'some' | 'all' {
  if (names.length === 0) return 'none'
  const count = names.filter((name) => selected.has(name)).length
  if (count === 0) return 'none'
  if (count === names.length) return 'all'
  return 'some'
}

function TriStateCheckbox({
  state,
  onChange,
  label,
  className = '',
}: {
  state: 'none' | 'some' | 'all'
  onChange: () => void
  label: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])

  return (
    <label className={`flex items-center cursor-pointer min-w-0 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="checkbox-compact"
        checked={state === 'all'}
        onChange={onChange}
        aria-label={label}
      />
    </label>
  )
}

interface ProductGroupPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  tree: ProductGroupCategoryNode[]
  className?: string
  variant?: 'dropdown' | 'panel'
}

function toggleNames(current: string[], names: string[], select: boolean): string[] {
  const set = new Set(current)
  for (const name of names) {
    if (select) set.add(name)
    else set.delete(name)
  }
  return [...set]
}

function CollapsibleGroupList({
  value,
  onChange,
  filteredTree,
  totalGroups,
  tree,
  query,
}: {
  value: string[]
  onChange: (value: string[]) => void
  filteredTree: ProductGroupCategoryNode[]
  totalGroups: number
  tree: ProductGroupCategoryNode[]
  query: string
}) {
  const selected = useMemo(() => new Set(value), [value])
  const visibleNames = useMemo(() => allGroupNames(filteredTree), [filteredTree])
  const allNames = useMemo(() => allGroupNames(tree), [tree])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (query.trim()) {
      setExpanded(new Set(filteredTree.map((n) => n.category)))
      return
    }
    if (value.length === 1) {
      for (const node of tree) {
        if (node.groups.some((g) => g.name === value[0])) {
          setExpanded(new Set([node.category]))
          return
        }
      }
    }
    setExpanded(new Set())
  }, [query, filteredTree, tree, value])

  function toggleCategory(groups: ProductGroupEntry[]) {
    const names = groups.map((g) => g.name)
    const state = selectionState(names, selected)
    onChange(toggleNames(value, names, state !== 'all'))
  }

  function toggleGroup(name: string) {
    onChange(toggleNames(value, [name], !selected.has(name)))
  }

  function toggleCategoryOpen(category: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const visibleState = selectionState(visibleNames, selected)
  const allState = selectionState(allNames, selected)

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-eve-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TriStateCheckbox
            state={query.trim() ? visibleState : allState}
            onChange={() => {
              const names = query.trim() ? visibleNames : allNames
              const state = selectionState(names, selected)
              onChange(toggleNames(value, names, state !== 'all'))
            }}
            label={query.trim() ? 'Select visible groups' : 'Select all groups'}
          />
          <span className="text-xs font-medium truncate">
            {value.length === 0 ? 'All groups' : `${value.length} selected`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onChange(query.trim() ? [...new Set([...value, ...visibleNames])] : [...allNames])}
          >
            Select all
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="py-1">
        {filteredTree.length === 0 ? (
          <li className="px-3 py-3 text-sm opacity-50 text-center">No groups match</li>
        ) : (
          filteredTree.map(({ category, groups }) => {
            const isOpen = expanded.has(category)
            const headerIconId = categoryIconId(groups)
            const catState = selectionState(
              groups.map((g) => g.name),
              selected,
            )
            return (
              <li key={category} className="border-t border-eve-border/40 first:border-t-0">
                <div className="flex w-full items-center gap-1 px-2 py-1.5 hover:bg-base-300/50">
                  <button
                    type="button"
                    className="flex items-center justify-center w-5 h-5 shrink-0 text-[10px] opacity-50 hover:opacity-80"
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${category}`}
                    onClick={() => toggleCategoryOpen(category)}
                  >
                    <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                  </button>
                  <TriStateCheckbox
                    state={catState}
                    onChange={() => toggleCategory(groups)}
                    label={`Toggle ${category}`}
                  />
                  {headerIconId ? (
                    <EveImage id={headerIconId} size={20} framed alt="" lazy={false} />
                  ) : null}
                  <CategoryBadge category={category} />
                  <span className="ml-auto text-xs opacity-40 tabular-nums pr-1">{groups.length}</span>
                </div>

                {isOpen && (
                  <ul>
                    {groups.map((group) => (
                      <li key={group.name}>
                        <label
                          className={`flex w-full items-center gap-1.5 pl-8 pr-3 py-1.5 text-left text-sm hover:bg-base-300/80 cursor-pointer ${
                            selected.has(group.name) ? 'bg-primary/10 text-primary' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="checkbox-compact"
                            checked={selected.has(group.name)}
                            onChange={() => toggleGroup(group.name)}
                          />
                          <EveImage
                            id={group.iconTypeId}
                            size={20}
                            framed
                            alt=""
                            lazy={false}
                          />
                          <span className="truncate">{group.name}</span>
                          {group.recipeKinds.length === 1 &&
                          group.recipeKinds[0] === 'reaction' ? (
                            <span className="badge badge-xs badge-outline badge-info shrink-0">
                              Formula
                            </span>
                          ) : group.recipeKinds.includes('reaction') &&
                            group.recipeKinds.includes('manufacturing') ? (
                            <span className="badge badge-xs badge-ghost shrink-0">Both</span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })
        )}
      </ul>

      {totalGroups > 0 && value.length > 0 && value.length < totalGroups ? (
        <p className="px-3 py-1.5 text-[11px] opacity-45 border-t border-eve-border/40">
          Ranking limited to selected groups. Clear to show all {totalGroups} groups.
        </p>
      ) : null}
    </div>
  )
}

function ProductGroupPanel({
  value,
  onChange,
  tree,
  className = '',
}: Omit<ProductGroupPickerProps, 'variant'>) {
  const [query, setQuery] = useState('')
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query])
  const totalGroups = useMemo(() => tree.reduce((n, c) => n + c.groups.length, 0), [tree])

  return (
    <div className={`flex flex-col min-h-0 min-w-0 gap-2 ${className}`}>
      <label className="input input-bordered input-sm flex items-center gap-2 w-full shrink-0">
        <span className="text-xs opacity-40 shrink-0" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          className="grow min-w-0 bg-transparent outline-none text-sm"
          placeholder="Search groups or items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search product groups"
        />
      </label>

      <div className="max-h-52 overflow-y-auto rounded-lg border border-eve-border bg-base-200/40 scrollbar-thin">
        <CollapsibleGroupList
          value={value}
          onChange={onChange}
          filteredTree={filteredTree}
          totalGroups={totalGroups}
          tree={tree}
          query={query}
        />
      </div>
    </div>
  )
}

function selectionLabel(value: string[]): string {
  if (value.length === 0) return 'All groups'
  if (value.length === 1) return value[0]!
  return `${value.length} groups`
}

function ProductGroupDropdown({
  value,
  onChange,
  tree,
  className = '',
}: Omit<ProductGroupPickerProps, 'variant'>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query])
  const totalGroups = useMemo(() => tree.reduce((n, c) => n + c.groups.length, 0), [tree])

  const selectedIconId =
    value.length === 1
      ? tree.flatMap((n) => n.groups).find((g) => g.name === value[0])?.iconTypeId
      : NAV_TYPE_IDS.blueprints

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
          value={open ? query : selectionLabel(value)}
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
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-eve-border bg-base-200 shadow-lg">
          <CollapsibleGroupList
            value={value}
            onChange={onChange}
            filteredTree={filteredTree}
            totalGroups={totalGroups}
            tree={tree}
            query={query}
          />
        </div>
      )}
    </div>
  )
}

export function ProductGroupPicker({
  variant = 'dropdown',
  ...props
}: ProductGroupPickerProps) {
  if (variant === 'panel') return <ProductGroupPanel {...props} />
  return <ProductGroupDropdown {...props} />
}
