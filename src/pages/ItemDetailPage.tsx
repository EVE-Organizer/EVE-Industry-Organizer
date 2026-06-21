import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import { buildTypeMap, buildPriceMap, getBlueprintForProduct, getBlueprintForBpo, getAllBlueprints, getHubMarket } from '@/services/data/sdeLoader'
import { getMarketHistory, getPrice } from '@/services/market/marketService'
import { filterHistoryByRange, formatIsk, formatDecimal } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import type { MarketHistoryEntry, TimeRange } from '@/types'
import { PageHeader, LoadingState, LastUpdated } from '@/components/Layout'
import { EveImage } from '@/components/EveImage'
import { Panel } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'

export function ItemDetailPage() {
  const { typeId } = useParams()
  const settings = useAppStore((s) => s.userData.settings)
  const { data: sde, isLoading } = useSdeData()
  const [price, setPrice] = useState<number>()
  const [priceSource, setPriceSource] = useState<string>()
  const [priceFetchedAt, setPriceFetchedAt] = useState<number>()
  const [productPrice, setProductPrice] = useState<number>()
  const [history, setHistory] = useState<MarketHistoryEntry[]>([])
  const [historySource, setHistorySource] = useState<string>()
  const [historyFetchedAt, setHistoryFetchedAt] = useState<number>()
  const [chartRange, setChartRange] = useState<TimeRange>('1m')
  const [loadingLive, setLoadingLive] = useState(true)

  const numericId = Number(typeId ?? 0)

  const typeInfo = useMemo(() => {
    if (!sde) return undefined
    return buildTypeMap(sde.types).get(numericId)
  }, [sde, numericId])

  const blueprint = useMemo(() => {
    if (!sde) return undefined
    const all = getAllBlueprints(sde.registry)
    return getBlueprintForProduct(all, numericId) ?? getBlueprintForBpo(all, numericId)
  }, [sde, numericId])

  const isBpoPage = blueprint?.blueprintTypeId === numericId
  const historyTypeId = isBpoPage && blueprint ? blueprint.productTypeId : numericId
  const manufacturedProduct = useMemo(() => {
    if (!sde || !blueprint) return undefined
    return buildTypeMap(sde.types).get(blueprint.productTypeId)
  }, [sde, blueprint])

  const staticHubPrice = useMemo(() => {
    if (!sde) return undefined
    const hubMarket = getHubMarket(sde.market, settings.primaryHub)
    if (!hubMarket) return undefined
    return buildPriceMap(hubMarket).get(numericId)
  }, [sde, settings.primaryHub, numericId])

  useEffect(() => {
    if (!typeId || !typeInfo) return
    let cancelled = false
    setLoadingLive(true)

    ;(async () => {
      const pricePromise = getPrice(numericId, settings.primaryHub)
      const historyPromise = getMarketHistory(historyTypeId, settings.primaryHub, 'all')
      const productPricePromise =
        isBpoPage && blueprint
          ? getPrice(blueprint.productTypeId, settings.primaryHub)
          : Promise.resolve(null)

      const [priceResult, historyResult, productPriceResult] = await Promise.all([
        pricePromise,
        historyPromise,
        productPricePromise,
      ])
      if (cancelled) return
      setPrice(priceResult.price)
      setPriceSource(priceResult.source)
      setPriceFetchedAt(priceResult.fetchedAt)
      if (productPriceResult) {
        setProductPrice(productPriceResult.price)
      } else {
        setProductPrice(undefined)
      }
      setHistory(historyResult.history)
      setHistorySource(historyResult.source)
      setHistoryFetchedAt(historyResult.fetchedAt)
      setLoadingLive(false)
    })()

    return () => {
      cancelled = true
    }
  }, [typeId, typeInfo, numericId, historyTypeId, settings.primaryHub, isBpoPage, blueprint])

  const chartHistory = useMemo(
    () => filterHistoryByRange(history, chartRange),
    [history, chartRange],
  )

  const avgPrice = useMemo(() => {
    if (!chartHistory.length) return 0
    return chartHistory.reduce((s, h) => s + h.average, 0) / chartHistory.length
  }, [chartHistory])

  const avgVolume = useMemo(() => {
    if (!chartHistory.length) return 0
    return chartHistory.reduce((s, h) => s + h.volume, 0) / chartHistory.length
  }, [chartHistory])

  const displayPrice = price && price > 0 ? price : (staticHubPrice ?? 0)

  if (isLoading) return <LoadingState />
  if (!typeInfo) return <p className="text-sm opacity-60">Item not found.</p>

  return (
    <div>
      <PageHeader
        title={typeInfo.name}
        subtitle={
          isBpoPage
            ? `${typeInfo.group} · ${tierLabel(blueprint!.tier)} blueprint`
            : `${typeInfo.group} · ${typeInfo.category}${blueprint ? ` · ${tierLabel(blueprint.tier)} BPO` : ''}`
        }
        action={
          <LastUpdated
            fetchedAt={priceFetchedAt ?? historyFetchedAt}
            source={priceSource ?? historySource}
          />
        }
      />

      <div className="flex flex-wrap gap-4 mb-6 items-start">
        <EveImage
          id={typeInfo.typeId}
          variant={isBpoPage ? 'bp' : 'icon'}
          productTypeId={isBpoPage ? blueprint?.productTypeId : undefined}
          size={64}
          framed
          alt={typeInfo.name}
        />
        <div className="flex flex-wrap gap-3">
          <StatCard
            label={isBpoPage ? 'BPO hub sell order' : 'Sell price'}
            value={
              loadingLive
                ? '…'
                : displayPrice > 0
                  ? formatIsk(displayPrice)
                  : isBpoPage
                    ? 'No market orders'
                    : formatIsk(0)
            }
            valueClassName={displayPrice > 0 ? 'text-primary' : undefined}
          />
          {isBpoPage && manufacturedProduct ? (
            <StatCard
              label="Product hub sell"
              value={
                loadingLive
                  ? '…'
                  : productPrice && productPrice > 0
                    ? formatIsk(productPrice)
                    : formatIsk(0)
              }
              valueClassName={productPrice && productPrice > 0 ? 'text-primary' : undefined}
            />
          ) : null}
          <StatCard label="Volume (m³)" value={formatDecimal(typeInfo.volume, 2)} />
          {isBpoPage && manufacturedProduct ? (
            <StatCard
              label="Manufactures"
              value={
                <Link className="link link-primary text-sm" to={`/item/${blueprint!.productTypeId}`}>
                  {manufacturedProduct.name}
                </Link>
              }
            />
          ) : null}
          {blueprint && !isBpoPage ? (
            <StatCard
              label="Blueprint"
              value={
                <Link className="link link-primary text-sm" to={`/item/${blueprint.blueprintTypeId}`}>
                  View BPO
                </Link>
              }
            />
          ) : null}
          {blueprint && !isBpoPage ? (
            <StatCard
              label="Rankings"
              value={
                <Link className="link link-primary text-sm" to="/blueprints">
                  View rankings
                </Link>
              }
            />
          ) : null}
        </div>
      </div>

      <Panel
        title={isBpoPage ? 'Manufactured item market' : 'Market history'}
        className="mb-6"
        actions={
          <div className="flex gap-1">
            {(['1d', '1w', '1m', '1y', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`btn btn-xs ${chartRange === r ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setChartRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        }
      >
        {isBpoPage && manufacturedProduct ? (
          <p className="text-sm opacity-60 mb-4">
            Many BPOs are not on the hub market API, so setup cost stays 0 ISK when there are no
            sell orders. The chart below is for{' '}
            <Link className="link link-primary" to={`/item/${manufacturedProduct.typeId}`}>
              {manufacturedProduct.name}
            </Link>
            , not this blueprint.
          </p>
        ) : null}
        {loadingLive ? (
          <LoadingState />
        ) : chartHistory.length === 0 ? (
          <p className="text-sm opacity-60">No history for this window.</p>
        ) : (
          <>
            <div className="flex gap-4 text-sm mb-4">
              <span>Avg price: {formatIsk(avgPrice)}</span>
              <span>Avg volume: {formatDecimal(avgVolume, 1)}/day</span>
              <span>{chartHistory.length} days</span>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="table table-compact w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Avg</th>
                    <th>High</th>
                    <th>Low</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartHistory].reverse().slice(0, 60).map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{formatIsk(row.average)}</td>
                      <td>{formatIsk(row.highest)}</td>
                      <td>{formatIsk(row.lowest)}</td>
                      <td>{row.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
