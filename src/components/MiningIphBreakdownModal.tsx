import { useEffect, useState } from 'react'
import type { MiningIphFocusPath } from '@/lib/miningIph'
import type { MiningRankedRow, TimeRange, TypeInfo } from '@/types'
import { MINING_IPH_PATHS, miningVolumeLabel } from '@/lib/miningIph'
import { EveImage } from '@/components/EveImage'
import { MiningSpaceBadges } from '@/components/MiningSpaceBadges'
import { formatDecimal, formatIsk, formatQuantity } from '@/lib/profit'
import { appRoute } from '@/lib/paths'
import { textLinkClass } from '@/lib/textLink'

interface MiningIphBreakdownModalProps {
  row: MiningRankedRow | null
  initialFocusPath?: MiningIphFocusPath
  m3PerHr: number
  reprocessYield: number
  focusTypeId: number | null
  window: TimeRange
  priceMethod: 'sell_orders' | 'buy_orders'
  typeMap: Map<number, TypeInfo>
  onClose: () => void
}

export function MiningIphBreakdownModal({
  row,
  initialFocusPath = 'raw',
  m3PerHr,
  reprocessYield,
  focusTypeId,
  window,
  priceMethod,
  typeMap,
  onClose,
}: MiningIphBreakdownModalProps) {
  const [activePath, setActivePath] = useState<MiningIphFocusPath>(initialFocusPath)

  useEffect(() => {
    if (row) setActivePath(initialFocusPath)
  }, [row?.item.typeId, initialFocusPath, row])

  if (!row) return null

  const { item } = row
  const itemHref = appRoute(`item/${item.typeId}`)
  const priceLabel = priceMethod === 'buy_orders' ? 'buy orders' : 'sell orders'
  const volLabel = miningVolumeLabel(window)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-eve-border bg-base-200/60 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <EveImage id={item.typeId} size={40} alt="" className="rounded shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg truncate">{item.name}</h3>
              <p className="text-xs opacity-60 mt-0.5 inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <MiningSpaceBadges spaces={item.foundIn} />
                <span>
                  · {formatDecimal(m3PerHr, 0)} m³/hr · {formatDecimal(reprocessYield * 100, 0)}%
                  reprocess yield
                </span>
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1 min-h-0">
          <section
            role="tablist"
            aria-label="Valuation path"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            <PathStat
              label={MINING_IPH_PATHS.raw.label}
              value={row.rawIph}
              detail={`${formatIsk(row.rawValuePerM3)}/m³`}
              active={activePath === 'raw'}
              onClick={() => setActivePath('raw')}
            />
            <PathStat
              label={MINING_IPH_PATHS.compressed.label}
              value={row.compressedIph}
              detail={
                row.compressedValuePerM3 != null
                  ? `${formatIsk(row.compressedValuePerM3)}/m³`
                  : 'No compressed type'
              }
              active={activePath === 'compressed'}
              onClick={() => setActivePath('compressed')}
            />
            <PathStat
              label={MINING_IPH_PATHS.minerals.label}
              value={row.mineralsIph}
              detail={`${formatIsk(row.mineralsValuePerM3)}/m³`}
              active={activePath === 'minerals'}
              onClick={() => setActivePath('minerals')}
            />
          </section>

          {activePath === 'raw' ? (
            <RawPathDetail
              row={row}
              m3PerHr={m3PerHr}
              window={window}
              volLabel={volLabel}
              priceLabel={priceLabel}
            />
          ) : activePath === 'compressed' ? (
            <CompressedPathDetail
              row={row}
              m3PerHr={m3PerHr}
              window={window}
              volLabel={volLabel}
              priceLabel={priceLabel}
              typeMap={typeMap}
            />
          ) : (
            <ReprocessPathDetail
              row={row}
              m3PerHr={m3PerHr}
              reprocessYield={reprocessYield}
              focusTypeId={focusTypeId}
              window={window}
              volLabel={volLabel}
              priceLabel={priceLabel}
            />
          )}

          <p className="text-xs opacity-50">
            Hub {volLabel} liquidity: {formatQuantity(row.volDay)} · {priceLabel} · window {window}
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

function RawPathDetail({
  row,
  m3PerHr,
  window,
  volLabel,
  priceLabel,
}: {
  row: MiningRankedRow
  m3PerHr: number
  window: TimeRange
  volLabel: string
  priceLabel: string
}) {
  const { item } = row

  return (
    <section className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">{MINING_IPH_PATHS.raw.label}</h4>
        <p className="text-xs opacity-60 mt-0.5">
          Sell uncompressed at the hub ({priceLabel}, {window} window).
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DetailRow label="Raw unit price" value={formatIsk(row.rawPrice)} />
        <DetailRow label="Unit volume" value={`${formatDecimal(item.volume, 2)} m³`} />
        <DetailRow
          label="Value per m³ mined"
          value={`${formatIsk(row.rawValuePerM3)}/m³`}
          mono={`${formatIsk(row.rawPrice)} ÷ ${formatDecimal(item.volume, 2)} m³`}
        />
        <DetailRow label="Mining rate" value={`${formatDecimal(m3PerHr, 0)} m³/hr`} />
        <DetailRow
          label="ISK/hr"
          value={formatIsk(row.rawIph)}
          mono={`${formatIsk(row.rawValuePerM3)}/m³ × ${formatDecimal(m3PerHr, 0)} m³/hr`}
          highlight
        />
        <DetailRow label={`${volLabel} (raw)`} value={formatQuantity(row.volDayRaw ?? 0)} />
      </dl>
    </section>
  )
}

function CompressedPathDetail({
  row,
  m3PerHr,
  window,
  volLabel,
  priceLabel,
  typeMap,
}: {
  row: MiningRankedRow
  m3PerHr: number
  window: TimeRange
  volLabel: string
  priceLabel: string
  typeMap: Map<number, TypeInfo>
}) {
  const { item } = row
  const compressedId = item.compressedTypeId
  const compressedName =
    compressedId != null
      ? typeMap.get(compressedId)?.name ?? `Type ${compressedId}`
      : null
  const compressedHref = compressedId != null ? appRoute(`item/${compressedId}`) : null

  if (compressedId == null || row.compressedPrice == null || row.compressedValuePerM3 == null) {
    return (
      <section className="rounded-lg border border-eve-border bg-base-300/20 px-4 py-3">
        <h4 className="text-sm font-semibold">{MINING_IPH_PATHS.compressed.label}</h4>
        <p className="text-sm opacity-60 mt-1">This item has no compressed market type.</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">{MINING_IPH_PATHS.compressed.label}</h4>
        <p className="text-xs opacity-60 mt-0.5">
          Same m³/hr as raw, priced as the compressed form ({priceLabel}, {window} window).
        </p>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <EveImage id={compressedId} size={32} alt="" className="rounded shrink-0" />
        {compressedHref ? (
          <a
            href={compressedHref}
            target="_blank"
            rel="noopener noreferrer"
            className={textLinkClass('text-sm font-medium truncate')}
          >
            {compressedName}
          </a>
        ) : (
          <span className="text-sm font-medium truncate">{compressedName}</span>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DetailRow label="Compressed unit price" value={formatIsk(row.compressedPrice)} />
        <DetailRow label="Ore volume" value={`${formatDecimal(item.volume, 2)} m³/unit`} />
        <DetailRow
          label="Value per m³ mined"
          value={`${formatIsk(row.compressedValuePerM3)}/m³`}
          mono={`${formatIsk(row.compressedPrice)} ÷ ${formatDecimal(item.volume, 2)} m³`}
        />
        <DetailRow label="Mining rate" value={`${formatDecimal(m3PerHr, 0)} m³/hr`} />
        <DetailRow
          label="ISK/hr"
          value={row.compressedIph != null ? formatIsk(row.compressedIph) : '—'}
          mono={
            row.compressedIph != null
              ? `${formatIsk(row.compressedValuePerM3)}/m³ × ${formatDecimal(m3PerHr, 0)} m³/hr`
              : undefined
          }
          highlight
        />
        <DetailRow
          label={`${volLabel} (compressed)`}
          value={formatQuantity(row.volDayCompressed ?? 0)}
        />
      </dl>
    </section>
  )
}

function ReprocessPathDetail({
  row,
  m3PerHr,
  reprocessYield,
  focusTypeId,
  window,
  volLabel,
  priceLabel,
}: {
  row: MiningRankedRow
  m3PerHr: number
  reprocessYield: number
  focusTypeId: number | null
  window: TimeRange
  volLabel: string
  priceLabel: string
}) {
  const { item } = row
  const yieldPct = formatDecimal(reprocessYield * 100, 0)

  return (
    <section className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">{MINING_IPH_PATHS.minerals.label}</h4>
        <p className="text-xs opacity-60 mt-0.5">
          Reprocess at {yieldPct}% yield, sell outputs at hub {priceLabel} ({window} window).
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DetailRow label="Portion size" value={`${item.portionSize} units/batch`} />
        <DetailRow label="Unit volume" value={`${formatDecimal(item.volume, 2)} m³`} />
        <DetailRow label="Reprocess yield" value={`${yieldPct}%`} />
        <DetailRow label="Mining rate" value={`${formatDecimal(m3PerHr, 0)} m³/hr`} />
        <DetailRow
          label="Value per m³ mined"
          value={`${formatIsk(row.mineralsValuePerM3)}/m³`}
        />
        <DetailRow
          label="ISK/hr"
          value={formatIsk(row.mineralsIph)}
          mono={`${formatIsk(row.mineralsValuePerM3)}/m³ × ${formatDecimal(m3PerHr, 0)} m³/hr`}
          highlight
        />
        <DetailRow
          label={`${volLabel} (top mineral)`}
          value={formatQuantity(row.volDayMinerals ?? 0)}
        />
      </dl>

      {row.reprocessLines.length > 0 ? (
        <ReprocessTable row={row} focusTypeId={focusTypeId} />
      ) : (
        <p className="text-sm opacity-60">No reprocess recipe for this item.</p>
      )}
    </section>
  )
}

function ReprocessTable({
  row,
  focusTypeId,
}: {
  row: MiningRankedRow
  focusTypeId: number | null
}) {
  return (
    <div>
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
                  <tr key={line.typeId} className={focused ? 'bg-primary/10' : undefined}>
                    <td>
                      <div className="flex items-center gap-2 min-w-0">
                        <EveImage id={line.typeId} size={24} alt="" className="rounded shrink-0" />
                        <span className={focused ? 'font-semibold text-primary' : ''}>{line.name}</span>
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
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  highlight = false,
}: {
  label: string
  value: string
  mono?: string
  highlight?: boolean
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide opacity-50">{label}</dt>
      <dd className={`tabular-nums mt-0.5 ${highlight ? 'font-semibold text-base' : ''}`}>{value}</dd>
      {mono ? <dd className="text-xs font-mono opacity-50 mt-0.5 break-all">{mono}</dd> : null}
    </div>
  )
}

function PathStat({
  label,
  value,
  detail,
  active = false,
  onClick,
}: {
  label: string
  value: number | null
  detail: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`rounded-lg border px-3 py-3 text-left w-full transition-colors cursor-pointer ${
        active
          ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
          : 'border-eve-border bg-base-300/20 hover:bg-base-300/40 hover:border-eve-border/80'
      }`}
      onClick={onClick}
    >
      <p className="text-[11px] uppercase tracking-wide opacity-50">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">
        {value == null || value <= 0 ? '—' : formatIsk(value)}
      </p>
      <p className="text-[11px] opacity-60 mt-1">{detail}</p>
    </button>
  )
}
