import type { RankedBlueprintRow, SkillLevels } from '@/types'
import {
  BlueprintRow,
  BlueprintMobileRow,
  BlueprintUnrankedRow,
  BlueprintUnrankedMobileRow,
  type BlueprintItemProps,
} from '@/components/BlueprintRow'
import type { RouteDangerResult } from '@/lib/routeDanger'

export interface FavoriteEntry {
  productTypeId: number
  name: string
  row: RankedBlueprintRow | null
}

interface FavoriteItemsSectionProps {
  entries: FavoriteEntry[]
  skills: SkillLevels
  haulIn: RouteDangerResult | null
  haulOut: RouteDangerResult | null
  haulError: string | null
  dangerLoading: boolean
  onToggle: (productTypeId: number) => void
  onOpenGraph: (row: RankedBlueprintRow) => void
  onOpenSetup: (row: RankedBlueprintRow) => void
  onOpenIph: (row: RankedBlueprintRow) => void
  onOpenHaulRisk: () => void
}

function favoriteItemProps(
  entry: FavoriteEntry,
  skills: SkillLevels,
  haulIn: RouteDangerResult | null,
  haulOut: RouteDangerResult | null,
  haulError: string | null,
  dangerLoading: boolean,
  onToggle: (productTypeId: number) => void,
  onOpenGraph: (row: RankedBlueprintRow) => void,
  onOpenSetup: (row: RankedBlueprintRow) => void,
  onOpenIph: (row: RankedBlueprintRow) => void,
  onOpenHaulRisk: () => void,
): BlueprintItemProps | null {
  if (!entry.row) return null
  const row = entry.row
  return {
    row,
    skills,
    watched: true,
    onWatch: () => onToggle(entry.productTypeId),
    onOpenGraph: () => onOpenGraph(row),
    onOpenSetup: () => onOpenSetup(row),
    onOpenIph: () => onOpenIph(row),
    onOpenHaulRisk,
    haulIn,
    haulOut,
    haulError,
    dangerLoading,
  }
}

export function FavoriteItemsSection({
  entries,
  skills,
  haulIn,
  haulOut,
  haulError,
  dangerLoading,
  onToggle,
  onOpenGraph,
  onOpenSetup,
  onOpenIph,
  onOpenHaulRisk,
}: FavoriteItemsSectionProps) {
  return (
    <div className="collapse collapse-arrow card bg-base-200 border border-eve-border mb-4 shrink-0 min-w-0 overflow-hidden">
      <input type="checkbox" defaultChecked />
      <div className="collapse-title text-sm font-semibold min-h-0 py-3 px-4">
        Favorites
        <span className="badge badge-ghost badge-sm ml-2 tabular-nums">{entries.length}</span>
      </div>
      <div className="collapse-content !px-0 min-w-0 pb-4">
        {entries.length === 0 ? (
          <p className="text-sm opacity-60 px-4">Star a blueprint below to add it here.</p>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto border-y border-eve-border">
              <table className="table table-compact w-full">
                <thead className="bg-base-300/30">
                  <tr>
                    <th className="w-12"></th>
                    <th>Blueprint</th>
                    <th>Setup</th>
                    <th>Profit</th>
                    <th>ISK/hr</th>
                    <th>Margin</th>
                    <th>Vol/day</th>
                    <th>Haul risk</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const props = favoriteItemProps(
                      entry,
                      skills,
                      haulIn,
                      haulOut,
                      haulError,
                      dangerLoading,
                      onToggle,
                      onOpenGraph,
                      onOpenSetup,
                      onOpenIph,
                      onOpenHaulRisk,
                    )
                    if (props) {
                      return <BlueprintRow key={entry.productTypeId} {...props} />
                    }
                    return (
                      <BlueprintUnrankedRow
                        key={entry.productTypeId}
                        productTypeId={entry.productTypeId}
                        name={entry.name}
                        watched
                        onWatch={() => onToggle(entry.productTypeId)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden flex flex-col gap-2 min-w-0">
              {entries.map((entry) => {
                const props = favoriteItemProps(
                  entry,
                  skills,
                  haulIn,
                  haulOut,
                  haulError,
                  dangerLoading,
                  onToggle,
                  onOpenGraph,
                  onOpenSetup,
                  onOpenIph,
                  onOpenHaulRisk,
                )
                if (props) {
                  return <BlueprintMobileRow key={entry.productTypeId} {...props} />
                }
                return (
                  <BlueprintUnrankedMobileRow
                    key={entry.productTypeId}
                    productTypeId={entry.productTypeId}
                    name={entry.name}
                    watched
                    onWatch={() => onToggle(entry.productTypeId)}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
