import type { MiningRankedRow, TimeRange } from '@/types'
import { miningVolumeLabel, spaceLabel } from '@/lib/miningIph'
import { EveImage } from '@/components/EveImage'
import { formatDecimal, formatIsk, formatQuantity } from '@/lib/profit'
import { appRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'

interface MiningIphBreakdownModalProps {
  row: MiningRankedRow | null
  m3PerHr: number
  reprocessYield: number
  focusTypeId: number | null
  window: TimeRange
  onClose: () => void
}

export function MiningIphBreakdownModal({
  row,
  m3PerHr,
  reprocessYield,
  focusTypeId,
  window,
  onClose,
}: MiningIphBreakdownModalProps) {
  if (!row) return null

  const { item } = row
  const itemHref = appRoute(`item/${item.typeId}`)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-eve-border bg-base-200/60 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <EveImage id={item.typeId} size={40} alt="" className="rounded shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg truncate">{item.name}</h3>
              <p className="text-xs opacity-60 mt-0.5">
                {item.foundIn.map(spaceLabel).join(' ')} · {formatDecimal(m3PerHr, 0)} m³/hr ·{' '}
                {formatDecimal(reprocessYield * 100, 0)}% reprocess yield
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1 min-h-0">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <PathStat label="Raw ISK/hr" value={row.rawIph} detail={`${formatIsk(row.rawValuePerM3)}/m³`} />
            <PathStat
              label="Compressed ISK/hr"
              value={row.compressedIph}
              detail={
                row.compressedValuePerM3 != null
                  ? `${formatIsk(row.compressedValuePerM3)}/m³`
                  : 'No compressed type'
              }
            />
            <PathStat
              label="Reprocess ISK/hr"
              value={row.mineralsIph}
              detail={`${formatIsk(row.mineralsValuePerM3)}/m³`}
            />
          </section>

          {row.reprocessLines.length > 0 ? (
            <section>
              <h4 className="text-sm font-semibold mb-2">Reprocess outputs</h4>
              <div className="overflow-x-auto rounded-lg border border-eve-border">
                <table className="table table-compact w-full">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="text-right">Qty/m³</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">ISK/hr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.reprocessLines
                      .slice()
                      .sort((a, b) => b.iskPerHr - a.iskPerHr)
                      .map((line) => {
                      const focused = focusTypeId != null && line.typeId === focusTypeId
                      return (
                        <tr
                          key={line.typeId}
                          className={focused ? 'bg-primary/10' : undefined}
                        >
                          <td>
                            <div className="flex items-center gap-2 min-w-0">
                              <EveImage id={line.typeId} size={24} alt="" className="rounded shrink-0" />
                              <span className={focused ? 'font-semibold text-primary' : ''}>
                                {line.name}
                              </span>
                            </div>
                          </td>
                          <td className="text-right tabular-nums">{formatDecimal(line.qtyPerM3, 2)}</td>
                          <td className="text-right tabular-nums">{formatIsk(line.price)}</td>
                          <td className="text-right tabular-nums font-medium">{formatIsk(line.iskPerHr)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <p className="text-sm opacity-60">No reprocess recipe for this item.</p>
          )}

          <p className="text-xs opacity-50">
            Hub {miningVolumeLabel(window)} liquidity: {formatQuantity(row.volDay)} · Raw unit price{' '}
            {formatIsk(row.rawPrice)}
          </p>
        </div>

        <div className="px-5 py-3 border-t border-eve-border bg-base-200/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <a
            href={itemHref}
            target="_blank"
            rel="noopener noreferrer"
            className={textLinkClass('text-sm')}
          >
            Open item page
          </a>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}

function PathStat({
  label,
  value,
  detail,
}: {
  label: string
  value: number | null
  detail: string
}) {
  return (
    <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide opacity-50">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">
        {value == null || value <= 0 ? '—' : formatIsk(value)}
      </p>
      <p className="text-[11px] opacity-60 mt-1">{detail}</p>
    </div>
  )
}
