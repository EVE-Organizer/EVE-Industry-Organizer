import { refreshData, type RefreshScope } from '@/lib/refreshCharacterData'
import { useDataStatusStore } from '@/stores/dataStatusStore'

function RefreshIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00-1.449-.39A5.5 5.5 0 003.172 9.69l-.312.311H5.293a.75.75 0 000-1.5H1.061a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 001.449-.39z"
        clipRule="evenodd"
      />
    </svg>
  )
}

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
}) {
  const refreshing = useDataStatusStore(
    (s) => s.refreshing[scope] || (scope !== 'all' && s.refreshing.all),
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
      onClick={() => {
        void (async () => {
          try {
            if (onClick) await onClick()
            await refreshData(scope, characterIds)
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
          <RefreshIcon />
          {!iconOnly ? label : null}
        </>
      )}
    </button>
  )
}

export { RefreshIcon }
