import { CopyNameButton } from '@/components/CopyNameButton'
import { Tooltip } from '@/components/Tooltip'
import { stopRowToggle } from '@/components/plan/PlanTreeLines'
import { appRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'
import type { PlanNode } from '@/types'

function GraphIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="3.5" cy="4" r="1.75" strokeWidth="1.5" />
      <circle cx="12.5" cy="4" r="1.75" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="1.75" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeWidth="1.5" d="M5 5.2 6.8 10.5M11 5.2 9.2 10.5" />
    </svg>
  )
}

function MeTeSettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeWidth="1.5" d="M2 4.5h12M2 8h12M2 11.5h12" />
      <circle cx="5" cy="4.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PlanBlueprintItemName({
  node,
  onOpenGraph,
  onOpenMeTe,
  showMeTeSettings,
}: {
  node: Pick<PlanNode, 'productTypeId' | 'name' | 'canToggle' | 'isRoot' | 'me' | 'te' | 'meTeLocked'>
  onOpenGraph: (productTypeId: number) => void
  onOpenMeTe?: (productTypeId: number) => void
  showMeTeSettings?: boolean
}) {
  const marketHref = appRoute(`item/${node.productTypeId}`)
  const showGraph = node.canToggle || node.isRoot

  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <CopyNameButton text={node.name} onClick={stopRowToggle} />
      <a
        href={marketHref}
        target="_blank"
        rel="noopener noreferrer"
        className={textLinkClass('text-sm truncate leading-snug min-w-0')}
        title={`${node.name} (market)`}
        onClick={stopRowToggle}
      >
        {node.name}
      </a>
      {showGraph ? (
        <Tooltip text="Open production graph" placement="top">
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square shrink-0 min-h-0 h-6 w-6 opacity-70 hover:opacity-100"
            aria-label={`Open production graph for ${node.name}`}
            onClick={(e) => {
              stopRowToggle(e)
              onOpenGraph(node.productTypeId)
            }}
          >
            <GraphIcon className="size-3.5" />
          </button>
        </Tooltip>
      ) : null}
      {showMeTeSettings && onOpenMeTe ? (
        <Tooltip
          text={
            node.me != null && node.te != null
              ? `ME / TE settings (${node.me}/${node.te}${node.meTeLocked ? ', fixed' : ''})`
              : 'ME / TE settings'
          }
          placement="top"
        >
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square shrink-0 min-h-0 h-6 w-6 opacity-70 hover:opacity-100"
            aria-label={`ME and TE settings for ${node.name}`}
            onClick={(e) => {
              stopRowToggle(e)
              onOpenMeTe(node.productTypeId)
            }}
          >
            <MeTeSettingsIcon className="size-3.5" />
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}
