import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

export const PLAN_TREE_INDENT_PX = 16

export function planTableRowClass(isParent: boolean): string {
  return isParent
    ? 'bg-base-300/35 border-t border-eve-border first:border-t-0 hover:bg-base-300/45'
    : 'hover:bg-base-300/20'
}

interface PlanTreeLinesProps {
  /** Number of ancestor levels (0 = top-level row under a group). */
  depth: number
  isLast: boolean
  /** For each ancestor level, whether the vertical guide continues below this row. */
  continues: boolean[]
}

export function PlanTreeLines({ depth, isLast, continues }: PlanTreeLinesProps) {
  if (depth === 0) return null

  const width = depth * PLAN_TREE_INDENT_PX
  const elbowX = (depth - 1) * PLAN_TREE_INDENT_PX + PLAN_TREE_INDENT_PX / 2

  return (
    <span
      className="relative shrink-0 self-stretch min-h-[2.5rem]"
      style={{ width }}
      aria-hidden
    >
      {continues.map((cont, level) =>
        cont ? (
          <span
            key={`guide-${level}`}
            className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-base-content/35"
            style={{ left: level * PLAN_TREE_INDENT_PX + PLAN_TREE_INDENT_PX / 2 }}
          />
        ) : null,
      )}
      <span
        className="absolute w-px -translate-x-1/2 bg-base-content/35"
        style={{ left: elbowX, top: 0, height: '50%' }}
      />
      <span
        className="absolute h-px bg-base-content/35"
        style={{ left: elbowX, top: '50%', width: PLAN_TREE_INDENT_PX / 2 }}
      />
      {!isLast ? (
        <span
          className="absolute bottom-0 w-px -translate-x-1/2 bg-base-content/35"
          style={{ left: elbowX, top: '50%' }}
        />
      ) : null}
    </span>
  )
}

/** Fixed-width leading slot (16px) for chevrons; lines up with depth-1 tree rows. */
export function PlanTreeLeading({ children }: { children?: ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center self-stretch min-h-[2.5rem]"
      style={{ width: PLAN_TREE_INDENT_PX }}
    >
      {children}
    </span>
  )
}

export function stopRowToggle(e: MouseEvent) {
  e.stopPropagation()
}

export function expandableRowProps(
  expanded: boolean,
  label: string,
  onToggle: () => void,
): {
  role: 'button'
  tabIndex: 0
  'aria-expanded': boolean
  'aria-label': string
  onClick: () => void
  onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => void
} {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-expanded': expanded,
    'aria-label': expanded ? `Collapse ${label}` : `Expand ${label}`,
    onClick: onToggle,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggle()
      }
    },
  }
}

export function PlanExpandableLeading({
  treeDepth,
  isLast,
  continues,
  chevron,
}: {
  treeDepth: number
  isLast: boolean
  continues: boolean[]
  chevron: ReactNode
}) {
  return (
    <div className="flex shrink-0 self-stretch min-h-[2.5rem]">
      {treeDepth > 1 ? (
        <PlanTreeLines depth={treeDepth - 1} isLast={isLast} continues={continues.slice(0, -1)} />
      ) : null}
      <PlanTreeLeading>
        <span className="flex items-center justify-center w-full h-8" aria-hidden>
          {chevron}
        </span>
      </PlanTreeLeading>
    </div>
  )
}
