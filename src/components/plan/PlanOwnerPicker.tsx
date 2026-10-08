import { useEffect, useRef, useState } from 'react'
import { CharacterAvatar } from '@/components/EveImage'
import { Tooltip } from '@/components/Tooltip'
import type { PlanCharacterKey } from '@/types'

export interface PlanOwnerOption {
  key: PlanCharacterKey
  name: string
  /** Set for SSO characters so the EVE portrait loads. Manual characters show an initial. */
  characterId?: number
}

function ShuffleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M13.5 3a.75.75 0 000 1.5h1.19l-3.2 3.2.9.9L15.5 5.4v1.1a.75.75 0 001.5 0V3.75A.75.75 0 0016.25 3H13.5zM3.5 5a.75.75 0 000 1.5h1.8c.4 0 .78.2 1 .53l5.3 7.94a2.75 2.75 0 002.29 1.23h1.6l-1.2 1.2.9.9 2.6-2.6-2.6-2.6-.9.9 1.2 1.2h-1.6c-.4 0-.78-.2-1-.53L7.6 6.1A2.75 2.75 0 005.3 4.87H3.5z" />
    </svg>
  )
}

/** Avatar icon menu for picking who builds a job. Empty value means Auto (the planner assigns). */
export function PlanOwnerPicker({
  options,
  value,
  onChange,
  disabled = false,
  size = 28,
  label,
  emptyLabel = 'Auto',
}: {
  options: PlanOwnerOption[]
  value?: PlanCharacterKey
  onChange: (key: PlanCharacterKey | undefined) => void
  disabled?: boolean
  size?: number
  label: string
  /** Shown when no character is selected (e.g. Settings for seller fees). */
  emptyLabel?: string
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const selected = options.find((option) => option.key === value)

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle() {
    if (disabled) return
    // The jobs table scrolls, so the menu is fixed to the trigger instead of clipped inside it
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left })
    setOpen((prev) => !prev)
  }

  function pick(key: PlanCharacterKey | undefined) {
    onChange(key)
    setOpen(false)
  }

  const triggerName = selected ? selected.name : emptyLabel
  return (
    <div className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <Tooltip text={`${label}: ${triggerName}`} placement="top">
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-ghost btn-xs btn-circle p-0 border border-eve-border/60"
          style={{ width: size, height: size, minHeight: size }}
          aria-label={`${label}: ${triggerName}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={toggle}
        >
          {selected ? (
            <CharacterAvatar
              key={selected.characterId ?? selected.key}
              characterId={selected.characterId}
              name={selected.name}
              size={size - 2}
            />
          ) : (
            <ShuffleIcon />
          )}
        </button>
      </Tooltip>
      {open ? (
        <ul
          ref={menuRef}
          role="listbox"
          className="fixed z-50 min-w-44 overflow-hidden rounded-lg border border-eve-border bg-base-200 py-1 shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          <li role="option" aria-selected={!selected}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-base-300/80 ${
                !selected ? 'bg-primary/10 text-primary' : ''
              }`}
              onClick={() => pick(undefined)}
            >
              <span className="inline-flex items-center justify-center size-6 rounded-full border border-eve-border/60">
                <ShuffleIcon className="w-3.5 h-3.5" />
              </span>
              <span>{emptyLabel}</span>
            </button>
          </li>
          {options.map((option) => (
            <li key={option.key} role="option" aria-selected={option.key === value}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-base-300/80 ${
                  option.key === value ? 'bg-primary/10 text-primary' : ''
                }`}
                onClick={() => pick(option.key)}
              >
                <CharacterAvatar characterId={option.characterId} name={option.name} size={24} />
                <span className="truncate">{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
