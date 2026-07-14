import { useEffect, useRef, useState } from 'react'
import type { StructureType } from '@/types'
import { EveImage } from '@/components/EveImage'
import {
  STRUCTURE_TYPE_IDS,
  STRUCTURE_TYPES,
  structureTypeLabel,
} from '@/lib/structureSettings'

interface StructureTypePickerProps {
  value: StructureType
  onChange: (type: StructureType) => void
  size?: 'md' | 'sm'
  className?: string
}

export function StructureTypePicker({
  value,
  onChange,
  size = 'md',
  className = '',
}: StructureTypePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const triggerSlot = size === 'sm' ? 40 : 44
  const optionSlot = size === 'sm' ? 36 : 40
  const triggerClass =
    size === 'sm'
      ? 'input input-bordered input-sm !h-12 !min-h-12 py-1'
      : 'input input-bordered !h-14 !min-h-14 py-1.5'

  function StructureArt({ type, slotSize }: { type: StructureType; slotSize: number }) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-eve-border bg-base-300/80 shadow-sm"
        style={{ width: slotSize, height: slotSize }}
        aria-hidden
      >
        <EveImage
          id={STRUCTURE_TYPE_IDS[type]}
          variant="render"
          size={slotSize}
          framed={false}
          alt=""
          lazy={false}
          className="max-w-full max-h-full object-contain"
        />
      </span>
    )
  }

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function select(type: StructureType) {
    onChange(type)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative w-full min-w-0 ${className}`}>
      <button
        type="button"
        className={`${triggerClass} flex items-center gap-3 w-full overflow-hidden pr-8 text-left ${
          open ? 'input-primary' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <StructureArt type={value} slotSize={triggerSlot} />
        <span className="grow min-w-0 truncate text-sm">{structureTypeLabel(value)}</span>
      </button>
      <span
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-40"
        aria-hidden
      >
        ▾
      </span>

      {open && (
        <ul
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-eve-border bg-base-200 shadow-lg py-1"
          role="listbox"
        >
          {STRUCTURE_TYPES.map((type) => {
            const selected = type === value
            return (
              <li key={type} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-base-300/80 ${
                    selected ? 'bg-primary/10 text-primary' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(type)}
                >
                  <StructureArt type={type} slotSize={optionSlot} />
                  <span className="font-medium truncate">{structureTypeLabel(type)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
