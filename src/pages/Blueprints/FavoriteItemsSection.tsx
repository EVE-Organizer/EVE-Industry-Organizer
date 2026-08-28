import type { RankedBlueprintRow, SkillLevels } from '@/types'
import {
  BlueprintRow,
  BlueprintMobileRow,
  BlueprintUnrankedRow,
  BlueprintUnrankedMobileRow,
  type BlueprintItemProps,
} from '@/pages/Blueprints/BlueprintRow'

export interface FavoriteEntry {
  productTypeId: number
  name: string
  row: RankedBlueprintRow | null
}

interface FavoriteItemsSectionProps {
  entries: FavoriteEntry[]
  skills: SkillLevels
  onToggle: (productTypeId: number) => void
  onOpenGraph: (row: RankedBlueprintRow) => void
  onOpenSetup: (row: RankedBlueprintRow) => void
  onOpenIph: (row: RankedBlueprintRow) => void
}

function favoriteItemProps(
  entry: FavoriteEntry,
  skills: SkillLevels,
  onToggle: (productTypeId: number) => void,
  onOpenGraph: (row: RankedBlueprintRow) => void,
  onOpenSetup: (row: RankedBlueprintRow) => void,
  onOpenIph: (row: RankedBlueprintRow) => void,
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
  }
}

export function FavoriteItemsSection({
  entries,
  skills,
  onToggle,
  onOpenGraph,
  onOpenSetup,
  onOpenIph,
}: FavoriteItemsSectionProps) {
  return (
    <div className="collapse collapse-arrow card bg-base-200 border border-eve-border mb-4 shrink-0 min-w-0 overflow-hidden">
      <input type="checkbox" defaultChecked />
      <div className="collapse-title flex items-center gap-2 text-sm font-semibold min-h-0 py-3 px-4">
        Favorites
        <span className="badge badge-ghost badge-sm tabular-nums">{entries.length}</span>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const props = favoriteItemProps(
                      entry,
                      skills,
                      onToggle,
                      onOpenGraph,
                      onOpenSetup,
                      onOpenIph,
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
                  onToggle,
                  onOpenGraph,
                  onOpenSetup,
                  onOpenIph,
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
