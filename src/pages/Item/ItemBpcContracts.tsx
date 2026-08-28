import type { BpcContractSummary } from '@/types'
import { formatIsk } from '@/lib/profit'
import { Panel } from '@/components/Panel'
import { ItemMetric } from '@/pages/Item/ItemMetric'

interface ItemBpcContractsProps {
  title?: string
  summary: BpcContractSummary | null
  snapshotAge?: string
  hubName: string
  className?: string
  embedded?: boolean
}

function formatExpires(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

export function ItemBpcContracts({
  title,
  summary,
  snapshotAge,
  hubName,
  className,
  embedded,
}: ItemBpcContractsProps) {
  const listings = summary?.listings ?? []

  const body = (
    <>
      {snapshotAge ? (
        <p className="text-[11px] text-base-content/45 mb-2">
          Public BPC contracts in {hubName} from snapshot ({snapshotAge}).
        </p>
      ) : null}

      {!summary || listings.length === 0 ? (
        <p className="text-sm text-base-content/50">
          No BPC contracts indexed for this blueprint in {hubName}.
        </p>
      ) : (
        <>
          <dl className={`${embedded ? 'item-section__metrics mb-2' : 'item-section__metrics'}`}>
            <ItemMetric
              variant={embedded ? 'inline' : 'card'}
              label="Listings"
              value={summary.count}
            />
            <ItemMetric
              variant={embedded ? 'inline' : 'card'}
              label="From"
              tone={summary.minBuyout > 0 ? 'primary' : 'neutral'}
              value={summary.minBuyout > 0 ? formatIsk(summary.minBuyout) : '—'}
              hint="lowest buyout"
            />
          </dl>
          <div className="item-data-table">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th>Buyout</th>
                  <th>ME</th>
                  <th>TE</th>
                  <th>Runs</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((row) => (
                  <tr key={row.contractId}>
                    <td>{formatIsk(row.buyout > 0 ? row.buyout : row.price)}</td>
                    <td>{row.me}</td>
                    <td>{row.te}</td>
                    <td>{row.runs}</td>
                    <td>{formatExpires(row.expires)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )

  if (embedded) return body

  return (
    <Panel title={title ?? 'BPC contracts'} className={className}>
      {body}
    </Panel>
  )
}
