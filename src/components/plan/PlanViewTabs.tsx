import type { ReactNode } from 'react'

export type PlanViewTab = 'supply' | 'graph' | 'pipeline'

const TABS: { id: PlanViewTab; label: string; hint: string }[] = [
  { id: 'supply', label: 'Supply chain', hint: 'Build vs buy per node' },
  { id: 'pipeline', label: 'Pipeline', hint: 'Copy, invention, and manufacture steps' },
  { id: 'graph', label: 'Graph', hint: 'Visual production graph' },
]

function TabIcon({ tab }: { tab: PlanViewTab }) {
  if (tab === 'supply') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path
          fillRule="evenodd"
          d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (tab === 'pipeline') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path
          fillRule="evenodd"
          d="M3 4.25A2.25 2.25 0 015.25 2h9.5A2.25 2.25 0 0117 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-9.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h4.5a.75.75 0 010 1.5h-4.5A2.25 2.25 0 013 15.75V4.25zm11.53 5.28a.75.75 0 010 1.06l-2.72 2.72a.75.75 0 11-1.06-1.06l1.44-1.44H8.25a.75.75 0 010-1.5h4.94l-1.44-1.44a.75.75 0 111.06-1.06l2.72 2.72z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path d="M12.232 4.232l2.5 2.5a.75.75 0 01-.53 1.28h-2.914l-4.124 4.123a2.25 2.25 0 01-3.182 0l-.708-.708a2.25 2.25 0 010-3.182l4.124-4.123H5.53a.75.75 0 01-.53-1.28l2.5-2.5a.75.75 0 011.06 0zM11.768 15.768l-2.5-2.5a.75.75 0 01.53-1.28h2.914l4.124-4.123a2.25 2.25 0 013.182 0l.708.708a2.25 2.25 0 010 3.182l-4.124 4.123h2.914a.75.75 0 01.53 1.28l-2.5 2.5a.75.75 0 01-1.06 0z" />
    </svg>
  )
}

interface PlanViewTabsProps {
  active: PlanViewTab
  onChange: (tab: PlanViewTab) => void
  graphActions?: ReactNode
  children: ReactNode
}

export function PlanViewTabs({ active, onChange, graphActions, children }: PlanViewTabsProps) {
  return (
    <section className="plan-view-tabs">
      <div className="plan-view-tabs__bar" role="tablist" aria-label="Plan views">
        <div className="plan-view-tabs__list">
          {TABS.map((tab) => {
            const selected = active === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`plan-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`plan-tabpanel-${tab.id}`}
                title={tab.hint}
                className={`plan-view-tabs__tab${selected ? ' plan-view-tabs__tab--active' : ''}`}
                onClick={() => onChange(tab.id)}
              >
                <TabIcon tab={tab.id} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
        {active === 'graph' && graphActions ? (
          <div className="plan-toolbar shrink-0">{graphActions}</div>
        ) : null}
      </div>
      <div
        className="plan-view-tabs__panel"
        role="tabpanel"
        id={`plan-tabpanel-${active}`}
        aria-labelledby={`plan-tab-${active}`}
      >
        {children}
      </div>
    </section>
  )
}
