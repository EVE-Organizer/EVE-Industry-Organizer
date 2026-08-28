import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import { hubDisplayName } from '@/lib/hubDisplay'
import { PageHeader, LoadingState, LastUpdated } from '@/components/layout/Layout'
import { textLinkClass } from '@/lib/textLink'
import { EveImage } from '@/components/EveImage'
import { ItemSection } from '@/pages/Item/ItemSection'
import { ItemMetric } from '@/pages/Item/ItemMetric'
import { ItemBlueprintMarket } from '@/pages/Item/ItemBlueprintMarket'
import { ItemLiveQuoteNotice } from '@/pages/Item/ItemLiveQuoteNotice'
import { ItemMarketHistory } from '@/pages/Item/ItemMarketHistory'
import { ItemRecipePanel } from '@/pages/Item/ItemRecipePanel'
import type { HubId } from '@/types'

function hubQuotesQueryOptions(typeId: number, hub: HubId) {
  return {
    queryKey: ['hub-quotes', typeId, hub] as const,
    queryFn: () => getHubQuotes(typeId, hub),
  }
}

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

  const numericId = Number(typeId ?? 0)
  const hub = settings.primaryHub
  const hubName = hubDisplayName(hub)

  const typeMap = useMemo(() => (sde ? buildTypeMap(sde.types) : new Map()), [sde])
  const skillNameMap = useMemo(() => (sde ? buildSkillNameMap(sde.skills) : new Map()), [sde])
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

  const heroTypeId = isBpoPage && blueprint ? blueprint.blueprintTypeId : numericId
  const productTypeId = isBpoPage && blueprint ? blueprint.productTypeId : undefined
  const quotesEnabled = Boolean(typeId) && Boolean(typeInfo)

  const heroQuotesQuery = useQuery({
    ...hubQuotesQueryOptions(heroTypeId, hub),
    enabled: quotesEnabled && heroTypeId > 0,
  })
  const productQuotesQuery = useQuery({
    ...hubQuotesQueryOptions(productTypeId ?? 0, hub),
    enabled: quotesEnabled && productTypeId != null,
  })

  const heroSell = heroQuotesQuery.data?.sell
  const heroBuy = heroQuotesQuery.data?.buy
  const quoteSource = heroQuotesQuery.data?.source
  const quotesFetchedAt = heroQuotesQuery.data?.fetchedAt
  const productSell = productQuotesQuery.data?.sell
  const productBuy = productQuotesQuery.data?.buy
  const loadingLive =
    heroQuotesQuery.isLoading || (productTypeId != null && productQuotesQuery.isLoading)

  const displayHeroSell = (heroSell && heroSell > 0 ? heroSell : staticSell) ?? 0
  const displayHeroBuy = (heroBuy && heroBuy > 0 ? heroBuy : staticBuy) ?? 0

  if (isLoading) return <LoadingState />
  if (!typeInfo) return <p className="text-sm opacity-60">Item not found.</p>

  const productMarketTitle =
    isBpoPage && manufacturedProduct
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
        action={<LastUpdated fetchedAt={quotesFetchedAt} source={quoteSource} />}
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
        <ItemLiveQuoteNotice />

        <dl className="item-section__metrics">
          <ItemMetric
            variant="inline"
            label={isBpoPage ? (isReactionFormula ? 'Formula sell' : 'BPO sell') : 'Hub sell'}
            hint={hubName}
            tone={displayHeroSell > 0 ? 'primary' : 'neutral'}
            value={
              loadingLive ? '…' : displayHeroSell > 0 ? formatIsk(displayHeroSell) : 'No orders'
            }
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
                  loadingLive ? '…' : (productSell ?? 0) > 0 ? formatIsk(productSell!) : 'No orders'
                }
              />
              <ItemMetric
                variant="inline"
                label="Product buy"
                hint={hubName}
                tone={(productBuy ?? 0) > 0 ? 'info' : 'neutral'}
                value={
                  loadingLive ? '…' : (productBuy ?? 0) > 0 ? formatIsk(productBuy!) : 'No orders'
                }
              />
            </>
          ) : null}
          <ItemMetric
            variant="inline"
            label="Volume"
            hint="m³"
            value={formatDecimal(typeInfo.volume, 2)}
          />
          {typeInfo.mass != null && typeInfo.mass > 0 ? (
            <ItemMetric
              variant="inline"
              label="Mass"
              hint="kg"
              value={formatDecimal(typeInfo.mass, 0)}
            />
          ) : null}
          {isBpoPage && manufacturedProduct ? (
            <ItemMetric
              variant="inline"
              label="Manufactures"
              value={
                <Link
                  className={textLinkClass('text-primary text-sm')}
                  to={`/item/${blueprint!.productTypeId}`}
                >
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
                <Link
                  className={textLinkClass('text-primary text-sm')}
                  to={`/item/${blueprint.blueprintTypeId}`}
                >
                  {isReactionRecipe(blueprint) ? 'View reaction formula' : 'View BPO'}
                </Link>
              }
            />
          ) : null}
        </dl>

        <div className="item-section__block">
          {typeInfo.description ? (
            <p className="text-sm leading-relaxed text-base-content/80 whitespace-pre-wrap">
              {typeInfo.description}
            </p>
          ) : (
            <p className="text-sm text-base-content/50">No description available.</p>
          )}
        </div>
      </ItemSection>

      {blueprint && manufacturedProduct ? (
        <ItemRecipePanel
          blueprint={blueprint}
          skillNameMap={skillNameMap}
          productName={manufacturedProduct.name}
          settings={settings}
          systems={sde?.systems}
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
