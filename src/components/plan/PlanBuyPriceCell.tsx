import { useRef, useState } from 'react'
import { Tooltip } from '@/components/Tooltip'
import { formatIsk } from '@/lib/profit'
import type { PlanNode } from '@/types'

function BuyPriceInput({
  unitPrice,
  onCommit,
  onCancel,
}: {
  unitPrice: number
  onCommit: (price: number | null) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(unitPrice > 0 ? String(unitPrice) : '')
  const committedRef = useRef(false)

  function commit(fromBlur = false) {
    if (committedRef.current) return

    const trimmed = draft.trim().replace(/,/g, '')
    if (!trimmed) {
      if (fromBlur) {
        if (unitPrice > 0) {
          committedRef.current = true
          onCommit(null)
        } else {
          onCancel()
        }
        return
      }
      committedRef.current = true
      onCommit(null)
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onCancel()
      return
    }

    committedRef.current = true
    onCommit(Math.round(parsed))
  }

  return (
    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        inputMode="numeric"
        className="input input-bordered input-xs w-[6.5rem] tabular-nums text-right"
        placeholder="ISK"
        aria-label="Custom buy price in ISK"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
      />
    </div>
  )
}

export function PlanBuyPriceCell({
  node,
  hubPrices,
  onSetBuyPrice,
}: {
  node: PlanNode
  hubPrices: Map<number, number>
  onSetBuyPrice?: (productTypeId: number, price: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const hubPrice = hubPrices.get(node.productTypeId) ?? 0
  const hasHubPrice = hubPrice > 0
  const unitPrice = node.unitPrice ?? 0
  const isCustom = unitPrice > 0 && !hasHubPrice
  const canEdit = !hasHubPrice && onSetBuyPrice != null

  if (editing && canEdit) {
    return (
      <BuyPriceInput
        key={unitPrice}
        unitPrice={unitPrice}
        onCommit={(price) => {
          onSetBuyPrice!(node.productTypeId, price)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  if (unitPrice > 0) {
    return (
      <div className="tabular-nums text-sm leading-snug">
        {canEdit ? (
          <Tooltip text="No hub price. Click to edit your custom buy price." placement="top">
            <button
              type="button"
              className="text-left hover:underline decoration-dotted underline-offset-2"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
            >
              {formatIsk(unitPrice)}
            </button>
          </Tooltip>
        ) : (
          <span>{formatIsk(unitPrice)}</span>
        )}
        {isCustom ? <span className="block text-[10px] opacity-50">custom</span> : null}
        {node.buyCost != null && node.buyCost > 0 ? (
          <span className="block text-[10px] opacity-60">{formatIsk(node.buyCost)} total</span>
        ) : null}
      </div>
    )
  }

  if (canEdit) {
    return (
      <Tooltip text="No hub price. Set a custom buy price for cost totals." placement="top">
        <button
          type="button"
          className="text-xs text-warning hover:underline decoration-dotted underline-offset-2"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
        >
          Set price
        </button>
      </Tooltip>
    )
  }

  return <span className="text-sm opacity-40">—</span>
}
