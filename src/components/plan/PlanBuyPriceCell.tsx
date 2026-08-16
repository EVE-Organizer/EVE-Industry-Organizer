import { useEffect, useMemo, useRef, useState } from 'react'
import { formatIsk } from '@/lib/profit'
import { hubDisplayName } from '@/lib/hubDisplay'
import {
  PLAN_DEFAULT_BUY_HUB,
  type PlanBuyPriceSource,
} from '@/lib/planBuyPrices'
import type { HubId, PlanNode, PlanNodeOverride } from '@/types'
import { HUBS } from '@/types'

export function PlanBuyPriceCell({
  node,
  hubPricesByHub,
  defaultBuyHub = PLAN_DEFAULT_BUY_HUB,
  nodeOverride,
  onSetBuyPriceSource,
}: {
  node: PlanNode
  hubPricesByHub: Map<HubId, Map<number, number>>
  defaultBuyHub?: HubId
  nodeOverride?: PlanNodeOverride
  onSetBuyPriceSource?: (productTypeId: number, source: PlanBuyPriceSource | null) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const committedRef = useRef(false)

  const canEdit = onSetBuyPriceSource != null
  const unitPrice = node.unitPrice ?? 0
  const isCustom = nodeOverride?.buyPrice != null && nodeOverride.buyPrice > 0
  const activeHub = isCustom ? null : (nodeOverride?.buyHub ?? defaultBuyHub)
  const defaultHubName = hubDisplayName(defaultBuyHub)
  const sourceLabel = isCustom
    ? 'custom'
    : (activeHub ? hubDisplayName(activeHub) : defaultHubName)

  const hubRows = useMemo(
    () =>
      HUBS.map((hub) => ({
        id: hub.id,
        name: hubDisplayName(hub.id),
        price: hubPricesByHub.get(hub.id)?.get(node.productTypeId) ?? 0,
      })),
    [hubPricesByHub, node.productTypeId],
  )

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function openEditor() {
    committedRef.current = false
    setDraft(unitPrice > 0 ? String(unitPrice) : '')
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function closeEditor() {
    setOpen(false)
    committedRef.current = false
  }

  function commitCustom(fromBlur = false) {
    if (committedRef.current || !onSetBuyPriceSource) return

    const trimmed = draft.trim().replace(/,/g, '')
    if (!trimmed) {
      if (fromBlur) {
        if (unitPrice > 0) {
          committedRef.current = true
          onSetBuyPriceSource(node.productTypeId, null)
        }
        closeEditor()
        return
      }
      committedRef.current = true
      onSetBuyPriceSource(node.productTypeId, null)
      closeEditor()
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      closeEditor()
      return
    }

    committedRef.current = true
    onSetBuyPriceSource(node.productTypeId, { price: Math.round(parsed) })
    closeEditor()
  }

  function selectHub(hubId: HubId) {
    if (!onSetBuyPriceSource) return
    committedRef.current = true
    if (hubId === defaultBuyHub) {
      onSetBuyPriceSource(node.productTypeId, null)
    } else {
      onSetBuyPriceSource(node.productTypeId, { hub: hubId })
    }
    closeEditor()
  }

  const priceFootnote = (
    <>
      {node.buyCost != null && node.buyCost > 0 ? (
        <span className="block text-[10px] opacity-60">{formatIsk(node.buyCost)} total</span>
      ) : null}
    </>
  )

  if (open && canEdit) {
    return (
      <div
        ref={rootRef}
        className="relative flex flex-col items-end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-[7.5rem]">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className="input input-bordered input-xs w-full tabular-nums text-right pr-5"
            placeholder="ISK"
            aria-label="Buy price or hub"
            role="combobox"
            aria-expanded={true}
            aria-autocomplete="list"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitCustom(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCustom()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                closeEditor()
              }
            }}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-40" aria-hidden>
            ▾
          </span>
        </div>
        <ul
          className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-eve-border bg-base-200 shadow-lg"
          role="listbox"
        >
          {hubRows.map((row) => {
            const selected = !isCustom && activeHub === row.id
            return (
              <li key={row.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-base-300/80 ${
                    selected ? 'bg-primary/10 text-primary' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectHub(row.id)}
                >
                  <span className="truncate">{row.name}</span>
                  <span className="tabular-nums shrink-0 opacity-70">
                    {row.price > 0 ? formatIsk(row.price) : '—'}
                  </span>
                </button>
              </li>
            )
          })}
          <li className="px-2.5 py-1.5 text-[10px] opacity-50 border-t border-eve-border">
            Type a custom price in ISK
          </li>
        </ul>
        <span className="text-[10px] opacity-50 mt-0.5">{sourceLabel}</span>
        {priceFootnote}
      </div>
    )
  }

  if (unitPrice > 0) {
    return (
      <div className="tabular-nums text-sm leading-snug">
        {canEdit ? (
          <button
            type="button"
            className="text-left hover:underline decoration-dotted underline-offset-2"
            onClick={(e) => {
              e.stopPropagation()
              openEditor()
            }}
          >
            {formatIsk(unitPrice)}
          </button>
        ) : (
          <span>{formatIsk(unitPrice)}</span>
        )}
        <span className="block text-[10px] opacity-50">{sourceLabel}</span>
        {priceFootnote}
      </div>
    )
  }

  if (canEdit) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="text-xs text-warning hover:underline decoration-dotted underline-offset-2"
          onClick={(e) => {
            e.stopPropagation()
            openEditor()
          }}
        >
          Set price
        </button>
        {priceFootnote}
      </div>
    )
  }

  return <span className="text-sm opacity-40">—</span>
}
