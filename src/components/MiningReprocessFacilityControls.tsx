import type {
  GlobalSettings,
  MiningReprocessHull,
  MiningReprocessRig,
  MiningReprocessSpace,
  MiningSubtype,
  SystemInfo,
} from '@/types'
import { EveImage } from '@/components/EveImage'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { InfoTooltip } from '@/components/InfoTooltip'
import { ReprocessLocationPicker } from '@/components/ReprocessLocationPicker'
import {
  miningReprocessRigLabel,
  miningReprocessRigTypeId,
  normalizeMiningReprocessFacility,
  reprocessStructureBase,
} from '@/lib/miningReprocess'

interface MiningReprocessFacilityControlsProps {
  settings: GlobalSettings
  subtype: MiningSubtype
  systems?: SystemInfo[]
  onChange: (patch: Partial<GlobalSettings>) => void
}

const RIG_TIERS: MiningReprocessRig[] = ['none', 't1', 't2']
const SPACES: { id: MiningReprocessSpace; label: string }[] = [
  { id: 'highsec', label: 'highsec' },
  { id: 'lowsec', label: 'lowsec' },
  { id: 'nullsec', label: 'nullsec / WH' },
]

function hullRefinePercent(hull: MiningReprocessHull): number | null {
  if (hull === 'athanor') return 2
  if (hull === 'tatara') return 5.5
  if (hull === 'upwell') return 0
  return null
}

function rigSetLabel(hull: MiningReprocessHull): string {
  if (hull === 'athanor') return 'M-Set'
  if (hull === 'tatara') return 'L-Set'
  return 'L/XL-Set'
}

function spaceMultiplier(space: MiningReprocessSpace, rig: MiningReprocessRig): number {
  if (rig === 'none') return 1
  if (space === 'lowsec') return 1.06
  if (space === 'nullsec') return 1.12
  return 1
}

function spaceLabel(space: MiningReprocessSpace): string {
  if (space === 'lowsec') return 'lowsec'
  if (space === 'nullsec') return 'nullsec'
  return 'highsec'
}

function rigOptionLabel(rig: MiningReprocessRig, space: MiningReprocessSpace): string {
  if (rig === 'none') return 'None'
  const rm = rig === 't2' ? 3 : 1
  const sec = spaceMultiplier(space, rig)
  return `${rig.toUpperCase()} +${rm} (×${sec.toFixed(2)})`
}

export function MiningReprocessFacilityControls({
  settings,
  subtype,
  systems,
  onChange,
}: MiningReprocessFacilityControlsProps) {
  const facility = normalizeMiningReprocessFacility(settings.miningReprocessFacility)
  const locationLocked = settings.miningReprocessLocationId != null
  const canFitRig = facility.hull !== 'npc'
  const hullBonus = hullRefinePercent(facility.hull)
  const setLabel = rigSetLabel(facility.hull)
  const rigName = miningReprocessRigLabel(facility.hull, subtype)
  const rigTypeId = miningReprocessRigTypeId(
    facility.hull === 'npc' ? 'upwell' : facility.hull,
    subtype,
    facility.rig === 'none' ? 't1' : facility.rig,
  )
  const basePct = Math.round(reprocessStructureBase(facility) * 1000) / 10
  const sec = spaceMultiplier(facility.space, facility.rig)

  function patchFacility(next: Partial<typeof facility>) {
    onChange({
      miningReprocessFacility: normalizeMiningReprocessFacility({ ...facility, ...next }),
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label className="form-control min-w-0">
        <FormFieldLabel
          label="Reprocess location"
          tooltip="Pick a character station or structure, or a preset. NPC stations are 50%. Athanor is +2% hull, Tatara is +5.5%. Other Upwell hulls have no refine hull bonus."
          size="sm"
        />
        <ReprocessLocationPicker
          settings={settings}
          onChange={onChange}
          systems={systems}
          size="sm"
        />
      </label>

      {canFitRig && hullBonus != null ? (
        <div className="rounded-lg border border-eve-border bg-base-300/20 px-3 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium opacity-70">
            <span>Hull role bonuses</span>
            <InfoTooltip text="Fixed for this hull. Athanor is +2% refine, Tatara is +5.5%. Citadels and engineering complexes have no refine hull bonus. Fitted rigs are below." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-md border border-eve-border bg-base-200 px-2 py-2.5 text-center">
              <div className="truncate text-[10px] uppercase tracking-wide opacity-50">Hull refine</div>
              <div className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">{hullBonus}%</div>
            </div>
            <div className="min-w-0 rounded-md border border-eve-border bg-base-200 px-2 py-2.5 text-center">
              <div className="truncate text-[10px] uppercase tracking-wide opacity-50">Structure base</div>
              <div className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">{basePct}%</div>
            </div>
          </div>
        </div>
      ) : null}

      {canFitRig ? (
        <details className="manufacturing-rig-fields">
          <summary className="manufacturing-rig-fields__summary">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate">Structure rigs ({setLabel})</span>
              <span
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <InfoTooltip text="Athanor fits M-Set processors for one ore family. Tatara fits L-Set Reprocessing Monitor for all ore and ice. Other Upwell hulls use L/XL Reprocessing Monitor. T1 is +1, T2 is +3, then security scales the bonus." />
              </span>
            </span>
            <span className="manufacturing-rig-fields__summary-meta shrink-0 tabular-nums">
              {spaceLabel(facility.space)} ({sec.toFixed(2)}x)
            </span>
          </summary>

          <div className="manufacturing-rig-fields__body">
            <p className="mb-1 text-[10px] uppercase tracking-wide opacity-50">Reprocessing</p>
            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-2">
              <EveImage id={rigTypeId} variant="icon" size={24} framed lazy={false} alt="" />
              <span className="truncate text-xs">{rigName}</span>
              <select
                className="select select-bordered select-sm w-full"
                aria-label={`${rigName} tier`}
                value={facility.rig}
                onChange={(e) => patchFacility({ rig: e.target.value as MiningReprocessRig })}
              >
                {RIG_TIERS.map((rig) => (
                  <option key={rig} value={rig}>
                    {rigOptionLabel(rig, facility.space)}
                  </option>
                ))}
              </select>
            </div>

            {!locationLocked ? (
              <label className="form-control mt-3">
                <FormFieldLabel
                  label="Structure space"
                  tooltip="Rig security bonus only applies when a standup rig is fitted. Highsec ×1, lowsec ×1.06, null and wormhole ×1.12."
                  size="sm"
                />
                <select
                  className="select select-bordered select-sm w-full"
                  aria-label="Structure space"
                  value={facility.space}
                  disabled={facility.rig === 'none'}
                  onChange={(e) =>
                    patchFacility({ space: e.target.value as MiningReprocessSpace })
                  }
                >
                  {SPACES.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}
