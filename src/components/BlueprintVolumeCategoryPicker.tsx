import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { EveImage } from '@/components/EveImage'
import { formatAvgVolume } from '@/lib/profit'
import {
  activeVolumePreset,
  BLUEPRINT_VOLUME_PRESETS,
  filterVolumePresets,
  type BlueprintVolumePreset,
} from '@/lib/blueprintVolumePresets'

const MENU_GAP_PX = 4
const MENU_Z_INDEX = 60

interface BlueprintVolumeCategoryPickerProps {
  minVolume: number
  onChange: (minVolume: number) => void
  className?: string
}
function PresetIcon({ preset, size = 24 }: { preset: BlueprintVolumePreset; size?: number }) {
  return (
    <EveImage
      id={preset.iconTypeId}
      variant={preset.imageVariant}
      size={size}
      framed
      alt=""
      lazy={false}
    />
  )
}

export function BlueprintVolumeCategoryPicker({
  minVolume,
  onChange,
  className = '',
}: BlueprintVolumeCategoryPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const selectedPreset = useMemo(() => activeVolumePreset(minVolume), [minVolume])

  const filtered = useMemo(() => filterVolumePresets(query), [query])

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + MENU_GAP_PX,
      left: rect.left,
      width: rect.width,
      zIndex: MENU_Z_INDEX,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open, updateMenuPosition])

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
  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  function selectVolume(next: number) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  const triggerLabel = selectedPreset
    ? selectedPreset.label
    : minVolume > 0
      ? 'Custom'
      : 'Any category'

  const triggerDetail =
    minVolume > 0 ? `${formatAvgVolume(minVolume)}/d` : 'No minimum'

  return (
    <div ref={rootRef} className={`blueprint-volume-picker ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"        className={`blueprint-volume-picker__trigger${open ? ' blueprint-volume-picker__trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {selectedPreset ? (
          <PresetIcon preset={selectedPreset} size={22} />
        ) : (
          <span className="blueprint-volume-picker__any-icon" aria-hidden>
            ∅
          </span>
        )}
        <span className="blueprint-volume-picker__trigger-text min-w-0">
          <span className="blueprint-volume-picker__trigger-label truncate">{triggerLabel}</span>
          <span className="blueprint-volume-picker__trigger-detail truncate">{triggerDetail}</span>
        </span>
        <span className="blueprint-volume-picker__chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="blueprint-volume-picker__menu"
              style={menuStyle}
            >
              <input
                ref={inputRef}
                type="text"
                className="blueprint-volume-picker__search input input-bordered input-sm w-full"
                placeholder="Search category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false)
                    setQuery('')
                  }
                  if (e.key === 'Enter') {
                    if (filtered.length > 0) selectVolume(filtered[0]!.minVolume)
                    else if (!query.trim()) selectVolume(0)
                  }
                }}
              />
              <ul className="blueprint-volume-picker__list" role="listbox">
                <li role="option" aria-selected={minVolume <= 0}>
                  <button
                    type="button"
                    className={`blueprint-volume-picker__option${
                      minVolume <= 0 ? ' blueprint-volume-picker__option--active' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectVolume(0)}
                  >
                    <span className="blueprint-volume-picker__any-icon" aria-hidden>
                      ∅
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="blueprint-volume-picker__option-label">Any</span>
                      <span className="blueprint-volume-picker__option-meta">No volume floor</span>
                    </span>
                  </button>
                </li>
                {filtered.map((preset) => {
                  const active = selectedPreset?.id === preset.id
                  return (
                    <li key={preset.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className={`blueprint-volume-picker__option${
                          active ? ' blueprint-volume-picker__option--active' : ''
                        }`}
                        title={preset.tooltip}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectVolume(preset.minVolume)}
                      >
                        <PresetIcon preset={preset} size={28} />
                        <span className="min-w-0 text-left">
                          <span className="blueprint-volume-picker__option-label">{preset.label}</span>
                          <span className="blueprint-volume-picker__option-meta">
                            {formatAvgVolume(preset.minVolume)}/d min
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 ? (
                  <li className="blueprint-volume-picker__empty">No categories match</li>
                ) : null}
              </ul>
              <p className="blueprint-volume-picker__hint">
                {BLUEPRINT_VOLUME_PRESETS.length} categories from Jita 1w liquidity research
              </p>
            </div>,
            document.body,
          )
        : null}    </div>
  )
}
