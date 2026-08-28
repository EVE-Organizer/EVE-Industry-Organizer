import { useState, type ReactNode } from 'react'
import { Tooltip } from '@/components/Tooltip'
import type { PlanBuildMode } from '@/types'

/** Shared width/height for Source column mode controls. */
export const PLAN_MODE_BUTTON_CLASS =
  'inline-flex h-7 w-[6rem] shrink-0 items-center justify-center gap-1 rounded-md border text-xs font-medium normal-case'

function BuildIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.885.06 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  )
}

function ModeFace({ mode, label }: { mode: PlanBuildMode; label?: string }) {
  const isBuild = mode === 'build'
  return (
    <>
      {isBuild ? <BuildIcon /> : <CartIcon />}
      <span className="whitespace-nowrap">{label ?? (isBuild ? 'Build' : 'Buy')}</span>
    </>
  )
}

function hoverLabel(mode: PlanBuildMode): string {
  return mode === 'build' ? 'To Buy' : 'To Build'
}

export function PlanModeLockedMarket({ lockIcon }: { lockIcon: ReactNode }) {
  return (
    <span
      className={`${PLAN_MODE_BUTTON_CLASS} bg-base-200/50 text-base-content/55 border-eve-border cursor-default pointer-events-none`}
    >
      {lockIcon}
      Market
    </span>
  )
}

export function PlanModeToggle({
  mode,
  onClick,
}: {
  mode: PlanBuildMode
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isBuild = mode === 'build'
  const previewMode: PlanBuildMode = isBuild ? 'buy' : 'build'
  const tooltip = hovered
    ? hoverLabel(mode)
    : isBuild
      ? 'Building in-house'
      : 'Buying from market'

  const restingClass =
    'bg-base-200/50 text-base-content/70 border-eve-border hover:bg-base-300/55'
  const hoverAccent = isBuild
    ? 'hover:text-warning hover:border-warning/40'
    : 'hover:text-success hover:border-success/40'

  return (
    <Tooltip text={tooltip} placement="left">
      <button
        type="button"
        className={`group/mode relative ${PLAN_MODE_BUTTON_CLASS} overflow-hidden transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.97] ${restingClass} ${hoverAccent}`}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={isBuild ? 'Switch to buy from market' : 'Switch to build in-house'}
      >
        <span className="absolute inset-0 flex items-center justify-center gap-1 transition-all duration-200 ease-out group-hover/mode:opacity-0 group-hover/mode:scale-90 group-hover/mode:blur-[1px]">
          <ModeFace mode={mode} />
        </span>
        <span className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 scale-90 blur-[1px] transition-all duration-200 ease-out group-hover/mode:opacity-100 group-hover/mode:scale-100 group-hover/mode:blur-0">
          <ModeFace mode={previewMode} label={hoverLabel(mode)} />
        </span>
        <span className="invisible inline-flex items-center gap-1" aria-hidden>
          <BuildIcon />
          <span>To Build</span>
        </span>
      </button>
    </Tooltip>
  )
}
