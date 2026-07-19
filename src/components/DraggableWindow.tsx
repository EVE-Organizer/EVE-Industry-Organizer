import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const DEFAULT_WIDTH = 448
const DEFAULT_HEIGHT = 480
const MIN_WIDTH = 220
const MIN_HEIGHT = 160
const MAP_OVERLAY_MARGIN = 12
/** top-3 + search row + gap (matches calc(0.75rem + 2.25rem + 0.5rem)). */
const MAP_OVERLAY_TOP_PX = 56
/** Default width when stacked under search (matches legend max width). */
export const MAP_OVERLAY_DEFAULT_WIDTH_PX = 288

export type MapOverlayPlacement = 'bottomRight' | 'topLeftStack'

interface Frame {
  x: number
  y: number
  w: number
  h: number
}

interface DraggableWindowProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  onFocus?: () => void
  focusLabel?: string
  children: ReactNode
  footer?: ReactNode
  showBackdrop?: boolean
  backdropDismiss?: boolean
  variant?: 'modal' | 'mapOverlay'
  portalRoot?: HTMLElement | null
  overlayPlacement?: MapOverlayPlacement
  accentClass?: string
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  /** Lower panel opacity so the map shows through (map overlays). */
  translucent?: boolean
}

function initialFrame(
  variant: 'modal' | 'mapOverlay',
  placement: MapOverlayPlacement,
  portalRoot: HTMLElement | null,
  defaultWidth: number,
  defaultHeight: number,
): Frame {
  if (variant === 'mapOverlay' && placement === 'topLeftStack') {
    return {
      x: MAP_OVERLAY_MARGIN,
      y: MAP_OVERLAY_TOP_PX,
      w: defaultWidth,
      h: defaultHeight,
    }
  }
  if (variant === 'mapOverlay') {
    const host = portalRoot?.getBoundingClientRect()
    const w = defaultWidth
    const h = defaultHeight
    return {
      x: (host?.width ?? window.innerWidth) - MAP_OVERLAY_MARGIN - w,
      y: (host?.height ?? window.innerHeight) - MAP_OVERLAY_MARGIN - h,
      w,
      h,
    }
  }
  return {
    x: Math.round(window.innerWidth / 2 - defaultWidth / 2),
    y: Math.round(window.innerHeight / 2 - defaultHeight / 2),
    w: defaultWidth,
    h: defaultHeight,
  }
}

