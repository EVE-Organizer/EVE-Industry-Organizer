import type { ReactNode } from 'react'

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
  ariaLabel: string
  emptyMessage?: ReactNode
}

export function TabRail({ items, selectedId, onSelect, ariaLabel, emptyMessage }: TabRailProps) {
  if (items.length === 0) {
    return emptyMessage ? <>{emptyMessage}</> : null
  }

  return (
    <div className="plan-template-rail" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`plan-template-btn${selected ? ' plan-template-btn--active' : ''}`}
            onClick={() => onSelect(item.id)}
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
