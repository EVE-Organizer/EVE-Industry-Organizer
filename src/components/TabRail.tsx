import { useRef, useState, type ReactNode } from 'react'

export interface TabRailItem {
  id: string
  label: ReactNode
  icon?: ReactNode
  count?: number
}

interface TabRailProps {
  items: TabRailItem[]
  selectedId: string
  onSelect: (id: string) => void
  onReorder?: (fromId: string, toId: string) => void
  ariaLabel: string
  emptyMessage?: ReactNode
}

const TAB_DRAG_TYPE = 'text/plain'

export function TabRail({ items, selectedId, onSelect, onReorder, ariaLabel, emptyMessage }: TabRailProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const skipClickRef = useRef(false)
  const canReorder = !!onReorder && items.length > 1

  if (items.length === 0) {
    return emptyMessage ? <>{emptyMessage}</> : null
  }

  return (
    <div className="plan-template-rail" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.id === selectedId
        const isDropTarget = canReorder && dragOverId === item.id && draggingId !== item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            draggable={canReorder}
            title={canReorder ? 'Drag to reorder' : undefined}
            className={`plan-template-btn${selected ? ' plan-template-btn--active' : ''}${
              draggingId === item.id ? ' opacity-50' : ''
            }${isDropTarget ? ' plan-template-btn--drop-target' : ''}${
              canReorder ? ' cursor-grab active:cursor-grabbing' : ''
            }`}
            onClick={() => {
              if (skipClickRef.current) {
                skipClickRef.current = false
                return
              }
              onSelect(item.id)
            }}
            onDragStart={
              canReorder
                ? (e) => {
                    skipClickRef.current = true
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(TAB_DRAG_TYPE, item.id)
                    setDraggingId(item.id)
                  }
                : undefined
            }
            onDragOver={
              canReorder
                ? (e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverId !== item.id) setDragOverId(item.id)
                  }
                : undefined
            }
            onDragLeave={
              canReorder
                ? (e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverId((id) => (id === item.id ? null : id))
                    }
                  }
                : undefined
            }
            onDrop={
              canReorder
                ? (e) => {
                    e.preventDefault()
                    const fromId = e.dataTransfer.getData(TAB_DRAG_TYPE)
                    setDraggingId(null)
                    setDragOverId(null)
                    if (fromId && fromId !== item.id) onReorder?.(fromId, item.id)
                  }
                : undefined
            }
            onDragEnd={() => {
              setDraggingId(null)
              setDragOverId(null)
            }}
          >
            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
            <span className="truncate max-w-[12rem] sm:max-w-none">{item.label}</span>
            {item.count != null ? (
              <span className="plan-template-btn__count">{item.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
