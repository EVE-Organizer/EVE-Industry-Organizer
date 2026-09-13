import { useState, type ReactNode } from 'react'
import { Tooltip } from '@/components/Tooltip'

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
          {summary ? <p className="plan-chain-embedded__summary tabular-nums">{summary}</p> : null}
          {actions ? <div className="flex items-center gap-2 ml-auto">{actions}</div> : null}
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
        {actions ? <div className="flex items-center gap-2 ml-auto">{actions}</div> : null}
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

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.25 5.75h5.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-5.5A1.25 1.25 0 0 1 5 12.5v-5.5a1.25 1.25 0 0 1 1.25-1.25Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 10.25V4.75A1.25 1.25 0 0 1 5 3.5h5.5"
      />
    </svg>
  )
}

export function PlanCopyMultibuyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const label = copied ? 'Copied' : 'Copy multibuy'
  const hint = text ? 'Copy To buy lines for in-game Multibuy (Ctrl+V)' : 'Nothing left to buy'

  return (
    <Tooltip text={copied ? 'Copied' : hint} placement="top">
      <button
        type="button"
        className={`btn btn-sm gap-1.5 font-semibold shadow-sm ${
          copied ? 'btn-success' : 'btn-warning'
        }`}
        disabled={!text}
        aria-label={copied ? 'Multibuy list copied' : hint}
        onClick={() => void copy()}
      >
        <CopyIcon className="size-3.5 shrink-0" />
        {label}
      </button>
    </Tooltip>
  )
}
