import type { ReactNode } from 'react'

export type PlanChainSectionTone = 'manufacture' | 'buy' | 'info'

const TONE_STYLES: Record<PlanChainSectionTone, { shell: string; badge: string }> = {
  manufacture: {
    shell: 'border-success/25 bg-gradient-to-b from-success/[0.07] to-base-200/20',
    badge: 'badge-success badge-outline border-success/40',
  },
  buy: {
    shell: 'border-warning/25 bg-gradient-to-b from-warning/[0.06] to-base-200/20',
    badge: 'badge-warning badge-outline border-warning/40',
  },
  info: {
    shell: 'border-info/25 bg-gradient-to-b from-info/[0.07] to-base-200/20',
    badge: 'badge-info badge-outline border-info/40',
  },
}

export function PlanChainSection({
  tone,
  title,
  count,
  summary,
  actions,
  embedded,
  children,
}: {
  tone: PlanChainSectionTone
  title: string
  count: number
  summary?: ReactNode
  actions?: ReactNode
  /** Flatter style when nested inside another card (e.g. build blueprints). */
  embedded?: boolean
  children: ReactNode
}) {
  const style = TONE_STYLES[tone]

  if (embedded) {
    return (
      <section className="plan-chain-embedded">
        <div className="plan-chain-embedded__header">
          <h3 className="plan-chain-embedded__title">{title}</h3>
          <span className={`badge badge-xs ${style.badge}`}>{count}</span>
          {summary ? (
            <p className="plan-chain-embedded__summary tabular-nums">{summary}</p>
          ) : null}
          {actions ? <div className="flex items-center gap-1 ml-auto">{actions}</div> : null}
        </div>
        <div className="overflow-x-auto">{children}</div>
      </section>
    )
  }

  return (
    <section className={`rounded-lg border ${style.shell} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 border-b border-eve-border/70 bg-base-300/30">
        <h3 className="text-sm font-semibold leading-none">{title}</h3>
        <span className={`badge badge-xs ${style.badge}`}>{count}</span>
        {summary ? (
          <p className="text-[11px] opacity-55 tabular-nums leading-none">{summary}</p>
        ) : null}
        {actions ? <div className="flex items-center gap-1 ml-auto">{actions}</div> : null}
      </div>
      <div className="overflow-x-auto px-2 py-1">{children}</div>
    </section>
  )
}

export function PlanSectionExpandActions({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void
  onCollapseAll: () => void
}) {
  return (
    <>
      <button type="button" className="btn btn-ghost btn-xs" onClick={onExpandAll}>
        Expand all
      </button>
      <button type="button" className="btn btn-ghost btn-xs" onClick={onCollapseAll}>
        Collapse all
      </button>
    </>
  )
}
