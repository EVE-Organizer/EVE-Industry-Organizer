import { CharacterAvatar } from '@/components/EveImage'
import { RefreshButton } from '@/components/RefreshButton'
import { useDataVersion } from '@/hooks/useSdeData'
import { snapshotPriceLabel } from '@/lib/dataSources'
import { useAuthStore } from '@/stores/authStore'
import {
  useDataStatusStore,
  type SourceRefreshStatus,
  type SourceStatus,
} from '@/stores/dataStatusStore'

function agoLabel(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'just now'
  return `${minutes}m ago`
}

function statusBadge(status: SourceRefreshStatus) {
  if (status === 'loading') {
    return <span className="loading loading-spinner loading-xs" aria-label="Loading" />
  }
  const map: Record<Exclude<SourceRefreshStatus, 'loading'>, string> = {
    updated: 'badge-success',
    unchanged: 'badge-ghost',
    'not-yet-updated-by-esi': 'badge-warning',
    failed: 'badge-error',
  }
  const label: Record<Exclude<SourceRefreshStatus, 'loading'>, string> = {
    updated: 'updated',
    unchanged: 'unchanged',
    'not-yet-updated-by-esi': 'ESI pending',
    failed: 'failed',
  }
  return <span className={`badge badge-xs ${map[status]}`}>{label[status]}</span>
}

function SourceRow({ row }: { row: SourceStatus }) {
  return (
    <li className="flex flex-col gap-0.5 py-1.5 border-b border-base-content/5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{row.label}</span>
        {statusBadge(row.status)}
      </div>
      <span className="opacity-60">
        {row.status === 'loading' ? 'Checking…' : `checked ${agoLabel(row.checkedAt)}`}
      </span>
      {row.nextUpdateAt ? (
        <span className="opacity-60">
          ESI next {new Date(row.nextUpdateAt).toLocaleTimeString()}
        </span>
      ) : null}
      {row.detail ? <span className="opacity-70">{row.detail}</span> : null}
      {row.error ? <span className="text-error text-[11px]">{row.error}</span> : null}
    </li>
  )
}

function headerDot(sources: SourceStatus[], refreshing: boolean) {
  if (refreshing) return <span className="loading loading-spinner loading-xs text-primary" />
  if (sources.some((s) => s.status === 'failed')) {
    return <span className="size-2 rounded-full bg-error" aria-hidden />
  }
  if (sources.some((s) => s.status === 'not-yet-updated-by-esi')) {
    return <span className="size-2 rounded-full bg-warning" aria-hidden />
  }
  return null
}

/** Header popover: data sources, freshness, and refresh all. */
export function DataStatusMenu() {
  const sources = useDataStatusStore((s) => s.sources)
  const refreshing = useDataStatusStore((s) => s.refreshing.all || s.refreshing.characters)
  const version = useDataVersion()
  const characters = useAuthStore((s) => s.characters)
  const rows = Object.values(sources)
  const priceRow = sources.prices
  const snapshotRow = sources.snapshot

  const byCharacter = characters.map((character) => ({
    character,
    rows: rows.filter((r) => r.characterId === character.characterId),
  }))

  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        tabIndex={0}
        className="btn btn-ghost btn-xs gap-1.5"
        aria-label="Data status"
      >
        {headerDot(rows, refreshing)}
        <span>Data</span>
      </button>
      <div
        tabIndex={0}
        className="dropdown-content z-50 mt-1 w-80 rounded-box border border-eve-border bg-base-200 p-3 shadow-lg"
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-50 mb-2">Prices</p>
        <p className="text-xs opacity-70 mb-1">
          {snapshotPriceLabel(version.data?.marketGeneratedAt)}
        </p>
        {priceRow ? (
          <p className="text-xs opacity-70 mb-2">
            Live: {priceRow.detail ?? 'not refreshed yet'}
            {priceRow.checkedAt ? ` · ${agoLabel(priceRow.checkedAt)}` : ''}
          </p>
        ) : null}
        {version.updateAvailable ? (
          <button
            type="button"
            className="btn btn-xs btn-warning mb-3 w-full"
            onClick={version.reloadSnapshot}
          >
            New price data available · Reload
          </button>
        ) : null}

        {refreshing ? <progress className="progress progress-primary w-full h-1 mb-3" /> : null}

        {byCharacter.length > 0 ? (
          <div className="flex flex-col gap-3 mb-3">
            {byCharacter.map(({ character, rows: charRows }) =>
              charRows.length > 0 ? (
                <section key={character.characterId}>
                  <div className="flex items-center gap-2 mb-1">
                    <CharacterAvatar
                      characterId={character.characterId}
                      name={character.characterName}
                      size={24}
                    />
                    <span className="text-sm font-medium truncate">{character.characterName}</span>
                  </div>
                  <ul className="text-xs pl-1">
                    {charRows.map((row) => (
                      <SourceRow key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        ) : (
          <ul className="text-xs mb-3">
            {rows.length === 0 ? (
              <li className="opacity-50 py-2">No refresh yet — use Refresh all</li>
            ) : (
              rows.filter((r) => !r.characterId).map((row) => <SourceRow key={row.id} row={row} />)
            )}
          </ul>
        )}

        {snapshotRow ? (
          <p className="text-[11px] opacity-50 mb-2">{snapshotRow.detail ?? 'Snapshot checked'}</p>
        ) : null}

        <RefreshButton
          scope="all"
          characterIds={characters.map((c) => c.characterId)}
          label="Refresh all"
          className="btn btn-primary btn-xs w-full"
        />
      </div>
    </div>
  )
}
