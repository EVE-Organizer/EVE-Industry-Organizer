import { useCallback, useEffect, useState } from 'react'
import type { BpcContractSummary, HubId } from '@/types'
import type { ImageVariant } from '@/lib/eveImages'
import { EveImage } from '@/components/EveImage'
import { ItemSection } from '@/components/item/ItemSection'
import { ItemMarketHistory } from '@/components/item/ItemMarketHistory'
import { ItemBpcContracts } from '@/components/item/ItemBpcContracts'

type BlueprintMarketTab = 'bpo' | 'bpc'

interface ItemBlueprintMarketProps {
  blueprintTypeId: number
  productTypeId: number
  hub: HubId
  hubName: string
  bpcSummary: BpcContractSummary | null
  snapshotAge?: string
  className?: string
}

const TAB_VARIANT: Record<BlueprintMarketTab, ImageVariant> = {
  bpo: 'bp',
  bpc: 'bpc',
}

const TAB_COPY: Record<
  BlueprintMarketTab,
  { label: string; hint: string; title: string; subtitle: (hubName: string) => string }
> = {
  bpo: {
    label: 'BPO market',
    hint: 'Hub sell orders on the blueprint original',
    title: 'Blueprint original',
    subtitle: (hubName) => `Market history in ${hubName}`,
  },
  bpc: {
    label: 'BPC contracts',
    hint: 'Public blueprint copy contracts in the hub region',
    title: 'Blueprint copies',
    subtitle: (hubName) => `Contract listings in ${hubName}`,
  },
}

function BlueprintTabIcon({
  blueprintTypeId,
  productTypeId,
  variant,
}: {
  blueprintTypeId: number
  productTypeId: number
  variant: ImageVariant
}) {
  return (
    <EveImage
      id={blueprintTypeId}
      variant={variant}
      productTypeId={productTypeId}
      size={24}
      framed
      className="item-blueprint-market__tab-icon"
      alt=""
    />
  )
}

export function ItemBlueprintMarket({
  blueprintTypeId,
  productTypeId,
  hub,
  hubName,
  bpcSummary,
  snapshotAge,
  className,
}: ItemBlueprintMarketProps) {
  const bpcCount = bpcSummary?.count ?? 0
  const bpcAvailable = bpcCount > 0

  const [tab, setTab] = useState<BlueprintMarketTab>('bpo')
  const [bpoAvailable, setBpoAvailable] = useState<boolean | null>(null)
  const [userPickedTab, setUserPickedTab] = useState(false)

  const handleBpoLoaded = useCallback((info: { hasHistory: boolean }) => {
    setBpoAvailable(info.hasHistory)
  }, [])

  useEffect(() => {
    if (userPickedTab || bpoAvailable === null) return
    if (!bpoAvailable && bpcAvailable) {
      setTab('bpc')
    }
  }, [bpoAvailable, bpcAvailable, userPickedTab])

  const pickTab = (next: BlueprintMarketTab) => {
    setUserPickedTab(true)
    setTab(next)
  }

  const copy = TAB_COPY[tab]

  return (
    <ItemSection
      className={`item-blueprint-market${className ? ` ${className}` : ''}`}
      title={`Blueprint · ${hubName}`}
      subtitle={copy.subtitle(hubName)}
      actions={
        <div className="plan-view-tabs__list" role="tablist" aria-label="Blueprint market views">
          {(['bpo', 'bpc'] as const).map((id) => {
            const selected = tab === id
            const meta = TAB_COPY[id]
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                title={meta.hint}
                className={`plan-view-tabs__tab plan-view-tabs__tab--sm${selected ? ' plan-view-tabs__tab--active' : ''}`}
                onClick={() => pickTab(id)}
              >
                <BlueprintTabIcon
                  blueprintTypeId={blueprintTypeId}
                  productTypeId={productTypeId}
                  variant={TAB_VARIANT[id]}
                />
                <span>{meta.label}</span>
                {id === 'bpc' && bpcCount > 0 ? (
                  <span className="badge badge-xs badge-ghost tabular-nums">{bpcCount}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      }
    >
      {tab === 'bpo' ? (
          <ItemMarketHistory
            embedded
            typeId={blueprintTypeId}
            hub={hub}
            onLoaded={handleBpoLoaded}
            emptyHint={`No hub market history for this blueprint in ${hubName}. Try the BPC contracts tab for copy listings.`}
          />
        ) : (
          <ItemBpcContracts
            embedded
            summary={bpcSummary}
            snapshotAge={snapshotAge}
            hubName={hubName}
          />
        )}
    </ItemSection>
  )
}
