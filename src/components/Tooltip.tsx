import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left'

const GAP = 8

function placementStyle(
  placement: TooltipPlacement,
  rect: DOMRect,
): Pick<CSSProperties, 'top' | 'left' | 'transform'> {
  switch (placement) {
    case 'top':
      return {
        top: rect.top - GAP,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%)',
      }
    case 'bottom':
      return {
        top: rect.bottom + GAP,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, 0)',
      }
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - GAP,
        transform: 'translate(-100%, -50%)',
      }
    case 'right':
    default:
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + GAP,
        transform: 'translate(0, -50%)',
      }
  }
}

interface TooltipProps {
  text: string
  placement?: TooltipPlacement
  className?: string
  children: ReactNode
  onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLSpanElement>) => void
}

export function Tooltip({
  text,
  placement = 'right',
  className = '',
  children,
  onClick,
  onKeyDown,
}: TooltipProps) {
  const tooltipId = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    setStyle(placementStyle(placement, anchor.getBoundingClientRect()))
  }, [placement])

  useLayoutEffect(() => {
    if (!visible) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, updatePosition])

  const show = () => setVisible(true)
  const hide = () => setVisible(false)

  return (
    <>
      <span
        ref={anchorRef}
        className={`inline-flex shrink-0 items-center self-center ${className}`}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[9999] max-w-xs rounded-md bg-neutral px-3 py-2 text-left text-xs leading-snug text-neutral-content shadow-lg"
            style={style}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  )
}
