import type { Column } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import type { BuildBlueprintRow } from '@/pages/Plan/planJobsTableTypes'

type PinLayer = 'head' | 'body'

/** Opaque fills — sticky cells must not use alpha or scrolling columns show through. */
const PINNED_BODY_BG = '#161b22'
const PINNED_HEAD_BG = '#21262d'

function pinningZIndex(column: Column<BuildBlueprintRow, unknown>, layer: PinLayer): number {
  const pinned = column.getIsPinned()
  const head = layer === 'head' ? 10 : 0
  if (pinned === 'left') return 2 + head
  if (pinned === 'right') {
    if (column.id === 'actions') return 4 + head
    if (column.id === 'margin') return 3 + head
    return 2 + head
  }
  return 0
}

/** Sticky offsets from TanStack column pinning (left product, right margin/actions). */
export function planJobsPinningStyles(
  column: Column<BuildBlueprintRow, unknown>,
  layer: PinLayer = 'body',
): CSSProperties {
  const size = column.getSize()
  const base: CSSProperties = {
    width: size,
    minWidth: size,
    maxWidth: size,
  }

  const pinned = column.getIsPinned()
  if (!pinned) return base

  const isLastLeft = pinned === 'left' && column.getIsLastColumn('left')
  /** Leftmost column in the right pin group (margin) — faces scrolling middle columns. */
  const isRightEdge = pinned === 'right' && column.getIsFirstColumn('right')

  const shadows: string[] = []
  if (isLastLeft) {
    shadows.push('8px 0 16px -4px rgb(0 0 0 / 0.65)', '2px 0 0 rgb(0 0 0 / 0.25)')
  }
  if (isRightEdge) {
    shadows.push('-8px 0 16px -4px rgb(0 0 0 / 0.65)', '-2px 0 0 rgb(0 0 0 / 0.25)')
  }

  return {
    ...base,
    position: 'sticky',
    left: pinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: pinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    zIndex: pinningZIndex(column, layer),
    backgroundColor: pinned ? (layer === 'head' ? PINNED_HEAD_BG : PINNED_BODY_BG) : undefined,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : undefined,
  }
}
