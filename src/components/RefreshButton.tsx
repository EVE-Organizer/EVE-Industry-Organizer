import { RefreshIcon } from '@/components/EveAuthIcons'
import { refreshData, type RefreshScope } from '@/lib/refreshCharacterData'
import { useDataStatusStore } from '@/stores/dataStatusStore'

/** Refresh control wired to `refreshData` and global loading state for a scope. */
export function RefreshButton({
  scope,
  characterIds = [],
  label = 'Refresh',
  loadingLabel = 'Refreshing…',
  className = 'btn btn-ghost btn-sm shrink-0 gap-2',
  size = 'sm',
  iconOnly = false,
  onClick,
  afterRefresh,
  planProductionLocationId,
}: {
  scope: RefreshScope
  characterIds?: number[]
  label?: string
  loadingLabel?: string
  className?: string
  size?: 'xs' | 'sm'
  iconOnly?: boolean
  /** Runs before refresh; throw to abort and show an error toast. */
  onClick?: () => void | Promise<void>
  afterRefresh?: () => void | Promise<void>
  planProductionLocationId?: number | null
}) {
  const refreshing = useDataStatusStore(
    (s) => s.refreshing[scope] || (scope !== 'all' && scope !== 'plan' && s.refreshing.all),
  )
  const pushToast = useDataStatusStore((s) => s.pushToast)

  const sizeClass = size === 'xs' ? 'btn-xs' : 'btn-sm'
  const btnClass = className.includes('btn-') ? className : `${className} btn ${sizeClass}`

  return (
    <button
      type="button"
      className={btnClass}
      disabled={refreshing}
      aria-busy={refreshing}
      aria-label={iconOnly ? (refreshing ? loadingLabel : label) : undefined}
      onClick={() => {
        void (async () => {
          try {
            if (onClick) await onClick()
            await refreshData(scope, characterIds, {
              productionLocationId: planProductionLocationId,
            })
            if (afterRefresh) await afterRefresh()
          } catch (err) {
            pushToast(err instanceof Error ? err.message : 'Refresh failed', { tone: 'error' })
          }
        })()
      }}
    >
      {refreshing ? (
        <>
          <span className="loading loading-spinner loading-xs" />
          {!iconOnly ? loadingLabel : null}
        </>
      ) : (
        <>
          <RefreshIcon className="size-3.5" />
          {!iconOnly ? label : null}
        </>
      )}
    </button>
  )
}
