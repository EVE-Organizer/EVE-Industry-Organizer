import { useEffect, useRef, useState } from 'react'
import type { ManufacturingRigTier } from '@/types'

export interface RigComboOption {
  value: 'none' | 't1' | 't2'
  label: string
}

interface RigTierComboboxProps {
  ariaLabel: string
  selected: ManufacturingRigTier
  selectedLabel: string
  options: RigComboOption[]
  seedDraft: string
  customHint: string
  size?: 'md' | 'sm'
  onPick: (value: 'none' | 't1' | 't2') => void
  onCommitDraft: (raw: string) => void
}

export function RigTierCombobox({
  ariaLabel,
  selected,
  selectedLabel,
  options,
  seedDraft,
  customHint,
  size = 'md',
  onPick,
  onCommitDraft,
}: RigTierComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(seedDraft)
  const committedRef = useRef(false)

  const fieldClass = size === 'sm' ? 'input input-bordered input-sm' : 'input input-bordered'

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function openEditor() {
    committedRef.current = false
    setDraft(seedDraft)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function commitDraft() {
    if (committedRef.current) return
    committedRef.current = true
    onCommitDraft(draft)
    setOpen(false)
  }

  function pick(value: 'none' | 't1' | 't2') {
    committedRef.current = true
    onPick(value)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative min-w-0" onClick={(e) => e.stopPropagation()}>
      {open ? (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              className={`${fieldClass} w-full min-w-0 tabular-nums pr-5`}
              aria-label={ariaLabel}
              role="combobox"
              aria-expanded
              aria-autocomplete="list"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitDraft()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                }
              }}
            />
            <span
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-40"
              aria-hidden
            >
              ▾
            </span>
          </div>
          <ul
            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-eve-border bg-base-200 shadow-lg"
            role="listbox"
          >
            {options.map((option) => {
              const isSelected = selected === option.value
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-xs hover:bg-base-300/80 ${
                      isSelected ? 'bg-primary/10 text-primary' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
            <li className="px-2.5 py-1.5 text-[10px] opacity-50 border-t border-eve-border">
              {customHint}
            </li>
          </ul>
        </>
      ) : (
        <button
          type="button"
          className={`${fieldClass} w-full min-w-0 text-left truncate`}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          onClick={openEditor}
        >
          {selectedLabel}
        </button>
      )}
    </div>
  )
}
