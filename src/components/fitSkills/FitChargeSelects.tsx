import { FormFieldLabel } from '@/components/FormFieldLabel'
import type { ChargeModuleGroup } from '@/lib/fitting/fitCharges'

interface FitChargeSelectsProps {
  groups: ChargeModuleGroup[]
  selections: Map<string, number | null>
  onChange: (key: string, chargeTypeId: number | null) => void
}

export function FitChargeSelects({ groups, selections, onChange }: FitChargeSelectsProps) {
  if (!groups.length) {
    return <p className="text-sm opacity-60">No charge slots on this fit.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="form-control w-full max-w-xl">
          <FormFieldLabel label={group.label} size="sm" />
          {group.options.length === 0 ? (
            <p className="text-sm opacity-60">Add compatible ammo to cargo in the EFT paste.</p>
          ) : group.options.length === 1 ? (
            <p className="text-sm py-2">{group.options[0].name}</p>
          ) : (
            <select
              className="select select-bordered select-sm w-full"
              value={selections.get(group.key) ?? ''}
              onChange={(e) => {
                const val = e.target.value
                onChange(group.key, val ? Number(val) : null)
              }}
            >
              {group.options.map((opt) => (
                <option key={opt.typeId} value={opt.typeId}>
                  {opt.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  )
}
