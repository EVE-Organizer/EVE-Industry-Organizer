import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import {
  buildTypeMap,
  buildPriceMap,
  buildBuyPriceMap,
  buildSkillNameMap,
  getBlueprintForProduct,
  getBlueprintForBpo,
  getAllBlueprints,
  getHubMarket,
} from '@/services/data/sdeLoader'
import { isReactionRecipe } from '@/lib/recipes'
import { getHubQuotes } from '@/services/market/marketService'
import { getBpcContracts } from '@/lib/bpcContracts'
import { formatDecimal, formatIsk } from '@/lib/profit'
import { tierLabel } from '@/lib/blueprintGroups'
import { HUBS } from '@/types'
import { PageHeader, LoadingState, LastUpdated } from '@/components/Layout'
import { textLinkClass } from '@/lib/textLink'
import { EveImage } from '@/components/EveImage'
import { ItemSection } from '@/components/item/ItemSection'
import { ItemMetric } from '@/components/item/ItemMetric'
import { ItemBlueprintMarket } from '@/components/item/ItemBlueprintMarket'
import { ItemMarketHistory } from '@/components/item/ItemMarketHistory'
import { ItemRecipePanel } from '@/components/item/ItemRecipePanel'

function formatSnapshotAge(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const t = new Date(iso).getTime()
  if (Number.isNaN(t) || t < 1_000_000_000_000) return undefined
  const hours = Math.round((Date.now() - t) / (60 * 60 * 1000))
  if (hours < 1) return 'under 1h ago'
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function ItemDetailPage() {
  const { typeId } = useParams()
  const settings = useAppStore((s) => s.userData.settings)
  const { data: sde, isLoading } = useSdeData()

  const [heroSell, setHeroSell] = useState<number>()
  const [heroBuy, setHeroBuy] = useState<number>()
  const [productSell, setProductSell] = useState<number>()
  const [productBuy, setProductBuy] = useState<number>()
  const [quoteSource, setQuoteSource] = useState<string>()
  const [quotesFetchedAt, setQuotesFetchedAt] = useState<number>()
  const [loadingLive, setLoadingLive] = useState(true)

  const numericId = Number(typeId ?? 0)
  const hub = settings.primaryHub
  const hubName = HUBS.find((h) => h.id === hub)?.name ?? hub

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])
  const skillNameMap = useMemo(
    () => (sde ? buildSkillNameMap(sde.skills) : new Map()),
    [sde],
  )
  const typeInfo = typeMap.get(numericId)

  const blueprint = useMemo(() => {
    if (!sde) return undefined
    const all = getAllBlueprints(sde.registry)
    return getBlueprintForProduct(all, numericId) ?? getBlueprintForBpo(all, numericId)
  }, [sde, numericId])

  const isBpoPage = blueprint?.blueprintTypeId === numericId
  const isReactionFormula = blueprint != null && isReactionRecipe(blueprint) && isBpoPage
  const manufacturedProduct = blueprint ? typeMap.get(blueprint.productTypeId) : undefined

  const hubMarket = useMemo(() => {
    if (!sde) return null
    return getHubMarket(sde.market, hub)
  }, [sde, hub])

  const staticSell = useMemo(() => {
    if (!hubMarket) return undefined
    return buildPriceMap(hubMarket).get(numericId)
  }, [hubMarket, numericId])

  const staticBuy = useMemo(() => {
    if (!hubMarket) return undefined
    return buildBuyPriceMap(hubMarket).get(numericId)
  }, [hubMarket, numericId])

  const bpcSummary = useMemo(() => {
    if (!sde?.contracts || !blueprint) return null
    return getBpcContracts(sde.contracts, blueprint.blueprintTypeId, hub)
  }, [sde, blueprint, hub])

  const snapshotAge = formatSnapshotAge(sde?.contracts?.generatedAt)

  useEffect(() => {
    if (!typeId || !typeInfo) return
    let cancelled = false
    setLoadingLive(true)

    const blueprintTypeId = blueprint?.blueprintTypeId
    const heroTypeId = isBpoPage && blueprintTypeId ? blueprintTypeId : numericId

    ;(async () => {
      const fetches: Promise<{ sell: number; buy: number; source: string; fetchedAt: number }>[] = [
        getHubQuotes(heroTypeId, hub),
      ]

      if (isBpoPage && blueprint) {
        fetches.push(getHubQuotes(blueprint.productTypeId, hub))
      } else if (blueprint && blueprintTypeId && blueprintTypeId !== numericId) {
        fetches.push(getHubQuotes(blueprintTypeId, hub))
      }

      const results = await Promise.all(fetches)
      if (cancelled) return

      const heroQuotes = results[0]
      setHeroSell(heroQuotes.sell)
      setHeroBuy(heroQuotes.buy)
      setQuoteSource(heroQuotes.source)
      setQuotesFetchedAt(heroQuotes.fetchedAt)

      if (isBpoPage && blueprint) {
        const productQuotes = results[1]
        setProductSell(productQuotes?.sell)
        setProductBuy(productQuotes?.buy)
      } else if (blueprint && results[1]) {
        setProductSell(heroQuotes.sell)
        setProductBuy(heroQuotes.buy)
      } else {
        setProductSell(heroQuotes.sell)
        setProductBuy(heroQuotes.buy)
      }

      setLoadingLive(false)
    })()

    return () => {
      cancelled = true
    }
  }, [typeId, typeInfo, numericId, hub, isBpoPage, blueprint])

  const displayHeroSell =
    (heroSell && heroSell > 0 ? heroSell : staticSell) ?? 0
  const displayHeroBuy =
    (heroBuy && heroBuy > 0 ? heroBuy : staticBuy) ?? 0

  if (isLoading) return <LoadingState />
  if (!typeInfo) return <p className="text-sm opacity-60">Item not found.</p>

  const productMarketTitle = isBpoPage && manufacturedProduct
    ? `Product market · ${hubName} (${manufacturedProduct.name})`
    : `Market history · ${hubName}`

  return (
    <div>
      <PageHeader
        title={typeInfo.name}
        subtitle={`${
          isReactionFormula
            ? `${typeInfo.group} · Reaction formula`
            : isBpoPage
              ? `${typeInfo.group} · ${tierLabel(blueprint!.tier)} blueprint`
              : `${typeInfo.group} · ${typeInfo.category}${blueprint ? ` · ${isReactionRecipe(blueprint) ? 'Reaction product' : `${tierLabel(blueprint.tier)} BPO`}` : ''}`
        } · Hub: ${hubName}`}
        icon={
          <EveImage
            id={typeInfo.typeId}
            variant={isBpoPage ? 'bp' : 'icon'}
            productTypeId={isBpoPage ? blueprint?.productTypeId : undefined}
            size={56}
            framed
            alt={typeInfo.name}
          />
        }
        action={
          <LastUpdated fetchedAt={quotesFetchedAt} source={quoteSource} />
        }
      />

      <ItemSection
        title="Overview"
        subtitle={`Live quotes and item stats · ${hubName}`}
        className="mb-6"
        actions={
          <>
            {blueprint ? (
              <span className="badge badge-primary badge-sm badge-outline border-primary/30 font-normal">
                {tierLabel(blueprint.tier)}
              </span>
            ) : null}
            <span className="plan-stat-chip">
              <span className="plan-stat-chip__label">Type ID</span>
              <span className="plan-stat-chip__value">{typeInfo.typeId}</span>
            </span>
          </>
        }
      >
        <dl className="item-section__metrics">
          <ItemMetric
            variant="inline"
            label={isBpoPage ? (isReactionFormula ? 'Formula sell' : 'BPO sell') : 'Hub sell'}
            hint={hubName}
            tone={displayHeroSell > 0 ? 'primary' : 'neutral'}
            value={loadingLive ? '…' : displayHeroSell > 0 ? formatIsk(displayHeroSell) : 'No orders'}
          />
          <ItemMetric
            variant="inline"
            label={isBpoPage ? (isReactionFormula ? 'Formula buy' : 'BPO buy') : 'Hub buy'}
            hint={hubName}
            tone={displayHeroBuy > 0 ? 'info' : 'neutral'}
            value={loadingLive ? '…' : displayHeroBuy > 0 ? formatIsk(displayHeroBuy) : 'No orders'}
          />
          {isBpoPage && manufacturedProduct ? (
            <>
              <ItemMetric
                variant="inline"
                label="Product sell"
                hint={hubName}
                tone={(productSell ?? 0) > 0 ? 'primary' : 'neutral'}
                value={
                  loadingLive
                    ? '…'
                    : (productSell ?? 0) > 0
                      ? formatIsk(productSell!)
                      : 'No orders'
                }
              />
              <ItemMetric
                variant="inline"
                label="Product buy"
                hint={hubName}
                tone={(productBuy ?? 0) > 0 ? 'info' : 'neutral'}
                value={
                  loadingLive
                    ? '…'
                    : (productBuy ?? 0) > 0
                      ? formatIsk(productBuy!)
                      : 'No orders'
                }
              />
            </>
          ) : null}
          <ItemMetric variant="inline" label="Volume" hint="m³" value={formatDecimal(typeInfo.volume, 2)} />
          {typeInfo.mass != null && typeInfo.mass > 0 ? (
            <ItemMetric variant="inline" label="Mass" hint="kg" value={formatDecimal(typeInfo.mass, 0)} />
          ) : null}
          {isBpoPage && manufacturedProduct ? (
            <ItemMetric
              variant="inline"
              label="Manufactures"
              value={
                <Link className={textLinkClass('text-primary text-sm')} to={`/item/${blueprint!.productTypeId}`}>
                  {manufacturedProduct.name}
                </Link>
              }
            />
          ) : null}
          {blueprint && !isBpoPage ? (
            <ItemMetric
              variant="inline"
              label={isReactionRecipe(blueprint) ? 'Formula' : 'Blueprint'}
              value={
                <Link className={textLinkClass('text-primary text-sm')} to={`/item/${blueprint.blueprintTypeId}`}>
                  {isReactionRecipe(blueprint) ? 'View reaction formula' : 'View BPO'}
                </Link>
              }
            />
          ) : null}
        </dl>

        <div className="item-section__block">
          {typeInfo.description ? (
            <p className="text-sm leading-relaxed text-base-content/80 whitespace-pre-wrap">{typeInfo.description}</p>
          ) : (
            <p className="text-sm text-base-content/50">No description available.</p>
          )}
        </div>
      </ItemSection>

      {blueprint && manufacturedProduct ? (
        <ItemRecipePanel
          blueprint={blueprint}
          typeMap={typeMap}
          skillNameMap={skillNameMap}
          productName={manufacturedProduct.name}
          className="mb-6"
        />
      ) : (
        <ItemSection title="Industry" className="mb-6">
          <p className="text-sm text-base-content/50">No manufacturing recipe in this app.</p>
        </ItemSection>
      )}

      {blueprint ? (
        <ItemBlueprintMarket
          blueprintTypeId={blueprint.blueprintTypeId}
          productTypeId={blueprint.productTypeId}
          hub={hub}
          hubName={hubName}
          bpcSummary={bpcSummary}
          snapshotAge={snapshotAge}
          className="mb-6"
        />
      ) : null}

      {(isBpoPage && blueprint) || !isBpoPage ? (
        <ItemMarketHistory
          title={productMarketTitle}
          typeId={isBpoPage && blueprint ? blueprint.productTypeId : numericId}
          hub={hub}
          className="mb-6"
          emptyHint={`No hub market history in ${hubName}.`}
        />
      ) : null}
    </div>
  )
}