export function DraggableWindow({
  title,
  subtitle,
  icon,
  onClose,
  onFocus,
  focusLabel = 'Focus on map',
  children,
  footer,
  showBackdrop = false,
  backdropDismiss = true,
  variant = 'modal',
  portalRoot = null,
  overlayPlacement = 'bottomRight',
  accentClass = '',
  defaultWidth = DEFAULT_WIDTH,
  defaultHeight = DEFAULT_HEIGHT,
  minWidth = MIN_WIDTH,
  minHeight = MIN_HEIGHT,
  maxWidth,
  maxHeight,
  translucent = false,
}: DraggableWindowProps) {
  const isMapOverlay = variant === 'mapOverlay'
  const isTopLeftStack = isMapOverlay && overlayPlacement === 'topLeftStack'
  const [frame, setFrame] = useState<Frame>(() =>
    initialFrame(variant, overlayPlacement, portalRoot, defaultWidth, defaultHeight),
  )
  const interactRef = useRef<{
    mode: 'drag' | 'resize'
    startX: number
    startY: number
    origin: Frame
  } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const clampFrame = (next: Frame): Frame => {
    const host = isMapOverlay && portalRoot ? portalRoot.getBoundingClientRect() : null
    const hostW = host?.width ?? window.innerWidth
    const hostH = host?.height ?? window.innerHeight

    let capW = maxWidth ?? hostW - MAP_OVERLAY_MARGIN * 2
    let capH = maxHeight ?? hostH - MAP_OVERLAY_MARGIN * 2

    if (isTopLeftStack) {
      capW = maxWidth ?? hostW - next.x - MAP_OVERLAY_MARGIN
      capH = maxHeight ?? hostH - next.y - MAP_OVERLAY_MARGIN
    }

    const w = Math.max(minWidth, Math.min(capW, next.w))
    const h = Math.max(minHeight, Math.min(capH, next.h))

    let x = next.x
    let y = next.y
    if (isMapOverlay && host) {
      x = Math.max(MAP_OVERLAY_MARGIN, Math.min(hostW - w - MAP_OVERLAY_MARGIN, x))
      y = Math.max(MAP_OVERLAY_MARGIN, Math.min(hostH - h - MAP_OVERLAY_MARGIN, y))
    }

    return { x, y, w, h }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const interact = interactRef.current
      if (!interact) return

      const dx = e.clientX - interact.startX
      const dy = e.clientY - interact.startY

      if (interact.mode === 'drag') {
        setFrame(
          clampFrame({
            ...interact.origin,
            x: interact.origin.x + dx,
            y: interact.origin.y + dy,
          }),
        )
        return
      }

      setFrame(
        clampFrame({
          ...interact.origin,
          w: interact.origin.w + dx,
          h: interact.origin.h + dy,
        }),
      )
    }

    const onUp = () => {
      interactRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isMapOverlay, isTopLeftStack, portalRoot, minWidth, minHeight, maxWidth, maxHeight])

  const onTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    interactRef.current = {
      mode: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      origin: frame,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    interactRef.current = {
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origin: frame,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const shellClass = isMapOverlay
    ? translucent
      ? `absolute z-20 flex flex-col rounded-lg border border-eve-border/40 bg-base-200/20 backdrop-blur-lg shadow-lg overflow-hidden ${accentClass}`
      : `absolute z-20 flex flex-col rounded-lg border border-eve-border/80 bg-base-200/97 backdrop-blur-sm shadow-lg overflow-hidden ${accentClass}`
    : `fixed z-[101] flex flex-col rounded-xl border border-eve-border/80 bg-base-200 shadow-2xl overflow-hidden ${accentClass}`

  const panel = (
    <div
      role="dialog"
      aria-modal={showBackdrop}
      aria-label={title}
      className={shellClass}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
      }}
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2 border-b border-eve-border/60 cursor-move select-none shrink-0 ${
          isMapOverlay
            ? translucent
              ? 'bg-base-200/10'
              : 'bg-base-200/85'
            : 'bg-base-300'
        }`}
        onPointerDown={onTitlePointerDown}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-xs font-semibold truncate tracking-tight">{title}</p>
          {subtitle ? <p className="text-[10px] opacity-55 truncate">{subtitle}</p> : null}
        </div>
        {onFocus ? (
          <button
            type="button"
            className="btn btn-xs btn-square btn-ghost shrink-0 opacity-70 hover:opacity-100"
            onClick={onFocus}
            aria-label={focusLabel}
            title={focusLabel}
          >
            <FocusMapIcon />
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-xs btn-square btn-ghost shrink-0 opacity-70 hover:opacity-100"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${
          isMapOverlay
            ? translucent
              ? 'bg-transparent'
              : 'bg-base-200/90'
            : 'bg-base-200'
        }`}
      >
        {children}
      </div>

      {footer ? <div className="shrink-0 border-t border-eve-border/60">{footer}</div> : null}

      <div
        role="presentation"
        aria-hidden
        className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-se-resize touch-none"
        onPointerDown={onResizePointerDown}
      >
        <svg
          viewBox="0 0 16 16"
          className="absolute bottom-0.5 right-0.5 h-3 w-3 opacity-40"
          aria-hidden
        >
          <path d="M14 14L6 14L14 6Z" fill="currentColor" />
          <path d="M14 14L10 14L14 10Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  )

  if (isMapOverlay) {
    if (!portalRoot) return null
    return createPortal(panel, portalRoot)
  }

  return createPortal(
    <>
      {showBackdrop ? (
        <div
          className="fixed inset-0 z-[100] bg-black/45"
          aria-hidden
          onClick={backdropDismiss ? onClose : undefined}
        />
      ) : null}
      {panel}
    </>,
    document.body,
  )
}

function FocusMapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  )
}
