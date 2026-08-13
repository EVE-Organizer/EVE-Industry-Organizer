import type { ReactNode } from 'react'
import type { BlueprintTier, RecipeKind } from '@/types'
import { BLUEPRINT_TIERS, RANKING_RECIPE_KINDS } from '@/types'
import type { ProductGroupCategoryNode } from '@/services/data/sdeLoader'
import { RECIPE_KIND_LABELS } from '@/lib/blueprintQuery'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { EveImage } from '@/components/EveImage'
import { ProductGroupPicker } from '@/components/ProductGroupPicker'
import { TIER_FILTER_LABELS, TIER_IMAGE_VARIANTS, TIER_TYPE_IDS } from '@/lib/eveImages'
import { FilterSection } from '@/components/EconomicsFilterSection'

export interface BlueprintPickerFilterValues {
  tiers: BlueprintTier[]
  groups: string[]
  buildableOnly: boolean
  /** Ranking page only: which recipe types to include. */
  recipeKinds?: RecipeKind[]
}

interface BlueprintPickerFilterSectionProps {
  values: BlueprintPickerFilterValues
  onChange: (patch: Partial<BlueprintPickerFilterValues>) => void
  productGroupTree: ProductGroupCategoryNode[]
  title?: string
  hint?: string
  className?: string
  /** Optional extra row under buildable (ranking-only). */
  extraAvailability?: ReactNode
}

function FilterChip({
  active,
  onClick,
  children,
  className = '',
  tall = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  tall?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`category-chip ${active ? 'btn-primary' : 'btn-ghost border border-eve-border'} ${
        tall ? 'flex-col gap-1.5 min-h-[4.5rem] py-2' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Tier / product group / buildable filters for Blueprints ranking and Plan picker. */
export function BlueprintPickerFilterSection({
  values,
  onChange,
  productGroupTree,
  title = 'What to build',
  hint = 'Blueprint tier and product group',
  className,
  extraAvailability,
}: BlueprintPickerFilterSectionProps) {
  function toggleTier(tier: BlueprintTier) {
    const active = values.tiers.includes(tier)
    const tiers = active ? values.tiers.filter((t) => t !== tier) : [...values.tiers, tier]
    onChange({ tiers, groups: [] })
  }

  function toggleRecipeKind(kind: RecipeKind) {
    const current = values.recipeKinds ?? [...RANKING_RECIPE_KINDS]
    const active = current.includes(kind)
    if (active && current.length === 1) return
    const recipeKinds = active
      ? current.filter((k) => k !== kind)
      : [...current, kind]
    onChange({ recipeKinds, groups: [] })
  }

  return (
    <FilterSection title={title} hint={hint} className={className}>
      {values.recipeKinds ? (
        <div className="shrink-0">
          <FormFieldLabel
            label="Recipe type"
            tooltip="Choose manufacturing BPOs, reaction formulas, or both. With both selected, the table shows the top items across all types."
            size="sm"
          />
          <div
            role="group"
            aria-label="Recipe type"
            className="grid grid-cols-2 gap-2 w-full min-w-0 mt-1"
          >
            {RANKING_RECIPE_KINDS.map((kind) => (
              <FilterChip
                key={kind}
                active={(values.recipeKinds ?? RANKING_RECIPE_KINDS).includes(kind)}
                onClick={() => toggleRecipeKind(kind)}
                className="min-w-0 justify-center py-2.5"
              >
                <span className="text-xs font-medium">{RECIPE_KIND_LABELS[kind]}</span>
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0">
        <FormFieldLabel label="Tier" size="sm" />
        <div
          role="group"
          aria-label="Blueprint tier"
          className="grid grid-cols-3 gap-2 w-full min-w-0 mt-1"
        >
          {BLUEPRINT_TIERS.map((t) => (
            <FilterChip
              key={t}
              active={values.tiers.includes(t)}
              onClick={() => toggleTier(t)}
              tall
              className="min-w-0 justify-center"
            >
              <span className="rounded-md bg-base-100/90 p-1 shadow-sm">
                <EveImage
                  id={TIER_TYPE_IDS[t]}
                  variant={TIER_IMAGE_VARIANTS[t]}
                  size={40}
                  framed
                  alt=""
                  lazy={false}
                />
              </span>
              <span className="text-xs font-medium">{TIER_FILTER_LABELS[t]}</span>
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <FormFieldLabel
          label="Product group"
          tooltip="Check groups to limit results. Leave none selected for all groups."
          size="sm"
        />
        <ProductGroupPicker
          variant="panel"
          value={values.groups}
          onChange={(groups) => onChange({ groups })}
          tree={productGroupTree}
          className="w-full"
        />
      </div>

      <div className="rounded-md border border-eve-border bg-base-300/10 px-3 py-2.5 flex flex-col gap-2">
        <label className="label cursor-pointer gap-2 justify-start py-0 min-h-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={values.buildableOnly}
            onChange={(e) => onChange({ buildableOnly: e.target.checked })}
          />
          <span className="label-text text-sm inline-flex items-center gap-1.5">
            Only buildable
            <InfoTooltip text="Checks Industry and other skills you entered during setup or in Settings." />
          </span>
        </label>
        {extraAvailability}
      </div>
    </FilterSection>
  )
}
